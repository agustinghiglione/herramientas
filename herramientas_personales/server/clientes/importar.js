const ExcelJS = require('exceljs');
const { Readable } = require('stream');
const { COLUMNAS, vacio, slug, limpiar, ID_VALIDO } = require('./columnas');

/** Encabezados aceptados además de los nombres exactos de las columnas. */
const ALIAS = {
  negocio: 'nombre', nombredelnegocio: 'nombre', empresa: 'nombre', comercio: 'nombre',
  categoria: 'rubro', actividad: 'rubro', localidad: 'zona', ciudad: 'zona', partido: 'zona',
  domicilio: 'direccion', tel: 'telefono', celular: 'telefono', whatsapp: 'telefono',
  mail: 'email', correo: 'email', correoelectronico: 'email',
  web: 'webUrl', sitio: 'webUrl', sitioweb: 'webUrl', paginaweb: 'webUrl', url: 'webUrl',
  maps: 'mapsUrl', googlemaps: 'mapsUrl', fichamaps: 'mapsUrl', fichaengooglemaps: 'mapsUrl', ig: 'instagram',
  presenciaweb: 'presencia', tiposocietario: 'tipo', senales: 'senal', datos: 'senal',
  ganchocontable: 'gancho', ofertadeentrada: 'oferta', webobjeto: 'estadoWeb', estadodelaweb: 'estadoWeb',
  contacto: 'estadoContacto', estado: 'estadoContacto', diagnosticoprisma: 'diagnostico',
  proximo: 'proximoPaso', proximopaso: 'proximoPaso', fechaultimocontacto: 'ultimoContacto',
};
const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const POR_NOMBRE = Object.fromEntries(COLUMNAS.map((c) => [normal(c), c]));

function textoCelda(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if (v.hyperlink) return String(v.hyperlink);
    if (v.text) return String(v.text);
    if (v.result != null) return String(v.result);
  }
  return String(v);
}

/** Lee un .xlsx o .csv y devuelve filas con las columnas de la planilla. */
async function leerArchivo(buffer, nombreArchivo) {
  const wb = new ExcelJS.Workbook();
  if (/\.csv$/i.test(nombreArchivo)) await wb.csv.read(Readable.from(buffer.toString('utf8').replace(/^﻿/, '')));
  else await wb.xlsx.load(buffer);
  const hoja = wb.getWorksheet('Clientes') || wb.worksheets.find((w) => w.rowCount > 1) || wb.worksheets[0];
  if (!hoja) throw new Error('El archivo no tiene hojas.');

  const mapa = [];
  hoja.getRow(1).eachCell({ includeEmpty: true }, (c, i) => {
    const n = normal(textoCelda(c.value));
    mapa[i] = POR_NOMBRE[n] || ALIAS[n] || null;
  });
  if (!mapa.includes('nombre')) throw new Error('No encontré la columna "nombre" (o "negocio") en la primera fila.');

  const filas = [];
  hoja.eachRow((row, n) => {
    if (n === 1) return;
    const f = {};
    mapa.forEach((col, i) => { if (col) { const v = textoCelda(row.getCell(i).value).trim(); if (v) f[col] = v; } });
    if (f.nombre) filas.push(f);
  });
  if (!filas.length) throw new Error('El archivo no tiene clientes cargados.');
  return filas;
}

/**
 * Combina las filas importadas con los clientes existentes: si coincide el id o el
 * nombre, actualiza solo las celdas que vienen con dato; si no, crea uno nuevo.
 */
function combinar(filas, existentes) {
  const porId = new Map(existentes.map((c) => [c.id, c]));
  const porNombre = new Map(existentes.map((c) => [normal(c.nombre), c]));
  const usados = new Set(existentes.map((c) => c.id));
  const salida = [];
  for (const f of filas) {
    const datos = limpiar(f);
    const previo = (f.id && porId.get(f.id)) || porNombre.get(normal(f.nombre));
    if (previo) { salida.push({ ...datos, id: previo.id }); continue; }
    // Si el archivo trae un id válido que no está en uso, se respeta (así la planilla
    // coincide con la lista de origen); si no, se arma uno con el nombre.
    let id = f.id && ID_VALIDO.test(f.id) && !usados.has(f.id) ? f.id : slug(f.nombre), i = 2;
    while (usados.has(id)) id = `${slug(f.nombre)}-${i++}`;
    usados.add(id);
    salida.push({ ...vacio(f.nombre), ...datos, id, actualizadoEn: new Date().toISOString() });
  }
  return salida;
}

async function exportar(clientes) {
  const wb = new ExcelJS.Workbook();
  const hoja = wb.addWorksheet('Clientes');
  hoja.addRow(COLUMNAS).font = { bold: true };
  for (const c of clientes) hoja.addRow(COLUMNAS.map((k) => c[k] || ''));
  hoja.views = [{ state: 'frozen', ySplit: 1 }];
  hoja.columns.forEach((col, i) => { col.width = ['nombre', 'gancho', 'senal', 'notas', 'resumenWeb'].includes(COLUMNAS[i]) ? 40 : 18; });
  return wb.xlsx.writeBuffer();
}

module.exports = { leerArchivo, combinar, exportar };
