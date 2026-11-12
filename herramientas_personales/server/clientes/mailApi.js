/**
 * Cliente de la Mail API de Hostinger (https://docs.hostinger.com/emails/mail-api).
 * Manda los mails de primer contacto desde la casilla de Prisma y lee la bandeja
 * de entrada para detectar respuestas. Se configura en .env.local:
 *   MAIL_API_TOKEN   token creado en hPanel → Correos → Agentic Mail → API access
 *   MAIL_REMITENTE   casilla que envía (por defecto contacto@consultoraprisma.digital)
 *   MAIL_NOMBRE      nombre que ve el cliente (por defecto "Consultora Prisma")
 */
const BASE = process.env.MAIL_API_BASE || 'https://api.mail.hostinger.com/api/v1';
let buzon = null; // resourceId de la casilla remitente

function configurado() {
  return Boolean(process.env.MAIL_API_TOKEN);
}

function remitente() {
  return (process.env.MAIL_REMITENTE || 'contacto@consultoraprisma.digital').toLowerCase();
}

async function llamar(metodo, ruta, cuerpo) {
  if (!configurado()) throw new Error('Falta MAIL_API_TOKEN en .env.local.');
  const res = await fetch(BASE + ruta, {
    method: metodo,
    headers: { Authorization: `Bearer ${process.env.MAIL_API_TOKEN}`, Accept: 'application/json', ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 429) throw new Error('La API de mail pidió esperar (demasiados pedidos). Probá en unos minutos.');
    throw new Error(`API de mail (${res.status}): ${json.error || 'error'}${json.code ? ` [${json.code}]` : ''}`);
  }
  return json;
}

async function idBuzon() {
  if (buzon) return buzon;
  const r = await llamar('GET', '/me');
  const casillas = r?.data?.mailboxes || [];
  const elegida = casillas.find((m) => m.address.toLowerCase() === remitente()) || (casillas.length === 1 ? casillas[0] : null);
  if (!elegida) throw new Error(`El token no tiene acceso a ${remitente()}. Casillas disponibles: ${casillas.map((m) => m.address).join(', ') || 'ninguna'}.`);
  buzon = elegida.resourceId;
  return buzon;
}

/** Envía un mail. adjuntos: [{ filename, content (base64), contentType, cid? }]; enRespuestaA: { uid, folder } */
async function enviar({ para, asunto, html, texto, adjuntos = [], enRespuestaA }) {
  const id = await idBuzon();
  await llamar('POST', `/mailboxes/${id}/send`, {
    to: [para],
    displayName: process.env.MAIL_NOMBRE || 'Consultora Prisma',
    subject: asunto,
    html,
    text: texto,
    ...(adjuntos.length ? { attachments: adjuntos } : {}),
    ...(enRespuestaA ? { inReplyTo: enRespuestaA } : {}),
  });
}

/** Mensajes de la bandeja de entrada que vienen de una dirección, desde una fecha (AAAA-MM-DD). Más nuevos primero. */
async function buscarDe(direccion, desde) {
  const id = await idBuzon();
  const r = await llamar('POST', `/mailboxes/${id}/folders/INBOX/messages/search?perPage=10&sort=-date`, { from: direccion, ...(desde ? { since: desde } : {}) });
  return r?.data || [];
}

async function textoDe(uid) {
  const id = await idBuzon();
  const r = await llamar('GET', `/mailboxes/${id}/folders/INBOX/messages/${uid}/text`);
  return r?.data || { text: '', html: '' };
}

async function estado() {
  if (!configurado()) return { configurado: false };
  try { await idBuzon(); return { configurado: true, ok: true, remitente: remitente() }; }
  catch (err) { return { configurado: true, ok: false, error: err.message }; }
}

module.exports = { configurado, enviar, buscarDe, textoDe, estado, remitente };
