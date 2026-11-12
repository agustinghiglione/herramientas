const fs = require('fs');
const path = require('path');
const { randomBytes } = require('node:crypto');
const { ID_VALIDO } = require('./columnas');

/**
 * Archivos de cada cliente (imágenes de la muestra web e informes), guardados en el
 * servidor en server/data/clientes/<id>/. La planilla solo guarda el nombre del archivo.
 * Conviene incluir esta carpeta en el backup junto con crm.json.
 */
const DIR = path.join(__dirname, '..', 'data', 'clientes');

const TIPOS = {
  compu: { campo: 'imgCompu', ext: ['png', 'jpg', 'jpeg', 'webp'], etiqueta: 'Muestra web · compu' },
  celu: { campo: 'imgCelu', ext: ['png', 'jpg', 'jpeg', 'webp'], etiqueta: 'Muestra web · celular' },
  informeWeb: { campo: 'informeWeb', ext: ['html', 'pdf'], etiqueta: 'Auditoría web' },
  informeMarca: { campo: 'informeMarca', ext: ['html', 'pdf'], etiqueta: 'Análisis de marca' },
  informeNegocio: { campo: 'informeNegocio', ext: ['html', 'pdf'], etiqueta: 'Auditoría de negocio' },
};

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', html: 'text/html; charset=utf-8', pdf: 'application/pdf' };
const NOMBRE_VALIDO = /^(compu|celu|informeWeb|informeMarca|informeNegocio)\.(png|jpe?g|webp|html|pdf)$/;

function carpeta(id) {
  if (!ID_VALIDO.test(id)) throw new Error('Id de cliente inválido.');
  return path.join(DIR, id);
}

/** Guarda el archivo y devuelve { campo, nombre } para escribir en la planilla. */
function guardar(id, tipo, original, buffer) {
  const t = TIPOS[tipo];
  if (!t) throw new Error('Tipo de archivo desconocido.');
  const ext = String(path.extname(original || '')).slice(1).toLowerCase();
  if (!t.ext.includes(ext)) throw new Error(`Para "${t.etiqueta}" se acepta: ${t.ext.join(', ')}.`);
  const dir = carpeta(id);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (f.startsWith(tipo + '.')) fs.unlinkSync(path.join(dir, f));
  const nombre = `${tipo}.${ext}`;
  fs.writeFileSync(path.join(dir, nombre), buffer);
  return { campo: t.campo, nombre };
}

function borrar(id, tipo) {
  const t = TIPOS[tipo];
  if (!t) throw new Error('Tipo de archivo desconocido.');
  const dir = carpeta(id);
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (f.startsWith(tipo + '.')) fs.unlinkSync(path.join(dir, f));
  return { campo: t.campo };
}

/** Ruta en disco de un archivo, o null si el nombre no es válido o no existe. */
function ruta(id, nombre) {
  if (!NOMBRE_VALIDO.test(nombre || '')) return null;
  const p = path.join(carpeta(id), nombre);
  return fs.existsSync(p) ? p : null;
}

function mime(nombre) {
  return MIME[path.extname(nombre).slice(1).toLowerCase()] || 'application/octet-stream';
}

function codigoNuevo() {
  return randomBytes(18).toString('base64url');
}

module.exports = { TIPOS, guardar, borrar, ruta, mime, codigoNuevo };
