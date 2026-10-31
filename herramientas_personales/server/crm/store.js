const fs = require('fs');
const path = require('path');
const { randomUUID } = require('node:crypto');

/**
 * Persistencia del CRM personal en un archivo JSON (server/data/crm.json,
 * que no se versiona). Es una herramienta de una sola persona con pocos
 * cientos de registros: un JSON con escritura atómica alcanza y evita sumar
 * una base de datos con dependencias nativas al servidor.
 */
const DIR = path.join(__dirname, '..', 'data');
const ARCHIVO = path.join(DIR, 'crm.json');

const VACIO = () => ({
  version: 1,
  contenidos: [],   // piezas del plan semanal de Instagram (vienen del Excel)
  eventos: [],      // cosas personales en el calendario
  tareas: [],       // objetivos del día (del plan, manuales o completados de recurrentes)
  recurrentes: [],  // recordatorios que se repiten un día de la semana
  semanas: [],      // registro de cada Excel subido
  mail: { ultimoEnvio: null },
});

let cache = null;

function leer() {
  if (cache) return cache;
  try {
    cache = { ...VACIO(), ...JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')) };
  } catch {
    cache = VACIO();
  }
  if (!cache.recurrentes.length && !cache.sembrado) {
    const hoy = require('./fechas').hoyISO();
    cache.recurrentes = RECURRENTES_INICIALES.map((r) => ({ id: randomUUID(), activo: true, desde: hoy, ...r }));
    cache.sembrado = true;
    guardar();
  }
  return cache;
}

function guardar() {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = ARCHIVO + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 1));
  fs.renameSync(tmp, ARCHIVO);
}

/** Aplica un cambio y guarda. */
function cambiar(fn) {
  const datos = leer();
  const resultado = fn(datos);
  guardar();
  return resultado;
}

// diaSemana: 1 = lunes … 7 = domingo (igual que la pestaña Formatos del Excel)
const RECURRENTES_INICIALES = [
  { diaSemana: 6, hora: '10:30', titulo: 'Dejar la compu prendida con la app de Claude abierta', detalle: 'La tarea programada del plan semanal corre a las 10:43.' },
  { diaSemana: 6, hora: '12:00', titulo: 'Revisar el plan semanal y subir el Excel al CRM', detalle: 'Excel en instagram/calendario/Prisma_calendario_instagram.xlsx. El reel quiz queda en instagram/reels/quiz/.' },
];
// Las tareas de producción (reels, imágenes, revisión del contador) no son
// recurrentes: se generan solas al subir el Excel, con la idea concreta de cada pieza.

module.exports = { leer, cambiar, randomUUID };
