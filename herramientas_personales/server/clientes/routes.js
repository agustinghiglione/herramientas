const fs = require('fs');
const { Router } = require('express');
const multer = require('multer');
const { requireAdmin } = require('../adminAuth');
const { hoyISO } = require('../crm/fechas');
const sheet = require('./sheet');
const mailApi = require('./mailApi');
const archivos = require('./archivos');
const respuestas = require('./respuestas');
const { leerArchivo, combinar, exportar } = require('./importar');
const P = require('./plantillas');
const { limpiar, vacio, slug, ID_VALIDO, ESTADOS_WEB, ESTADOS_CONTACTO, DIAGNOSTICO, PRESENCIA, PRIORIDAD } = require('./columnas');

/** API de Clientes Maps: /api/crm/clientes (con la sesión del panel). */
const router = Router();
router.use(requireAdmin);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const envolver = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (err) { console.error('[clientes]', req.method, req.path, err.message); res.status(err.status || 400).json({ error: err.message || 'Error' }); }
};
const noExiste = () => Object.assign(new Error('No existe ese cliente.'), { status: 404 });
async function cliente(id) {
  if (!ID_VALIDO.test(id)) throw noExiste();
  const c = await sheet.obtener(id);
  if (!c) throw noExiste();
  return c;
}

router.get('/', envolver(async (req, res) => {
  const r = await sheet.listar({ forzar: req.query.forzar === '1' });
  res.json({
    ...r,
    opciones: { ESTADOS_WEB, ESTADOS_CONTACTO, DIAGNOSTICO, PRESENCIA, PRIORIDAD },
    estado: {
      planilla: sheet.configurado(),
      mail: mailApi.configurado(),
      remitente: mailApi.remitente(),
      autoAgenda: respuestas.autoAgenda(),
      agendaUrl: process.env.AGENDA_URL || '',
      diagnosticoUrl: P.URL_DIAGNOSTICO(),
      ultimaRevision: respuestas.ultima(),
    },
  });
}));

router.get('/estado-mail', envolver(async (_req, res) => res.json(await mailApi.estado())));

router.post('/importar', upload.single('archivo'), envolver(async (req, res) => {
  if (!req.file) throw new Error('Elegí el archivo con los clientes (.xlsx o .csv).');
  if (!/\.(xlsx|csv)$/i.test(req.file.originalname)) throw new Error('Tiene que ser un .xlsx o un .csv.');
  const filas = await leerArchivo(req.file.buffer, req.file.originalname);
  const { clientes, origen } = await sheet.listar({ forzar: true });
  if (origen !== 'planilla') throw new Error('La planilla no responde: no importo para no pisar datos.');
  const lote = combinar(filas, clientes);
  const r = await sheet.guardarVarios(lote);
  res.json({ leidos: filas.length, creados: r.creados, actualizados: r.actualizados });
}));

router.get('/exportar', envolver(async (_req, res) => {
  const { clientes } = await sheet.listar({ forzar: true });
  const buf = await exportar(clientes);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="clientes-maps-${hoyISO()}.xlsx"`);
  res.send(Buffer.from(buf));
}));

router.post('/revisar', envolver(async (_req, res) => res.json(await respuestas.revisar())));

router.post('/', envolver(async (req, res) => {
  const nombre = String(req.body.nombre || '').trim();
  if (!nombre) throw new Error('Falta el nombre del negocio.');
  const { clientes } = await sheet.listar({ forzar: true });
  let id = slug(nombre), i = 2;
  while (clientes.some((c) => c.id === id)) id = `${slug(nombre)}-${i++}`;
  const nuevo = { ...vacio(nombre), ...limpiar(req.body), id, actualizadoEn: new Date().toISOString() };
  nuevo.oferta = nuevo.oferta || (nuevo.presencia === 'Web propia' ? 'Estudio de su web + muestra de rediseño' : 'Muestra gratis de su primera web');
  await sheet.guardarVarios([nuevo]);
  res.json(await sheet.obtener(id));
}));

router.patch('/:id', envolver(async (req, res) => {
  await cliente(req.params.id);
  const cambios = limpiar(req.body);
  if (cambios.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cambios.email)) throw new Error('El mail no parece válido.');
  if (!Object.keys(cambios).length) return res.json(await sheet.obtener(req.params.id));
  res.json(await sheet.actualizar(req.params.id, cambios));
}));

router.delete('/:id', envolver(async (req, res) => {
  await cliente(req.params.id);
  await sheet.eliminar(req.params.id);
  res.json({ ok: true });
}));

router.get('/:id/ficha', envolver(async (req, res) => res.json({ texto: P.ficha(await cliente(req.params.id)) })));

// ---------- archivos ----------
router.post('/:id/archivos/:tipo', upload.single('archivo'), envolver(async (req, res) => {
  const c = await cliente(req.params.id);
  if (!req.file) throw new Error('Elegí un archivo.');
  const { campo, nombre } = archivos.guardar(c.id, req.params.tipo, req.file.originalname, req.file.buffer);
  const cambios = { [campo]: nombre };
  if (!c.codigoPublico) cambios.codigoPublico = archivos.codigoNuevo();
  if (req.params.tipo === 'compu' || req.params.tipo === 'celu') {
    const otra = req.params.tipo === 'compu' ? c.imgCelu : c.imgCompu;
    if (otra && ['Pendiente', 'Cazador en curso', 'Diagnóstico listo', 'Muestra en diseño'].includes(c.estadoWeb)) cambios.estadoWeb = 'Muestra lista';
  }
  res.json(await sheet.actualizar(c.id, limpiar(cambios, { permitirServidor: true })));
}));

router.delete('/:id/archivos/:tipo', envolver(async (req, res) => {
  const c = await cliente(req.params.id);
  const { campo } = archivos.borrar(c.id, req.params.tipo);
  res.json(await sheet.actualizar(c.id, { [campo]: '' }));
}));

router.get('/:id/archivos/:nombre', envolver(async (req, res) => {
  const c = await cliente(req.params.id);
  const p = archivos.ruta(c.id, req.params.nombre);
  if (!p) throw noExiste();
  res.setHeader('Content-Type', archivos.mime(p));
  if (/\.html$/.test(p)) res.setHeader('Content-Security-Policy', 'sandbox allow-scripts allow-popups');
  res.send(fs.readFileSync(p));
}));

// ---------- mail ----------
router.post('/:id/borrador', envolver(async (req, res) => res.json(P.borrador(await cliente(req.params.id)))));

router.post('/:id/enviar', envolver(async (req, res) => {
  const c = await cliente(req.params.id);
  const asunto = String(req.body.asunto || '').trim().slice(0, 300);
  const cuerpo = String(req.body.cuerpo || '').trim().slice(0, 8000);
  if (!c.email) throw new Error('El cliente no tiene mail cargado.');
  if (!asunto || !cuerpo) throw new Error('Faltan el asunto o el texto del mail.');
  if (c.fechaEnvio && req.body.reenviar !== true) throw new Error(`Ya se le mandó el primer mail el ${c.fechaEnvio.slice(0, 10)}. Si querés mandarlo de nuevo, confirmalo.`);

  const adjuntos = [];
  for (const [tipo, cid] of [['imgCompu', 'muestra-compu'], ['imgCelu', 'muestra-celu']]) {
    const p = c[tipo] && archivos.ruta(c.id, c[tipo]);
    if (p) adjuntos.push({ filename: `${cid}${p.slice(p.lastIndexOf('.'))}`, content: fs.readFileSync(p).toString('base64'), contentType: archivos.mime(p), cid });
  }
  const link = P.linkInforme(c);
  await mailApi.enviar({
    para: c.email, asunto,
    html: P.htmlMail(cuerpo, { conCompu: adjuntos.some((a) => a.cid === 'muestra-compu'), conCelu: adjuntos.some((a) => a.cid === 'muestra-celu'), link }),
    texto: P.textoMail(cuerpo) + (link ? `\n\nInforme y muestra: ${link}` : ''),
    adjuntos,
  });
  const cambios = {
    asuntoMail: asunto, cuerpoMail: cuerpo, fechaEnvio: new Date().toISOString(), ultimoContacto: hoyISO(),
    estadoContacto: ['Sin contactar', 'Contactado'].includes(c.estadoContacto) ? 'Contactado' : c.estadoContacto,
    proximoPaso: 'Esperar respuesta (el panel la detecta solo)',
    respuesta: '', respuestaFecha: '', respuestaClase: '', respuestaUid: '', agendaEnviada: '',
  };
  if (cuerpo.includes(P.URL_DIAGNOSTICO()) && c.diagnostico !== 'Completado') cambios.diagnostico = 'Invitado';
  if (adjuntos.length || link) cambios.estadoWeb = 'Enviada al cliente';
  res.json(await sheet.actualizar(c.id, limpiar(cambios, { permitirServidor: true })));
}));

router.post('/:id/agenda', envolver(async (req, res) => {
  const c = await cliente(req.params.id);
  if (!process.env.AGENDA_URL) throw new Error('Falta AGENDA_URL (el link de Google Calendar para agendar) en .env.local.');
  if (!c.email) throw new Error('El cliente no tiene mail cargado.');
  res.json(await respuestas.enviarAgenda(c, c.respuestaUid));
}));

// ---------- página pública del informe (sin sesión) ----------
const publico = Router();
const CODIGO = /^[A-Za-z0-9_-]{20,40}$/;

async function porCodigo(codigo) {
  if (!CODIGO.test(codigo || '')) return null;
  const { clientes } = await sheet.listar();
  return clientes.find((c) => c.codigoPublico === codigo) || null;
}

publico.get('/informe/:codigo', async (req, res) => {
  const c = await porCodigo(req.params.codigo).catch(() => null);
  res.setHeader('X-Robots-Tag', 'noindex');
  if (!c) return res.status(404).send(paginaPublica(null));
  res.send(paginaPublica(c));
});

publico.get('/informe/:codigo/:nombre', async (req, res) => {
  const c = await porCodigo(req.params.codigo).catch(() => null);
  const p = c && archivos.ruta(c.id, req.params.nombre);
  if (!p) return res.status(404).send('No encontrado');
  res.setHeader('Content-Type', archivos.mime(p));
  res.setHeader('X-Robots-Tag', 'noindex');
  // Los informes HTML se muestran aislados: no pueden leer nada del panel.
  if (/\.html$/.test(p)) res.setHeader('Content-Security-Policy', 'sandbox allow-scripts allow-popups');
  res.send(fs.readFileSync(p));
});

function paginaPublica(c) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const base = c ? `/informe/${c.codigoPublico}/` : '';
  const informes = c ? [['informeWeb', 'Auditoría web'], ['informeMarca', 'Análisis de marca'], ['informeNegocio', 'Auditoría de negocio']]
    .filter(([k]) => c[k]).map(([k, t]) => `<a class="inf" href="${base}${esc(c[k])}" target="_blank" rel="noopener">${t}<span>${c[k].endsWith('.pdf') ? 'PDF' : 'Abrir'} →</span></a>`).join('') : '';
  const cuerpo = !c ? '<h1>Este informe no está disponible</h1><p>El link puede haber vencido. Escribinos a contacto@consultoraprisma.digital.</p>' : `
    <p class="eyebrow">Preparado por Consultora Prisma para</p><h1>${esc(c.nombre)}</h1>
    ${c.imgCompu || c.imgCelu ? `<h2>Así podría verse ${c.presencia === 'Web propia' ? 'su web renovada' : 'su primera web'}</h2>
    <div class="muestras">${c.imgCompu ? `<figure class="compu"><img src="${base}${esc(c.imgCompu)}" alt="Muestra en compu"><figcaption>En compu</figcaption></figure>` : ''}${c.imgCelu ? `<figure class="celu"><img src="${base}${esc(c.imgCelu)}" alt="Muestra en celular"><figcaption>En celular</figcaption></figure>` : ''}</div>` : ''}
    ${informes ? `<h2>Informes</h2><div class="informes">${informes}</div>` : ''}
    <div class="cta"><h2>¿Seguimos?</h2><p>El diagnóstico Prisma es gratis y toma unos minutos.</p><a class="btn" href="${esc(P.URL_DIAGNOSTICO())}" target="_blank" rel="noopener">Hacer el diagnóstico</a>${process.env.AGENDA_URL ? ` <a class="btn sec" href="${esc(process.env.AGENDA_URL)}" target="_blank" rel="noopener">Agendar una reunión</a>` : ''}</div>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${c ? esc(c.nombre) + ' · ' : ''}Consultora Prisma</title>
<style>:root{--bg:#faf8f5;--ink:#223c54;--soft:#5b6672;--line:#e7ddc9;--gold:#e4b15e;--card:#fff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 Inter,Arial,sans-serif}
main{max-width:1040px;margin:0 auto;padding:40px 20px 64px}.eyebrow{margin:0;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--soft)}
h1{margin:4px 0 28px;font-size:clamp(28px,5vw,40px);line-height:1.15}h2{font-size:20px;margin:32px 0 14px}
.muestras{display:flex;gap:20px;align-items:flex-end;flex-wrap:wrap}figure{margin:0}figure img{display:block;width:100%;border:1px solid var(--line);border-radius:10px;background:#fff}
.compu{flex:1 1 560px;min-width:0}.celu{flex:0 0 230px}.celu img{border-radius:22px}figcaption{font-size:13px;color:var(--soft);margin-top:6px}
.informes{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.inf{display:flex;justify-content:space-between;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;color:var(--ink);text-decoration:none;font-weight:600}.inf span{color:var(--soft);font-weight:400}
.cta{margin-top:40px;background:var(--ink);color:#fff;border-radius:14px;padding:24px}.cta h2{margin:0 0 6px}.cta p{margin:0 0 16px;opacity:.85}
.btn{display:inline-block;background:var(--gold);color:var(--ink);text-decoration:none;font-weight:700;padding:10px 16px;border-radius:8px;margin:4px 6px 0 0}.btn.sec{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5)}
footer{margin-top:36px;font-size:13px;color:var(--soft)}</style></head>
<body><main>${cuerpo}<footer>Consultora Prisma · www.consultoraprisma.digital</footer></main></body></html>`;
}

module.exports = { clientesRouter: router, informePublico: publico };
