/**
 * Textos de Clientes Maps: la ficha que se copia al chat de informes, el borrador
 * del mail de primer contacto, el mail con el link de agenda y la clasificación
 * de las respuestas.
 */
const URL_PUBLICA = () => (process.env.PUBLIC_URL || 'https://herramientas.consultoraprisma.digital').replace(/\/$/, '');
const URL_DIAGNOSTICO = () => process.env.DIAGNOSTICO_URL || 'https://consultoraprisma.digital';
const FIRMA = () => (process.env.MAIL_FIRMA || 'El equipo de Consultora Prisma\nwww.consultoraprisma.digital').replace(/\\n/g, '\n');

function linkInforme(c) {
  return c.codigoPublico ? `${URL_PUBLICA()}/informe/${c.codigoPublico}` : '';
}

const linea = (etq, v) => (v ? `- ${etq}: ${v}\n` : '');

/** Ficha completa para pegar en el chat dedicado a informes y muestras web. */
function ficha(c) {
  const tieneWeb = c.presencia === 'Web propia' && c.webUrl;
  return `# Ficha de cliente: ${c.nombre}
Consultora Prisma · prospección Clientes Maps · id: ${c.id}

## Datos del negocio
${linea('Rubro', c.rubro)}${linea('Zona', c.zona)}${linea('Dirección', c.direccion)}${linea('Teléfono', c.telefono)}${linea('Email', c.email)}${linea('Google Maps', c.mapsUrl)}${linea('Web', c.webUrl)}${linea('Instagram', c.instagram)}${linea('Presencia online', c.presencia)}${linea('Tipo societario', c.tipo)}${linea('Señales de Google Maps', c.senal)}${linea('Prioridad', c.prioridad)}
## Gancho contable (interno)
${c.gancho || '(sin definir)'}

## Notas
${c.notas || '(sin notas)'}

## Qué necesito
1. Auditoría web con Cazador de webs. ${tieneWeb ? `Analizá ${c.webUrl}.` : 'No tiene web propia: analizá su presencia actual (Google Maps' + (c.instagram ? ', Instagram' : '') + ') y planteá su primera web.'}
2. Análisis de marca del negocio (sus redes y cómo se presenta), adaptado a un comercio, no a una persona.
3. Auditoría de negocio: a partir de las señales públicas, qué necesidades contables, impositivas y financieras es probable que tenga. Sin afirmar datos que no podemos saber desde afuera.
4. Muestra de la web: dos imágenes PNG de la primera versión, una de compu (1440 px de ancho) y una de celular (390 px de ancho), con el branding real del negocio.
5. Los informes como archivos HTML o PDF (uno por auditoría).
6. Al final, un bloque para pegar en el panel, exactamente con este formato:

\`\`\`json
{
  "resumenWeb": "3 a 5 hallazgos de la web, en lenguaje simple para el dueño",
  "resumenMarca": "2 o 3 hallazgos de marca",
  "resumenNegocio": "2 o 3 puntos de la auditoría de negocio",
  "ganchoMail": "1 o 2 frases para el cliente que conecten lo que vimos con el estudio contable, como pregunta y no como afirmación",
  "asunto": "asunto del mail de primer contacto",
  "cuerpo": "mail completo de primer contacto (sin firma), tuteando o de usted según el rubro"
}
\`\`\`
`;
}

/** Borrador del mail cuando el chat todavía no devolvió uno. */
function borrador(c) {
  const tieneWeb = c.presencia === 'Web propia';
  const link = linkInforme(c);
  const bloques = [
    'Hola, ¿cómo están?',
    `Somos Consultora Prisma, de la zona. Estuvimos mirando ${tieneWeb ? `la web de ${c.nombre}` : `cómo aparece ${c.nombre} en Google`} y les preparamos, sin costo, ${tieneWeb ? 'un estudio de su web y una muestra de cómo podría verse renovada' : 'una muestra de cómo podría verse su primera web'}, en compu y en celular.${c.imgCompu || c.imgCelu ? ' Va en las imágenes de este mail.' : ''}`,
    c.resumenWeb ? `Lo que encontramos:\n${c.resumenWeb}` : '',
    c.resumenNegocio ? c.resumenNegocio : '',
    c.ganchoMail || '',
    link ? `El informe completo está acá: ${link}` : '',
    `Si quieren ir un paso más, el diagnóstico Prisma es gratis y toma unos minutos: ${URL_DIAGNOSTICO()}`,
    'Si prefieren que no les escribamos más, respondan "no" y no los volvemos a contactar.',
  ];
  return {
    asunto: tieneWeb ? `${c.nombre}: un estudio de su web y una propuesta` : `${c.nombre}: así podría verse su primera web`,
    cuerpo: bloques.filter(Boolean).join('\n\n'),
  };
}

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const enlazar = (s) => s.replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" style="color:#345b78">${u}</a>`);

/** HTML del mail: el texto del panel en párrafos, las imágenes de la muestra y la firma. */
function htmlMail(cuerpo, { conCompu, conCelu, link }) {
  const parrafos = String(cuerpo).trim().split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;line-height:1.55">${enlazar(escHtml(p)).replace(/\n/g, '<br>')}</p>`).join('');
  const imgs = [conCompu ? '<img src="cid:muestra-compu" alt="Muestra de la web en compu" style="width:100%;max-width:560px;border:1px solid #e7ddc9;border-radius:8px;display:block;margin:0 0 12px">' : '',
    conCelu ? '<img src="cid:muestra-celu" alt="Muestra de la web en celular" style="width:220px;max-width:60%;border:1px solid #e7ddc9;border-radius:14px;display:block;margin:0 0 12px">' : ''].join('');
  const boton = link ? `<p style="margin:6px 0 18px"><a href="${link}" style="background:#223c54;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block">Ver el informe y la muestra</a></p>` : '';
  const firma = escHtml(FIRMA()).replace(/\n/g, '<br>');
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#223c54;font-size:15px;max-width:600px">${parrafos}${imgs}${boton}<p style="margin:18px 0 0;color:#5b6672;font-size:14px">${enlazar(firma)}</p></div>`;
}

function textoMail(cuerpo) {
  return `${String(cuerpo).trim()}\n\n${FIRMA()}`;
}

/** Respuesta automática a quien mostró interés: link para agendar. */
function mailAgenda(c) {
  const cuerpo = `¡Gracias por responder!\n\nPara que lo charlemos con calma, elegí el horario que te quede cómodo para una reunión virtual corta: ${process.env.AGENDA_URL}\n\nSi preferís que te llamemos, respondé con un día, un horario y un teléfono, y te contactamos.`;
  return { asunto: `Re: ${c.asuntoMail || 'Consultora Prisma'}`, cuerpo };
}

// ---------- respuestas ----------
const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Quita la parte citada del mail original ("> …", "El … escribió:", "On … wrote:"). */
function soloRespuesta(texto) {
  const lineas = String(texto || '').replace(/\r/g, '').split('\n');
  const out = [];
  for (const l of lineas) {
    if (/^\s*>/.test(l)) break;
    if (/^\s*(el|on)\s.+(escribi[oó]|wrote)\s*:?\s*$/i.test(l)) break;
    if (/^-{2,}\s*(mensaje original|original message)/i.test(l)) break;
    if (/^\s*(de|from):\s.+@/i.test(l) && out.length) break;
    out.push(l);
  }
  return out.join('\n').trim();
}

const NEGATIVAS = ['no me interesa', 'no nos interesa', 'no estamos interesad', 'no estoy interesad', 'no gracias', 'no, gracias', 'no necesit',
  'ya tenemos contador', 'ya tengo contador', 'ya tenemos estudio', 'ya tenemos un estudio', 'ya tengo un estudio', 'ya trabajamos con',
  'dar de baja', 'darme de baja', 'denme de baja', 'no me escriban', 'no nos escriban', 'no vuelvan', 'no molesten', 'eliminen', 'quitar de la lista',
  'borrar de la lista', 'no por ahora', 'no por el momento', 'no es para nosotros', 'no se si', 'no creo', 'no quiero', 'no hace falta',
  'no lo necesit', 'no me manden', 'no nos manden', 'no manden', 'no envien', 'no me envien', 'no estoy buscando', 'no estamos buscando'];
// Con estas palabras una respuesta "positiva" igual queda para revisar a mano.
const DUDAS = [' pero ', 'mas adelante', 'mas tarde', 'despues', 'el ano que viene', 'en otro momento', 'lo veo', 'lo pienso', 'lo consulto', 'lo hablo'];
const POSITIVAS = ['me interesa', 'nos interesa', 'interesad', 'agend', 'reunion', 'reunir', 'llamen', 'llamame', 'llamenme', 'llamada', 'hablemos', 'charlemos',
  'coordinemos', 'cuando podemos', 'cuando pueden', 'podemos hablar', 'me gustaria', 'nos gustaria', 'presupuesto', 'precio', 'costo', 'cuanto sale',
  'cuanto cuesta', 'mas informacion', 'mas info', 'contame', 'cuentenme', 'quiero saber', 'me sirve', 'nos sirve'];
const AUTOMATICAS = ['respuesta automatica', 'auto-reply', 'autoreply', 'automatic reply', 'fuera de la oficina', 'out of office', 'de vacaciones', 'mensaje automatico'];

/**
 * Clasifica sin IA, con frases claras. Ante la duda queda "revisar" y no se responde solo:
 * mandarle el link de agenda a alguien que dijo que no quema el contacto.
 */
function clasificar(asunto, texto) {
  const a = sinAcentos(asunto), t = sinAcentos(texto);
  if (AUTOMATICAS.some((k) => a.includes(k) || t.includes(k))) return 'automatica';
  if (/^\s*no[\s.!,]*$/.test(t) || NEGATIVAS.some((k) => t.includes(k))) return 'no_interesado';
  const positiva = POSITIVAS.some((k) => t.includes(k)) || /^\s*(si|dale|ok|okey|perfecto|genial|buenisimo)\b/.test(t);
  if (positiva && !DUDAS.some((k) => ` ${t} `.includes(k))) return 'interesado';
  return 'revisar';
}

const CLASES = { interesado: 'Interesado', no_interesado: 'No interesado', revisar: 'Revisar', automatica: 'Respuesta automática' };

module.exports = { ficha, borrador, htmlMail, textoMail, mailAgenda, soloRespuesta, clasificar, CLASES, linkInforme, URL_PUBLICA, URL_DIAGNOSTICO };
