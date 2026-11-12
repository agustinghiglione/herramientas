/**
 * Columnas de la planilla Clientes_Maps (pestaña "Clientes"). El orden es el
 * de la planilla; si se agrega una columna nueva acá, el Apps Script la suma
 * sola al final de la fila de encabezados la próxima vez que guarda.
 */
const COLUMNAS = [
  // datos del negocio (salen de Google Maps)
  'id', 'nombre', 'rubro', 'zona', 'direccion', 'telefono', 'email', 'mapsUrl', 'webUrl', 'instagram',
  'presencia', 'tipo', 'senal', 'prioridad',
  // estrategia
  'gancho', 'oferta',
  // trabajo del chat de informes
  'resumenWeb', 'resumenMarca', 'resumenNegocio', 'ganchoMail',
  'imgCompu', 'imgCelu', 'informeWeb', 'informeMarca', 'informeNegocio', 'codigoPublico',
  // seguimiento
  'estadoWeb', 'estadoContacto', 'diagnostico', 'proximoPaso', 'notas', 'ultimoContacto',
  // mail
  'asuntoMail', 'cuerpoMail', 'fechaEnvio',
  'respuesta', 'respuestaFecha', 'respuestaClase', 'respuestaUid', 'agendaEnviada',
  'actualizadoEn',
];

const ESTADOS_WEB = ['Pendiente', 'Cazador en curso', 'Diagnóstico listo', 'Muestra en diseño', 'Muestra lista', 'Enviada al cliente'];
const ESTADOS_CONTACTO = ['Sin contactar', 'Contactado', 'Respondió', 'Reunión agendada', 'Cliente', 'Descartado'];
const DIAGNOSTICO = ['No invitado', 'Invitado', 'Completado'];
const PRESENCIA = ['Web propia', 'Solo redes', 'Sin web'];
const PRIORIDAD = ['Alta', 'Media', 'Baja'];

// Campos que solo escribe el servidor (archivos, envíos, respuestas): el panel no los pisa con un PATCH.
const SOLO_SERVIDOR = new Set(['id', 'imgCompu', 'imgCelu', 'informeWeb', 'informeMarca', 'informeNegocio', 'codigoPublico',
  'fechaEnvio', 'respuesta', 'respuestaFecha', 'respuestaClase', 'respuestaUid', 'agendaEnviada', 'actualizadoEn']);

const LIMITES = { cuerpoMail: 8000, respuesta: 4000, resumenWeb: 4000, resumenMarca: 4000, resumenNegocio: 4000, notas: 4000, gancho: 2000, ganchoMail: 2000 };

/** Deja solo columnas conocidas, como texto, recortadas. */
function limpiar(obj, { permitirServidor = false } = {}) {
  const out = {};
  for (const k of COLUMNAS) {
    if (!(k in obj)) continue;
    if (!permitirServidor && SOLO_SERVIDOR.has(k)) continue;
    out[k] = String(obj[k] ?? '').trim().slice(0, LIMITES[k] || 1000);
  }
  return out;
}

function vacio(nombre) {
  return {
    ...Object.fromEntries(COLUMNAS.map((c) => [c, ''])),
    nombre, prioridad: 'Media', presencia: 'Sin web',
    estadoWeb: 'Pendiente', estadoContacto: 'Sin contactar', diagnostico: 'No invitado',
  };
}

function slug(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'cliente';
}

const ID_VALIDO = /^[a-z0-9][a-z0-9-]{0,79}$/;

module.exports = { COLUMNAS, ESTADOS_WEB, ESTADOS_CONTACTO, DIAGNOSTICO, PRESENCIA, PRIORIDAD, SOLO_SERVIDOR, limpiar, vacio, slug, ID_VALIDO };
