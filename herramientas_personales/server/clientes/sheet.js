const fs = require('fs');
const path = require('path');
const { COLUMNAS } = require('./columnas');

/**
 * Cliente del Apps Script de Clientes_Maps (google-apps-script/clientes_maps.gs).
 * La planilla es la base de datos: todo cambio se escribe ahí. El servidor guarda
 * una copia en memoria (para no pedir la lista entera en cada clic) y un respaldo
 * en server/data/clientes-maps-respaldo.json por si la planilla no responde.
 */
const RESPALDO = path.join(__dirname, '..', 'data', 'clientes-maps-respaldo.json');
const VIGENCIA_MS = 30 * 1000;

let cache = null; // { clientes: [], leidoEn: ms }

function configurado() {
  return Boolean(process.env.CLIENTES_SCRIPT_URL && process.env.CLIENTES_SCRIPT_CLAVE);
}

async function pedir(accion, datos = {}) {
  if (!configurado()) throw new Error('Falta conectar la planilla: completá CLIENTES_SCRIPT_URL y CLIENTES_SCRIPT_CLAVE en .env.local (ver google-apps-script/clientes_maps.gs).');
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), 30000);
  let res;
  try {
    // Apps Script responde con una redirección a googleusercontent: fetch la sigue sola.
    res = await fetch(process.env.CLIENTES_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ clave: process.env.CLIENTES_SCRIPT_CLAVE, accion, columnas: COLUMNAS, ...datos }),
      redirect: 'follow',
      signal: ctrl.signal,
    });
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? 'La planilla tardó demasiado en responder.' : `No pude conectar con la planilla: ${err.message}`);
  } finally {
    clearTimeout(corte);
  }
  const texto = await res.text();
  let json;
  try { json = JSON.parse(texto); } catch {
    throw new Error(`La planilla devolvió algo inesperado (${res.status}). Revisá que la implementación sea "Aplicación web" con acceso "Cualquier usuario".`);
  }
  if (!json.ok) throw new Error(`Planilla: ${json.error || 'error desconocido'}`);
  return json;
}

function respaldar() {
  try {
    fs.mkdirSync(path.dirname(RESPALDO), { recursive: true });
    fs.writeFileSync(RESPALDO, JSON.stringify({ guardadoEn: new Date().toISOString(), clientes: cache.clientes }));
  } catch (err) { console.error('[clientes] no pude escribir el respaldo:', err.message); }
}

function leerRespaldo() {
  try { return JSON.parse(fs.readFileSync(RESPALDO, 'utf8')); } catch { return null; }
}

/** Lista de clientes. Si la planilla falla y hay respaldo, lo devuelve marcado como tal. */
async function listar({ forzar = false } = {}) {
  if (!forzar && cache && Date.now() - cache.leidoEn < VIGENCIA_MS) return { clientes: cache.clientes, origen: 'planilla' };
  try {
    const r = await pedir('listar');
    cache = { clientes: r.clientes, leidoEn: Date.now() };
    respaldar();
    return { clientes: cache.clientes, origen: 'planilla' };
  } catch (err) {
    const resp = leerRespaldo();
    if (resp) return { clientes: resp.clientes, origen: 'respaldo', respaldoDe: resp.guardadoEn, error: err.message };
    throw err;
  }
}

async function obtener(id) {
  const { clientes } = await listar();
  return clientes.find((c) => c.id === id) || null;
}

async function guardarVarios(clientes) {
  const r = await pedir('guardar', { clientes });
  cache = null;
  return r;
}

async function actualizar(id, cambios) {
  const r = await pedir('actualizar', { id, cambios: { ...cambios, actualizadoEn: new Date().toISOString() } });
  if (cache) {
    const i = cache.clientes.findIndex((c) => c.id === id);
    if (i >= 0) cache.clientes[i] = r.cliente; else cache.clientes.push(r.cliente);
    respaldar();
  }
  return r.cliente;
}

async function eliminar(id) {
  await pedir('eliminar', { id });
  if (cache) { cache.clientes = cache.clientes.filter((c) => c.id !== id); respaldar(); }
}

module.exports = { configurado, listar, obtener, guardarVarios, actualizar, eliminar };
