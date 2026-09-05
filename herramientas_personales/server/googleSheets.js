const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ARCHIVO_ACTUAL = path.join(DATA_DIR, 'sheet-actual.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/**
 * Trae TODAS las hojas de la planilla de Google Sheets configurada
 * (GOOGLE_SHEETS_ID), tal cual están — sin asumir columnas ni tipos — vía
 * la API pública de Sheets (v4) con una API key simple. Funciona porque la
 * planilla está compartida como "cualquiera con el link puede ver": no hace
 * falta cuenta de servicio ni OAuth, solo habilitar la Google Sheets API en
 * algún proyecto de Google Cloud y generar una API key.
 *
 * Reemplaza a la carga manual de Excel que existía antes (ver excel.js,
 * eliminado): ahora los datos se traen en vivo desde la misma planilla a la
 * que ya le mandamos los eventos del diagnóstico (server/sheets.ts de
 * prisma_2), así Damian no tiene que exportar y subir un archivo a mano
 * cada vez.
 */
async function obtenerHojas() {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!apiKey) throw new Error('Falta GOOGLE_SHEETS_API_KEY en el .env.local del servidor.');
  if (!sheetId) throw new Error('Falta GOOGLE_SHEETS_ID en el .env.local del servidor.');

  const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;

  // 1) Metadata: nombre de cada hoja (pestaña) de la planilla.
  const metaRes = await fetch(`${baseUrl}?key=${apiKey}&fields=properties.title,sheets.properties.title`);
  if (!metaRes.ok) {
    const cuerpo = await metaRes.text().catch(() => '');
    throw new Error(`No se pudo leer la planilla (${metaRes.status}). ${cuerpo.slice(0, 300)}`);
  }
  const meta = await metaRes.json();
  const nombresHojas = (meta.sheets || []).map((s) => s.properties.title);
  if (nombresHojas.length === 0) throw new Error('La planilla no tiene ninguna hoja.');

  // 2) Valores de cada hoja, todos de una — batchGet evita una llamada por hoja.
  const rangos = nombresHojas.map((n) => `ranges=${encodeURIComponent(n)}`).join('&');
  const valoresRes = await fetch(`${baseUrl}/values:batchGet?key=${apiKey}&${rangos}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`);
  if (!valoresRes.ok) {
    const cuerpo = await valoresRes.text().catch(() => '');
    throw new Error(`No se pudieron leer los datos de la planilla (${valoresRes.status}). ${cuerpo.slice(0, 300)}`);
  }
  const valores = await valoresRes.json();

  const hojas = (valores.valueRanges || []).map((rango, i) => {
    const filas = (rango.values || []).map((fila) => fila.map((c) => (c === null || c === undefined ? '' : c)));
    let maxColumnas = 0;
    for (const fila of filas) maxColumnas = Math.max(maxColumnas, fila.length);
    for (const fila of filas) while (fila.length < maxColumnas) fila.push('');

    return {
      nombre: nombresHojas[i],
      filas,
      totalFilas: filas.length,
      totalColumnas: maxColumnas,
    };
  });

  return { hojas };
}

function guardarActual(datos) {
  const registro = {
    actualizadoEn: new Date().toISOString(),
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

module.exports = { obtenerHojas, guardarActual, leerActual };
