const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ARCHIVO_ACTUAL = path.join(DATA_DIR, 'excel-actual.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/** Pasa cualquier valor de celda de ExcelJS a algo simple y serializable. */
function valorSimple(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'object') {
    if ('result' in valor) return valorSimple(valor.result); // celda con fórmula
    if ('richText' in valor) return valor.richText.map((t) => t.text).join('');
    if ('text' in valor) return valor.text; // ej: hipervínculo {text, hyperlink}
    if ('error' in valor) return `#ERROR: ${valor.error}`;
    return JSON.stringify(valor);
  }
  return valor;
}

/**
 * Parsea TODAS las hojas del Excel, sin asumir nada sobre su estructura
 * (columnas, tipos de dato) — la idea es guardar cada hoja tal cual está,
 * fila por fila, para poder mirarla y usarla después en un estudio del
 * negocio, no para encajarla en un esquema fijo que todavía no existe.
 */
async function parsearExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const hojas = [];
  workbook.eachSheet((worksheet) => {
    const filas = [];
    let maxColumnas = 0;

    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const valores = [];
      // row.values trae un array 1-indexado (el índice 0 queda vacío) — lo
      // recorremos con eachCell para no perder columnas intermedias vacías.
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        valores[colNumber - 1] = valorSimple(cell.value);
      });
      maxColumnas = Math.max(maxColumnas, valores.length);
      filas.push(valores);
    });

    // Empareja todas las filas a la misma cantidad de columnas (por si
    // alguna fila vino más corta) para que la tabla se vea prolija.
    for (const fila of filas) {
      while (fila.length < maxColumnas) fila.push('');
    }

    hojas.push({
      nombre: worksheet.name,
      filas,
      totalFilas: filas.length,
      totalColumnas: maxColumnas,
    });
  });

  return { hojas };
}

function guardarActual(nombreArchivo, datos) {
  const registro = {
    nombreArchivo,
    subidoEn: new Date().toISOString(),
    hojas: datos.hojas,
  };
  fs.writeFileSync(ARCHIVO_ACTUAL, JSON.stringify(registro));
  return registro;
}

function leerActual() {
  if (!fs.existsSync(ARCHIVO_ACTUAL)) return null;
  try {
    return JSON.parse(fs.readFileSync(ARCHIVO_ACTUAL, 'utf8'));
  } catch {
    return null;
  }
}

module.exports = { parsearExcel, guardarActual, leerActual };
