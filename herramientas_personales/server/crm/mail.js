const { leer, cambiar } = require('./store');
const { agenda } = require('./agenda');
const { hoyISO, horaAR, diaSemana, NOMBRES } = require('./fechas');

/**
 * Resumen diario por mail: objetivos del día, piezas a publicar y eventos.
 * Se configura con variables de entorno en .env.local:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, CRM_MAIL_TO, CRM_MAIL_HORA (por defecto 08:00)
 * Si faltan, el CRM funciona igual y solo muestra los recordatorios en el panel.
 */
function configurado() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.CRM_MAIL_TO);
}

function esc(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function armarResumen(fecha) {
  const [dia] = agenda(fecha, fecha);
  const titulo = `${NOMBRES[diaSemana(fecha)]} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
  const li = (items) => items.map((x) => `<li style="margin:6px 0">${x}</li>`).join('');
  const tareas = dia.tareas.filter((t) => !t.hecha);
  const html = `<div style="font-family:Arial,sans-serif;color:#223c54;max-width:560px">
<p style="font-size:12px;letter-spacing:.14em;color:#345b78;margin:0">CONSULTORA PRISMA · TU DÍA</p>
<h2 style="margin:6px 0 18px">${esc(titulo)}</h2>
<h3 style="margin:0 0 6px">Objetivos (${tareas.length})</h3><ul>${li(tareas.map((t) => `${t.hora ? `<b>${esc(t.hora)}</b> · ` : ''}${esc(t.titulo)}<br><span style="color:#5b6672;font-size:13px">${esc(t.detalle)}</span>`)) || '<li>Nada pendiente.</li>'}</ul>
${dia.contenidos.length ? `<h3 style="margin:18px 0 6px">Para publicar hoy</h3><ul>${li(dia.contenidos.map((c) => `<b>${esc(c.formato)}</b> · ${esc(c.idea_ganadora)}`))}</ul>` : ''}
${dia.eventos.length ? `<h3 style="margin:18px 0 6px">Agenda personal</h3><ul>${li(dia.eventos.map((e) => `${e.hora ? `<b>${esc(e.hora)}</b> · ` : ''}${esc(e.titulo)}`))}</ul>` : ''}
<p style="margin-top:22px;font-size:13px;color:#5b6672">Detalles completos (descripción, hashtags, stickers) en el panel del CRM.</p></div>`;
  return { asunto: `Tu día · ${titulo} · ${tareas.length} objetivo${tareas.length === 1 ? '' : 's'}`, html };
}

async function enviarResumen(fecha = hoyISO()) {
  if (!configurado()) throw new Error('Faltan las variables SMTP_* o CRM_MAIL_TO en .env.local.');
  const nodemailer = require('nodemailer');
  const puerto = Number(process.env.SMTP_PORT || 465);
  const transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: puerto, secure: puerto === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const { asunto, html } = armarResumen(fecha);
  await transporte.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: process.env.CRM_MAIL_TO, subject: asunto, html });
}

/** Revisa cada minuto si ya es la hora del resumen; manda uno solo por día. */
function iniciarProgramador() {
  if (!configurado()) {
    console.log('[crm] mail diario desactivado (faltan variables SMTP).');
    return;
  }
  const hora = process.env.CRM_MAIL_HORA || '08:00';
  setInterval(async () => {
    const hoy = hoyISO();
    if (horaAR() < hora || leer().mail.ultimoEnvio === hoy) return;
    cambiar((d) => { d.mail.ultimoEnvio = hoy; });
    try {
      await enviarResumen(hoy);
      console.log('[crm] resumen diario enviado', hoy);
    } catch (err) {
      console.error('[crm] no se pudo enviar el resumen:', err.message);
    }
  }, 60 * 1000);
  console.log(`[crm] mail diario activado a las ${hora} (hora de Argentina).`);
}

module.exports = { configurado, enviarResumen, iniciarProgramador, armarResumen };
