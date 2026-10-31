const ExcelJS = require('exceljs');
const { normalizar, sumarDias, lunesDe, diaSemana, NOMBRES } = require('./fechas');

const CAMPOS = ['fecha', 'dia', 'servicio', 'publico', 'formato', 'capa', 'objetivo', 'idea_ganadora', 'por_que_gana', 'puntaje',
  'gancho', 'contenido_a_crear', 'pedido_para_ia', 'herramienta', 'descripcion', 'hashtags', 'stickers_interactivos', 'cta',
  'link_utm', 'texto_alternativo', 'revision_contador', 'estado'];

function textoCelda(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('');
    if (v.text) return String(v.text);
    if (v.result != null) return String(v.result);
  }
  return String(v);
}

/**
 * Lee el Excel del plan semanal (el que arma la tarea programada de los sábados).
 * Usa la pestaña Esta_semana; si no existe, la última semana de Plan_semanal.
 */
async function leerPlan(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const hoja = wb.getWorksheet('Esta_semana') || wb.getWorksheet('Plan_semanal') || wb.worksheets[0];
  if (!hoja) throw new Error('El archivo no tiene hojas.');
  const encabezado = [];
  hoja.getRow(1).eachCell({ includeEmpty: true }, (c, i) => { encabezado[i] = textoCelda(c.value).trim().toLowerCase(); });
  if (!encabezado.includes('fecha') || !encabezado.includes('formato')) {
    throw new Error('No encontré las columnas "fecha" y "formato". ¿Es el Excel del calendario de Instagram?');
  }
  let filas = [];
  hoja.eachRow((row, n) => {
    if (n === 1) return;
    const f = {};
    encabezado.forEach((col, i) => { if (col) f[col] = textoCelda(row.getCell(i).value).trim(); });
    f.fecha = normalizar(f.fecha);
    if (f.fecha && f.formato) filas.push(f);
  });
  if (!filas.length) throw new Error('El Excel no tiene piezas planificadas.');
  // Si vino Plan_semanal completo, quedarse con la semana más reciente.
  if (hoja.name !== 'Esta_semana') {
    const ultimoLunes = filas.map((f) => lunesDe(f.fecha)).sort().pop();
    filas = filas.filter((f) => lunesDe(f.fecha) === ultimoLunes);
  }
  return filas.map((f) => Object.fromEntries(CAMPOS.map((k) => [k, f[k] || ''])));
}

function tipoDe(formato) {
  const f = (formato || '').toLowerCase();
  if (f.includes('quiz')) return 'quiz';
  if (f.includes('reel')) return 'reel';
  if (f.includes('carrusel')) return 'carrusel';
  if (f.includes('historia')) return 'historia';
  return 'otro';
}

/**
 * Objetivos que salen de cada pieza. Las claves son estables (no aleatorias),
 * así si se vuelve a subir el mismo Excel no se duplican y se conserva lo tildado.
 */
function tareasDePieza(c, lunes) {
  const domingoPrevio = sumarDias(lunes, -1);
  const tipo = tipoDe(c.formato);
  const idea = c.idea_ganadora || c.formato;
  const diaPub = (c.dia || NOMBRES[diaSemana(c.fecha)]).toLowerCase();
  const esReel = tipo === 'reel' || tipo === 'quiz';
  // Reels de prueba de Instagram: solo si el plan lo indica con una línea "Prueba: …" en
  // contenido_a_crear (hace falta un mínimo de seguidores; hasta entonces se publica directo).
  const conPrueba = esReel && /(^|\n)\s*Prueba:/.test(c.contenido_a_crear || '');
  const t = [{
    clave: `pub:${c.fecha}:${tipo}`, fecha: c.fecha, ref: c.id,
    titulo: conPrueba ? `Compartir con seguidores el ${c.formato.toLowerCase()}: ${idea}` : `Publicar ${c.formato.toLowerCase()} en Instagram y Facebook: ${idea}`,
    detalle: tipo === 'historia' ? 'Con los stickers interactivos indicados. Compartir también en la historia de Facebook.'
      : conPrueba ? 'Si la prueba ganó, usá el botón "Compartir" del reel de prueba (no lo resubas). Si no ganó: cambiá solo el gancho y volvé a probarlo.'
      : 'Con la descripción y los hashtags del plan. Activá "Compartir en Facebook" (o programalo en Meta Business Suite) y usá el link de Facebook en la descripción de Facebook.',
  }];
  if (conPrueba) {
    const diaProd = sumarDias(c.fecha, -1);
    t.push({ clave: `trial:${c.fecha}:${tipo}`, fecha: diaProd, ref: c.id, titulo: `Subir como reel de prueba: ${idea}`, detalle: 'Interruptor "Prueba" en la última pantalla. Misma descripción y hashtags del plan. Lo ven solo personas que no te siguen.' });
    t.push({ clave: `eval:${c.fecha}:${tipo}`, fecha: c.fecha, ref: c.id, hora: '18:00', titulo: `Revisar el reel de prueba y decidir: ${idea}`, detalle: 'Compartir si el tiempo promedio es ≥ 40 % de la duración o compartidos + guardados ≥ 2 % del alcance. Anotar los números en el registro de pruebas.' });
  }
  if (tipo === 'reel') {
    const dia = sumarDias(c.fecha, -1);
    t.push({ clave: `prod:${c.fecha}:reel`, fecha: dia, ref: c.id, titulo: `Producir en Flow el reel del ${diaPub}: ${idea}`, detalle: 'Máximo 50 créditos: 3 clips nuevos de Clara + clip del banco + imágenes de apoyo. Armarlo en Escenas y editar subtítulos.' });
  } else if (tipo === 'carrusel' || tipo === 'historia') {
    t.push({ clave: `prod:${c.fecha}:${tipo}`, fecha: domingoPrevio, ref: c.id, titulo: `Crear con IA las imágenes: ${c.formato.toLowerCase()} del ${diaPub}`, detalle: 'Pegar el pedido para la IA en Nano Banana (Flow, 0 créditos) o Gemini y elegir la mejor variante.' });
  } else if (tipo === 'quiz') {
    t.push({ clave: `prod:${c.fecha}:quiz`, fecha: sumarDias(c.fecha, -1), ref: c.id, titulo: 'Revisar el reel quiz y elegir el audio', detalle: 'El MP4 y la portada están en instagram/reels/quiz/. Audio instrumental al 10-20 %.' });
  }
  if (/^s[ií]/i.test(c.revision_contador)) {
    t.push({ clave: `cont:${c.fecha}:${tipo}`, fecha: domingoPrevio, ref: c.id, titulo: `Pasar al contador: ${idea}`, detalle: 'Tiene datos impositivos: no publicar sin su visto bueno.' });
  }
  return t;
}

module.exports = { leerPlan, tareasDePieza, tipoDe };
