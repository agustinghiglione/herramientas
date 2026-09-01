const { Router } = require('express');
const multer = require('multer');
const { extraerTexto } = require('./extraerTexto');
const { limpiarDocumento } = require('./ia');
const { generarPdf } = require('./generarPdf');

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

module.exports = { router };
