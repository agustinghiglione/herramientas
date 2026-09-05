const { Router } = require('express');
const multer = require('multer');
const fs = require('fs');
const { extraerTexto } = require('./extraerTexto');
const { limpiarDocumento } = require('./ia');
const { generarPdf } = require('./generarPdf');
const { renderizarVideo, PLANTILLAS } = require('./videoRender');
const { login: adminLogin, requireAdmin } = require('./adminAuth');
const { obtenerHojas, guardarActual, leerActual } = require('./googleSheets');

// En memoria (no en disco) — el archivo del cliente nunca toca el filesystem
// del servidor, solo vive en RAM mientras dura la request.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
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

router.get('/video/plantillas', requireAdmin, (_req, res) => {
  const plantillas = Object.entries(PLANTILLAS).map(([id, p]) => ({ id, nombre: p.nombre }));
  res.json({ plantillas });
});

router.post('/video/render', requireAdmin, async (req, res) => {
  try {
    const guion = (req.body?.guion || '').trim();
    const plantilla = (req.body?.plantilla || 'chatgpt').trim();

    if (!guion) {
      return res.status(400).json({ error: 'Pegá el guion del video.' });
    }

    const outPath = await renderizarVideo(guion, plantilla);

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
