const { Router } = require('express');
const multer = require('multer');
const fs = require('fs');
const { extraerTexto } = require('./extraerTexto');
const { limpiarDocumento } = require('./ia');
const { generarPdf } = require('./generarPdf');
const { renderizarVideo, PLANTILLAS, listarBanners, guardarBannerNuevo, rutaImagenBanner } = require('./videoRender');
const { login: adminLogin, requireAdmin } = require('./adminAuth');
const { obtenerHojas, guardarActual, leerActual } = require('./googleSheets');
const { extraerPosiciones } = require('./censura/extraerPosiciones');
const { detectarSensibles } = require('./censura/detectar');
const { previsualizarPagina, generarPdfCensurado } = require('./censura/rasterizar');
const { crearTrabajo, obtenerTrabajo, borrarTrabajo } = require('./censura/trabajos');

// En memoria (no en disco) — el archivo del cliente nunca toca el filesystem
// del servidor, solo vive en RAM mientras dura la request. (La única
// excepción es el análisis de censura: ese sí necesita el PDF en disco un
// rato, para poder rasterizarlo — ver server/censura/trabajos.js.)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});
const uploadBanner = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB, ya es una imagen sola
});
const uploadDocumentoCensura = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB — pueden ser contratos largos
});

const router = Router();

router.get('/salud', (_req, res) => res.json({ ok: true }));

router.post('/limpiar', requireAdmin, upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Subí un archivo (PDF, DOCX o TXT).' });
    }
    const instrucciones = (req.body?.instrucciones || '').trim();
    if (!instrucciones) {
      return res.status(400).json({ error: 'Contame qué información hay que eliminar.' });
    }

    const textoOriginal = await extraerTexto(req.file.buffer, req.file.originalname, req.file.mimetype);
    if (!textoOriginal.trim()) {
      return res.status(400).json({ error: 'No pude leer texto de ese archivo (¿está escaneado como imagen?).' });
    }

    const textoLimpio = await limpiarDocumento(textoOriginal, instrucciones);
    const pdfBuffer = await generarPdf(textoLimpio, req.file.originalname);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento-limpio.pdf"');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[limpiar] error:', err);
    res.status(500).json({ error: err.message || 'Algo salió mal procesando el documento.' });
  }
});

// --- Censura real de documentos: detección de datos sensibles + tapado ---
//
// Flujo en 2 pasos, porque antes de tapar nada el usuario tiene que poder
// revisar y corregir lo que la IA encontró:
//   1) POST /censura/analizar → sube el PDF, se detectan los datos
//      sensibles con su posición, se guardan en un "trabajo" temporal y se
//      devuelve la lista para mostrar en pantalla (con una imagen de cada
//      página para dibujar los recuadros encima).
//   2) POST /censura/confirmar → con qué detecciones quedaron activas,
//      arma el PDF final (tapado de verdad, no un dibujo encima) y lo
//      devuelve para descargar. El trabajo temporal se borra enseguida.
router.post('/censura/analizar', requireAdmin, uploadDocumentoCensura.single('documento'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Subí un PDF.' });
    }
    const esPdf = req.file.mimetype === 'application/pdf' || /\.pdf$/i.test(req.file.originalname || '');
    if (!esPdf) {
      return res.status(400).json({ error: 'Por ahora esta herramienta solo procesa PDF.' });
    }

    const posiciones = await extraerPosiciones(req.file.buffer);
    if (posiciones.length === 0 || posiciones.every((p) => p.items.length === 0)) {
      return res
        .status(400)
        .json({ error: 'No pude leer texto de ese PDF (¿está escaneado como imagen, sin texto real?).' });
    }

    const paginas = await detectarSensibles(posiciones);
    const jobId = await crearTrabajo(req.file.buffer, paginas);

    res.json({
      jobId,
      totalPaginas: paginas.length,
      paginas: paginas.map((p) => ({
        numero: p.numero,
        detecciones: p.detecciones.map((d) => ({
          id: d.id,
          categoria: d.categoria,
          texto: d.texto,
          activo: d.activo,
          cajas: d.cajas,
        })),
      })),
    });
  } catch (err) {
    console.error('[censura/analizar] error:', err);
    res.status(500).json({ error: err.message || 'No se pudo analizar el documento.' });
  }
});

router.get('/censura/pagina/:jobId/:numero', requireAdmin, async (req, res) => {
  try {
    const trabajo = obtenerTrabajo(req.params.jobId);
    if (!trabajo) return res.status(404).json({ error: 'Ese análisis ya no existe (¿pasaron más de 30 minutos?).' });

    const numero = parseInt(req.params.numero, 10);
    const buffer = await previsualizarPagina(trabajo.pdfPath, numero);
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    console.error('[censura/pagina] error:', err);
    res.status(500).json({ error: err.message || 'No se pudo generar la vista previa de la página.' });
  }
});

router.post('/censura/confirmar', requireAdmin, async (req, res) => {
  const { jobId, desactivadas } = req.body || {};
  try {
    const trabajo = obtenerTrabajo(jobId);
    if (!trabajo) return res.status(404).json({ error: 'Ese análisis ya no existe (¿pasaron más de 30 minutos?).' });

    const idsDesactivados = new Set(Array.isArray(desactivadas) ? desactivadas : []);
    const paginas = trabajo.paginas.map((p) => ({
      ...p,
      detecciones: p.detecciones.map((d) => ({ ...d, activo: !idsDesactivados.has(d.id) })),
    }));

    const pdfFinal = await generarPdfCensurado(trabajo.pdfPath, paginas);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento-censurado.pdf"');
    res.send(pdfFinal);
  } catch (err) {
    console.error('[censura/confirmar] error:', err);
    res.status(500).json({ error: err.message || 'No se pudo generar el PDF final.' });
  } finally {
    if (jobId) await borrarTrabajo(jobId);
  }
});

router.post('/censura/cancelar', requireAdmin, async (req, res) => {
  const { jobId } = req.body || {};
  if (jobId) await borrarTrabajo(jobId);
  res.json({ ok: true });
});

router.get('/video/plantillas', requireAdmin, (_req, res) => {
  const plantillas = Object.entries(PLANTILLAS).map(([id, p]) => ({ id, nombre: p.nombre }));
  res.json({ plantillas });
});

router.get('/video/banners', requireAdmin, async (_req, res) => {
  try {
    const banners = await listarBanners();
    res.json({ banners });
  } catch (err) {
    console.error('[video/banners] error:', err);
    res.status(500).json({ error: err.message || 'No se pudo leer el catálogo de banners.' });
  }
});

router.get('/video/banners/:id/imagen', requireAdmin, (req, res) => {
  const ruta = rutaImagenBanner(req.params.id);
  if (!ruta || !fs.existsSync(ruta)) return res.status(404).end();
  res.setHeader('Content-Type', 'image/png');
  fs.createReadStream(ruta).pipe(res);
});

router.post('/video/banners', requireAdmin, uploadBanner.single('banner'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Subí una imagen PNG (1080x1920, formato del video).' });
    if (req.file.mimetype !== 'image/png') {
      return res.status(400).json({ error: 'Por ahora solo se aceptan imágenes PNG.' });
    }
    const nombre = (req.body?.nombre || '').trim();
    const banner = await guardarBannerNuevo(req.file.buffer, nombre);
    res.json(banner);
  } catch (err) {
    console.error('[video/banners POST] error:', err);
    res.status(500).json({ error: err.message || 'No se pudo guardar el banner.' });
  }
});

router.post('/video/render', requireAdmin, async (req, res) => {
  try {
    const guion = (req.body?.guion || '').trim();
    const plantilla = (req.body?.plantilla || 'chatgpt').trim();
    const banner = (req.body?.banner || '').trim();

    if (!guion) {
      return res.status(400).json({ error: 'Pegá el guion del video.' });
    }

    const outPath = await renderizarVideo(guion, plantilla, banner || null);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="video-chat-prisma.mp4"');
    const stream = fs.createReadStream(outPath);
    stream.pipe(res);
    stream.on('close', () => {
      fs.unlink(outPath, () => {}); // limpieza best-effort, no bloquea la respuesta
    });
  } catch (err) {
    console.error('[video/render] error:', err);
    res.status(500).json({ error: err.message || 'No se pudo generar el video.' });
  }
});


// --- Panel de administración: login ---
router.post('/admin/login', adminLogin);

// --- Panel de administración: datos en vivo desde el Google Sheet de Prisma ---
// Trae TODAS las hojas de la planilla tal cual están, sin asumir su
// estructura — es para tener los datos a mano para un futuro estudio del
// negocio, no un reporte con un formato fijo todavía. Reemplaza a la carga
// manual de un archivo Excel: ahora se actualiza con un botón, en vivo.
router.post('/admin/sheet/actualizar', requireAdmin, async (_req, res) => {
  try {
    const datos = await obtenerHojas();
    const registro = guardarActual(datos);
    res.json({
      actualizadoEn: registro.actualizadoEn,
      hojas: registro.hojas.map((h) => ({ nombre: h.nombre, totalFilas: h.totalFilas, totalColumnas: h.totalColumnas })),
    });
  } catch (err) {
    console.error('[admin/sheet/actualizar] error:', err);
    res.status(500).json({ error: err.message || 'No se pudo leer la planilla de Google Sheets.' });
  }
});

router.get('/admin/sheet/actual', requireAdmin, (_req, res) => {
  const registro = leerActual();
  if (!registro) return res.status(404).json({ error: 'Todavía no se trajeron datos del Sheet.' });
  res.json(registro);
});

module.exports = { router };
