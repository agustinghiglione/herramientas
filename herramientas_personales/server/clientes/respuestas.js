const sheet = require('./sheet');
const mailApi = require('./mailApi');
const { soloRespuesta, clasificar, mailAgenda, htmlMail, textoMail } = require('./plantillas');
const { hoyISO } = require('../crm/fechas');

/**
 * Revisa la bandeja de entrada cada MAIL_REVISAR_MIN minutos (10 por defecto).
 * Para cada cliente "Contactado" con mail enviado busca mensajes que vengan de su
 * dirección después del envío. Si hay uno:
 *   - pasa al cliente a "Respondió" y guarda la respuesta y su clasificación;
 *   - si la respuesta es claramente de interés y AUTO_AGENDA no está en "false",
 *     le contesta en el mismo hilo con el link para agendar (AGENDA_URL), una sola vez.
 * Las respuestas automáticas (fuera de la oficina) se anotan pero no cambian el estado.
 */
let corriendo = false;
let ultimaRevision = null;

const autoAgenda = () => process.env.AUTO_AGENDA !== 'false' && Boolean(process.env.AGENDA_URL);

async function enviarAgenda(cliente, uid) {
  const { asunto, cuerpo } = mailAgenda(cliente);
  await mailApi.enviar({
    para: cliente.email, asunto,
    html: htmlMail(cuerpo, {}), texto: textoMail(cuerpo),
    enRespuestaA: uid ? { uid: Number(uid), folder: 'INBOX' } : undefined,
  });
  return sheet.actualizar(cliente.id, { agendaEnviada: new Date().toISOString(), proximoPaso: 'Esperar a que agende la reunión', ultimoContacto: hoyISO() });
}

async function revisarCliente(c) {
  const desde = String(c.fechaEnvio).slice(0, 10);
  const mensajes = (await mailApi.buscarDe(c.email, desde))
    .filter((m) => m.from && m.from.address.toLowerCase() === c.email.toLowerCase())
    .filter((m) => new Date(m.date) >= new Date(c.fechaEnvio));
  if (!mensajes.length) return null;
  const m = mensajes[0];
  if (String(m.uid) === String(c.respuestaUid)) return null;

  const contenido = await mailApi.textoDe(m.uid);
  const texto = soloRespuesta(contenido.text || contenido.html.replace(/<[^>]+>/g, ' ')).slice(0, 4000);
  const clase = clasificar(m.subject, texto);
  const cambios = { respuesta: texto, respuestaFecha: m.date, respuestaClase: clase, respuestaUid: String(m.uid) };

  if (clase === 'automatica') {
    await sheet.actualizar(c.id, cambios);
    return { id: c.id, clase };
  }
  cambios.estadoContacto = 'Respondió';
  cambios.ultimoContacto = hoyISO();
  cambios.proximoPaso = clase === 'interesado' ? (autoAgenda() ? 'Se le mandó el link para agendar' : 'Mandarle el link para agendar')
    : clase === 'no_interesado' ? 'Dijo que no: confirmar y pasar a Descartado' : 'Leer la respuesta y contestar';
  let actualizado = await sheet.actualizar(c.id, cambios);
  if (clase === 'interesado' && autoAgenda() && !c.agendaEnviada) {
    try { actualizado = await enviarAgenda(actualizado, m.uid); }
    catch (err) { console.error(`[clientes] no pude mandar la agenda a ${c.id}:`, err.message); await sheet.actualizar(c.id, { proximoPaso: 'Mandarle el link para agendar (falló el envío automático)' }); }
  }
  return { id: c.id, clase };
}

async function revisar() {
  if (corriendo) return { omitido: true };
  if (!mailApi.configurado() || !sheet.configurado()) return { omitido: true, motivo: 'Falta configurar la planilla o la API de mail.' };
  corriendo = true;
  const resultados = [];
  try {
    const { clientes, origen } = await sheet.listar({ forzar: true });
    if (origen !== 'planilla') return { omitido: true, motivo: 'La planilla no responde.' };
    const pendientes = clientes.filter((c) => c.email && c.fechaEnvio && c.estadoContacto === 'Contactado');
    for (const c of pendientes) {
      try { const r = await revisarCliente(c); if (r) resultados.push(r); }
      catch (err) { console.error(`[clientes] error revisando ${c.id}:`, err.message); }
      await new Promise((ok) => setTimeout(ok, 400)); // sin apurar a la API
    }
    ultimaRevision = new Date().toISOString();
    return { revisados: pendientes.length, nuevas: resultados };
  } finally {
    corriendo = false;
  }
}

function iniciar() {
  if (!mailApi.configurado() || !sheet.configurado()) {
    console.log('[clientes] revisión de respuestas desactivada (falta MAIL_API_TOKEN o la planilla).');
    return;
  }
  const minutos = Math.max(2, Number(process.env.MAIL_REVISAR_MIN) || 10);
  setInterval(() => revisar().catch((err) => console.error('[clientes] revisión:', err.message)), minutos * 60 * 1000);
  console.log(`[clientes] revisando respuestas cada ${minutos} min${autoAgenda() ? ' · agenda automática activada' : ''}.`);
}

module.exports = { revisar, iniciar, enviarAgenda, autoAgenda, ultima: () => ultimaRevision };
