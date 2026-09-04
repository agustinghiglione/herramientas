const { Router } = require('express');
const multer = require('multer');
const fs = require('fs');
const { extraerTexto } = require('./extraerTexto');
const { limpiarDocumento } = require('./ia');
const { generarPdf } = require('./generarPdf');
const { renderizarVideo, PLANTILLAS } = require('./videoRender');
const { login: adminLogin, requireAdmin } = require('./adminAuth');
const { parsearExcel, guardarActual, leerActual } = require('./excel');

// En memoria (no en disco) — el archivo del cliente nunca toca el filesystem
// del servidor, solo vive en RAM mientras dura la request.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

const router = Router();

router.get('/salud', (_req, res) => res.json({ ok: true }));

router.post('/limpiar', upload.single('archivo'), async (req, res) => {
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

router.get('/video/plantillas', (_req, res) => {
  const plantillas = Object.entries(PLANTILLAS).map(([id, p]) => ({ id, nombre: p.nombre }));
  res.json({ plantillas });
});

router.post('/video/render', async (req, res) => {
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

// --- Panel de administración: carga y lectura del Excel de Prisma ---
// Guarda TODAS las hojas tal cual vienen, sin asumir su estructura — es para
// tener los datos a mano para un futuro estudio del negocio, no un reporte
// con un formato fijo todavía.
router.post('/admin/excel/subir', requireAdmin, upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Subí un archivo .xlsx.' });
    }
    const datos = await parsearExcel(req.file.buffer);
    if (datos.hojas.length === 0) {
      return res.status(400).json({ error: 'No se encontró ninguna hoja con datos en ese archivo.' });
    }
    const registro = guardarActual(req.file.originalname, datos);
    res.json({
      nombreArchivo: registro.nombreArchivo,
      subidoEn: registro.subidoEn,
      hojas: registro.hojas.map((h) => ({ nombre: h.nombre, totalFilas: h.totalFilas, totalColumnas: h.totalColumnas })),
    });
  } catch (err) {
    console.error('[admin/excel/subir] error:', err);
    res.status(500).json({ error: err.message || 'No se pudo leer ese Excel.' });
  }
});

router.get('/admin/excel/actual', requireAdmin, (_req, res) => {
  const registro = leerActual();
  if (!registro) return res.status(404).json({ error: 'Todavía no se subió ningún Excel.' });
  res.json(registro);
});

module.exports = { router };
