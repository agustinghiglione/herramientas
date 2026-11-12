/**
 * Base de datos de "Clientes Maps" (panel de Herramientas) en Google Sheets.
 *
 * Es una Aplicación web de Apps Script, igual que sheets_webhook.gs de prisma_2:
 * corre con TU cuenta de Google, así que la planilla puede seguir siendo privada.
 * El servidor de herramientas le manda pedidos con una clave compartida; sin la
 * clave no lee ni escribe nada.
 *
 * Cómo instalarlo (una sola vez):
 * 1. Entrá a https://script.google.com/home con la cuenta dueña de la planilla
 *    Clientes_Maps → "Proyecto nuevo". Borrá lo que trae Code.gs y pegá este archivo.
 * 2. Revisá que ID_PLANILLA (abajo) sea el de tu planilla (ya está cargado).
 * 3. Elegí una clave larga (por ejemplo, 40 letras y números al azar).
 *    Configuración del proyecto (ícono de engranaje) → "Propiedades de la secuencia
 *    de comandos" → Agregar propiedad: nombre CLAVE, valor tu clave → Guardar.
 * 4. Implementar → Nueva implementación → tipo "Aplicación web".
 *    - Ejecutar como: "Yo"
 *    - Quién tiene acceso: "Cualquier usuario"
 *    Autorizá los permisos ("Configuración avanzada" → "Ir a … (no seguro)": es tu script).
 * 5. Copiá la URL que termina en /exec y cargala en el .env.local del servidor:
 *      CLIENTES_SCRIPT_URL=<esa URL>
 *      CLIENTES_SCRIPT_CLAVE=<la misma clave del paso 3>
 *
 * Si más adelante cambia este código: pegalo de nuevo e "Implementar → Gestionar
 * implementaciones → lápiz → Versión: Nueva versión". La URL no cambia.
 *
 * La pestaña "Clientes" se crea sola con sus encabezados. Podés editar celdas a mano
 * en la planilla: el panel las ve la próxima vez que carga la lista. No cambies los
 * nombres de la fila 1 ni la columna "id".
 */

var ID_PLANILLA = '1C9R8Z4jOQhcJdhuoZg_oBsPMG5VZT_KDg8i7MJ27zgk';
var NOMBRE_HOJA = 'Clientes';

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var p = JSON.parse(e.postData.contents || '{}');
    var clave = PropertiesService.getScriptProperties().getProperty('CLAVE');
    if (!clave || p.clave !== clave) return responder_({ ok: false, error: 'Clave inválida o sin configurar.' });

    var hoja = hoja_(p.columnas || []);
    if (p.accion === 'listar') return responder_({ ok: true, clientes: leerTodo_(hoja) });
    if (p.accion === 'guardar') return responder_(guardar_(hoja, p.clientes || []));
    if (p.accion === 'actualizar') return responder_(actualizar_(hoja, p.id, p.cambios || {}));
    if (p.accion === 'eliminar') return responder_(eliminar_(hoja, p.id));
    return responder_({ ok: false, error: 'Acción desconocida: ' + p.accion });
  } catch (err) {
    return responder_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function doGet() {
  return responder_({ ok: true, mensaje: 'Clientes Maps activo. El panel usa POST.' });
}

function responder_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Devuelve la hoja, creándola y sumando columnas nuevas al final si hace falta. */
function hoja_(columnas) {
  var libro = SpreadsheetApp.openById(ID_PLANILLA);
  var hoja = libro.getSheetByName(NOMBRE_HOJA);
  if (!hoja) {
    hoja = libro.insertSheet(NOMBRE_HOJA);
    // La "Hoja 1" vacía que trae una planilla nueva ya no hace falta.
    var vieja = libro.getSheetByName('Hoja 1') || libro.getSheetByName('Sheet1');
    if (vieja && vieja.getLastRow() === 0 && libro.getSheets().length > 1) libro.deleteSheet(vieja);
  }
  var actuales = encabezados_(hoja);
  var faltan = columnas.filter(function (c) { return actuales.indexOf(c) === -1; });
  if (faltan.length) {
    var desde = actuales.length + 1;
    hoja.getRange(1, desde, 1, faltan.length).setValues([faltan]).setFontWeight('bold');
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function encabezados_(hoja) {
  var ultima = hoja.getLastColumn();
  if (ultima === 0) return [];
  return hoja.getRange(1, 1, 1, ultima).getValues()[0].map(String).filter(function (x) { return x !== ''; });
}

function leerTodo_(hoja) {
  var cab = encabezados_(hoja);
  var filas = hoja.getLastRow() - 1;
  if (filas < 1 || !cab.length) return [];
  var valores = hoja.getRange(2, 1, filas, cab.length).getDisplayValues();
  return valores
    .filter(function (f) { return f[cab.indexOf('id')] !== ''; })
    .map(function (f) { var o = {}; cab.forEach(function (c, i) { o[c] = f[i]; }); return o; });
}

function filaDe_(hoja, id) {
  var cab = encabezados_(hoja);
  var col = cab.indexOf('id') + 1;
  if (col < 1 || hoja.getLastRow() < 2) return -1;
  var ids = hoja.getRange(2, col, hoja.getLastRow() - 1, 1).getDisplayValues();
  for (var i = 0; i < ids.length; i++) if (ids[i][0] === id) return i + 2;
  return -1;
}

function escribirFila_(hoja, fila, cab, obj) {
  var rango = hoja.getRange(fila, 1, 1, cab.length);
  var actual = rango.getDisplayValues()[0];
  var nueva = cab.map(function (c, i) { return (c in obj) ? String(obj[c]) : actual[i]; });
  rango.setNumberFormat('@').setValues([nueva]); // texto plano: no convierte teléfonos ni fechas
}

function guardar_(hoja, clientes) {
  var cab = encabezados_(hoja);
  var creados = 0, actualizados = 0;
  clientes.forEach(function (c) {
    if (!c.id) return;
    var fila = filaDe_(hoja, c.id);
    if (fila === -1) { fila = hoja.getLastRow() + 1; creados++; } else { actualizados++; }
    escribirFila_(hoja, fila, cab, c);
  });
  return { ok: true, creados: creados, actualizados: actualizados };
}

function actualizar_(hoja, id, cambios) {
  var fila = filaDe_(hoja, id);
  if (fila === -1) return { ok: false, error: 'No existe el cliente ' + id };
  var cab = encabezados_(hoja);
  escribirFila_(hoja, fila, cab, cambios);
  var valores = hoja.getRange(fila, 1, 1, cab.length).getDisplayValues()[0];
  var o = {}; cab.forEach(function (c, i) { o[c] = valores[i]; });
  return { ok: true, cliente: o };
}

function eliminar_(hoja, id) {
  var fila = filaDe_(hoja, id);
  if (fila !== -1) hoja.deleteRow(fila);
  return { ok: true };
}
