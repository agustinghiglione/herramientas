const { Router } = require('express');
const multer = require('multer');
const { requireAdmin } = require('../adminAuth');
const { leer, cambiar, randomUUID } = require('./store');
const { leerPlan, tareasDePieza } = require('./plan');
const { agenda } = require('./agenda');
const { hoyISO, lunesDe, sumarDias, normalizar } = require('./fechas');
const mail = require('./mail');

/** API del CRM personal. Todo bajo /api/crm y con la misma sesión que el resto de Herramientas. */
const router = Router();
router.use(requireAdmin);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const ESTADOS = ['Pendiente', 'Creado', 'Publicado'];
const texto = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const hora = (v) => (/^\d{2}:\d{2}$/.test(String(v || '')) ? v : '');

// ---------- lectura ----------
router.get('/agenda', (req, res) => {
  const desde = normalizar(req.query.desde) || lunesDe(hoyISO());
  const hasta = normalizar(req.query.hasta) || sumarDias(desde, 6);
  if (hasta < desde || sumarDias(desde, 62) < hasta) return res.status(400).json({ error: 'Rango de fechas inválido.' });
  res.json({ hoy: hoyISO(), dias: agenda(desde, hasta) });
});

router.get('/resumen', (_req, res) => {
  const d = leer();
  res.json({
    hoy: hoyISO(),
    recurrentes: d.recurrentes,
    semanas: d.semanas.slice(-10).reverse(),
    mail: { configurado: mail.configurado(), hora: process.env.CRM_MAIL_HORA || '08:00', ultimoEnvio: d.mail.ultimoEnvio },
  });
});

// ---------- subir el Excel del plan ----------
router.post('/plan', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Arrastrá el Excel del plan semanal.' });
    const piezas = await leerPlan(req.file.buffer);
    const lunes = lunesDe(piezas[0].fecha);
    const resultado = cambiar((d) => {
      let nuevas = 0, actualizadas = 0, tareasNuevas = 0;
      for (const p of piezas) {
        const existente = d.contenidos.find((c) => c.fecha === p.fecha && c.formato === p.formato);
        if (existente) {
          Object.assign(existente, p, { estado: existente.estado || 'Pendiente', id: existente.id });
          actualizadas++;
        } else {
          d.contenidos.push({ ...p, id: randomUUID(), estado: ESTADOS.includes(p.estado) ? p.estado : 'Pendiente' });
          nuevas++;
        }
        const pieza = d.contenidos.find((c) => c.fecha === p.fecha && c.formato === p.formato);
        for (const t of tareasDePieza(pieza, lunes)) {
          const ya = d.tareas.find((x) => x.clave === t.clave);
          if (ya) Object.assign(ya, { titulo: t.titulo, detalle: t.detalle, fecha: t.fecha, ref: t.ref });
          else { d.tareas.push({ id: randomUUID(), hecha: false, origen: 'plan', ...t }); tareasNuevas++; }
        }
      }
      d.semanas.push({ lunes, archivo: texto(req.file.originalname, 200), subidoEn: new Date().toISOString(), piezas: piezas.length });
      return { lunes, piezas: piezas.length, nuevas, actualizadas, tareasNuevas };
    });
    res.json(resultado);
  } catch (err) {
    console.error('[crm/plan]', err);
    res.status(400).json({ error: err.message || 'No pude leer el Excel.' });
  }
});

// ---------- piezas de contenido ----------
router.patch('/contenidos/:id', (req, res) => {
  const r = cambiar((d) => {
    const c = d.contenidos.find((x) => x.id === req.params.id);
    if (!c) return null;
    if (req.body.estado && ESTADOS.includes(req.body.estado)) c.estado = req.body.estado;
    if (req.body.fecha && normalizar(req.body.fecha)) {
      const nueva = normalizar(req.body.fecha);
      d.tareas.filter((t) => t.ref === c.id && t.fecha === c.fecha).forEach((t) => { t.fecha = nueva; });
      c.fecha = nueva;
    }
    if ('notas' in req.body) c.notas = texto(req.body.notas);
    // Publicar la pieza también tilda su tarea de publicación.
    if (c.estado === 'Publicado') d.tareas.filter((t) => t.ref === c.id && String(t.clave).startsWith('pub:')).forEach((t) => { t.hecha = true; });
    return c;
  });
  if (!r) return res.status(404).json({ error: 'No existe esa pieza.' });
  res.json(r);
});

router.delete('/contenidos/:id', (req, res) => {
  cambiar((d) => {
    d.contenidos = d.contenidos.filter((c) => c.id !== req.params.id);
    d.tareas = d.tareas.filter((t) => t.ref !== req.params.id);
  });
  res.json({ ok: true });
});

// ---------- eventos personales ----------
router.post('/eventos', (req, res) => {
  const fecha = normalizar(req.body.fecha);
  const titulo = texto(req.body.titulo, 200);
  if (!fecha || !titulo) return res.status(400).json({ error: 'Faltan la fecha o el título.' });
  const e = cambiar((d) => {
    const ev = { id: randomUUID(), fecha, hora: hora(req.body.hora), titulo, notas: texto(req.body.notas), color: texto(req.body.color, 20) || 'personal' };
    d.eventos.push(ev);
    return ev;
  });
  res.json(e);
});

router.patch('/eventos/:id', (req, res) => {
  const e = cambiar((d) => {
    const ev = d.eventos.find((x) => x.id === req.params.id);
    if (!ev) return null;
    if (req.body.fecha && normalizar(req.body.fecha)) ev.fecha = normalizar(req.body.fecha);
    if ('hora' in req.body) ev.hora = hora(req.body.hora);
    if (req.body.titulo) ev.titulo = texto(req.body.titulo, 200);
    if ('notas' in req.body) ev.notas = texto(req.body.notas);
    return ev;
  });
  if (!e) return res.status(404).json({ error: 'No existe ese evento.' });
  res.json(e);
});

router.delete('/eventos/:id', (req, res) => {
  cambiar((d) => { d.eventos = d.eventos.filter((e) => e.id !== req.params.id); });
  res.json({ ok: true });
});

// ---------- tareas (objetivos del día) ----------
router.post('/tareas', (req, res) => {
  const fecha = normalizar(req.body.fecha);
  const titulo = texto(req.body.titulo, 200);
  if (!fecha || !titulo) return res.status(400).json({ error: 'Faltan la fecha o el título.' });
  const t = cambiar((d) => {
    const nueva = { id: randomUUID(), clave: `man:${randomUUID()}`, fecha, hora: hora(req.body.hora), titulo, detalle: texto(req.body.detalle), hecha: false, origen: 'manual' };
    d.tareas.push(nueva);
    return nueva;
  });
  res.json(t);
});

/** Tildar o destildar. Para una recurrente (id "rec:…") se crea el registro de ese día. */
router.patch('/tareas/:id', (req, res) => {
  const id = req.params.id;
  const t = cambiar((d) => {
    let tarea = d.tareas.find((x) => x.id === id || x.clave === id);
    if (!tarea && id.startsWith('rec:')) {
      const [, recId, fecha] = id.split(':');
      const r = d.recurrentes.find((x) => x.id === recId);
      if (!r || !normalizar(fecha)) return null;
      tarea = { id, clave: id, fecha, titulo: r.titulo, detalle: r.detalle, hora: r.hora, hecha: false, origen: 'recurrente' };
      d.tareas.push(tarea);
    }
    if (!tarea) return null;
    if ('hecha' in req.body) tarea.hecha = Boolean(req.body.hecha);
    if (req.body.titulo) tarea.titulo = texto(req.body.titulo, 200);
    if (req.body.fecha && normalizar(req.body.fecha)) tarea.fecha = normalizar(req.body.fecha);
    // Tildar "Publicar…" marca la pieza como publicada.
    if (tarea.hecha && tarea.ref && String(tarea.clave).startsWith('pub:')) {
      const c = d.contenidos.find((x) => x.id === tarea.ref);
      if (c) c.estado = 'Publicado';
    }
    return tarea;
  });
  if (!t) return res.status(404).json({ error: 'No existe esa tarea.' });
  res.json(t);
});

router.delete('/tareas/:id', (req, res) => {
  cambiar((d) => { d.tareas = d.tareas.filter((t) => t.id !== req.params.id); });
  res.json({ ok: true });
});

// ---------- recordatorios recurrentes ----------
router.post('/recurrentes', (req, res) => {
  const diaSemana = Number(req.body.diaSemana);
  const titulo = texto(req.body.titulo, 200);
  if (!(diaSemana >= 1 && diaSemana <= 7) || !titulo) return res.status(400).json({ error: 'Faltan el día o el título.' });
  const r = cambiar((d) => {
    const nuevo = { id: randomUUID(), diaSemana, hora: hora(req.body.hora), titulo, detalle: texto(req.body.detalle), activo: true, desde: hoyISO() };
    d.recurrentes.push(nuevo);
    return nuevo;
  });
  res.json(r);
});

router.delete('/recurrentes/:id', (req, res) => {
  cambiar((d) => { d.recurrentes = d.recurrentes.filter((r) => r.id !== req.params.id); });
  res.json({ ok: true });
});

// ---------- mail ----------
router.post('/mail/prueba', async (_req, res) => {
  try {
    await mail.enviarResumen(hoyISO());
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = { crmRouter: router };
