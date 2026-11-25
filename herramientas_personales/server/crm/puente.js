const { Router } = require('express');
const { leer, cambiar, randomUUID } = require('./store');
const { agenda } = require('./agenda');
const { hoyISO, sumarDias, normalizar } = require('./fechas');

/**
 * Puente con el bot de Discord "Viernes Clipper", que corre en el mismo VPS.
 * Solo acepta pedidos desde la propia máquina (127.0.0.1) y con la clave
 * PUENTE_CLAVE de .env.local. Sirve para:
 *   - leer la agenda del día (el bot manda los recordatorios al canal #recordatorios)
 *   - agendar lo que escribís en el canal #notas
 *   - guardar el contador de clips por día
 */
const router = Router();
const LOCAL = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

router.use((req, res, next) => {
  const clave = process.env.PUENTE_CLAVE;
  if (!clave || req.get('x-puente-clave') !== clave || !LOCAL.has(req.socket.remoteAddress)) {
    return res.status(403).json({ error: 'Sin acceso.' });
  }
  next();
});

const texto = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const hora = (v) => (/^\d{2}:\d{2}$/.test(String(v || '')) ? v : '');

router.get('/agenda', (req, res) => {
  const desde = normalizar(req.query.desde) || hoyISO();
  const hasta = normalizar(req.query.hasta) || desde;
  if (hasta < desde || sumarDias(desde, 31) < hasta) return res.status(400).json({ error: 'Rango inválido.' });
  res.json({ hoy: hoyISO(), dias: agenda(desde, hasta) });
});

router.post('/eventos', (req, res) => {
  const fecha = normalizar(req.body.fecha);
  const titulo = texto(req.body.titulo, 200);
  if (!fecha || !titulo) return res.status(400).json({ error: 'Faltan la fecha o el título.' });
  const ev = cambiar((d) => {
    const e = { id: randomUUID(), fecha, hora: hora(req.body.hora), titulo, notas: texto(req.body.notas), color: 'discord', origen: 'discord' };
    d.eventos.push(e);
    return e;
  });
  res.json(ev);
});

router.delete('/eventos/:id', (req, res) => {
  cambiar((d) => { d.eventos = d.eventos.filter((e) => e.id !== req.params.id); });
  res.json({ ok: true });
});

/** Contador de clips: { fecha, creados, aprobados, publicados } */
router.post('/clips', (req, res) => {
  const fecha = normalizar(req.body.fecha) || hoyISO();
  const n = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const r = cambiar((d) => {
    d.clips = d.clips || {};
    d.clips[fecha] = { creados: n(req.body.creados), aprobados: n(req.body.aprobados), publicados: n(req.body.publicados) };
    return d.clips[fecha];
  });
  res.json(r);
});

module.exports = { puenteRouter: router };
