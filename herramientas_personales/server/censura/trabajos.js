/**
 * Guarda, mientras dura la revisión, los datos de un análisis de censura:
 * el PDF original (en disco, en una carpeta temporal — NO junto al resto
 * del sitio) y las detecciones encontradas (en memoria).
 *
 * Esto es lo único de toda la herramienta que sí toca el disco con datos
 * de un cliente — hace falta, porque para tapar de verdad hay que volver a
 * rasterizar el PDF original una vez que el usuario confirma qué tapar. Por
 * eso lo tratamos con cuidado:
 *   - Carpeta temporal dedicada, con un id random imposible de adivinar.
 *   - Se borra apenas se descarga el PDF final (o si el análisis se
 *     descarta).
 *   - Un barrido periódico borra cualquier trabajo abandonado (el usuario
 *     subió un documento y nunca confirmó) después de 30 minutos.
 */

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const DIR_BASE = path.join(os.tmpdir(), 'herramientas-censura');
const VENCIMIENTO_MS = 30 * 60 * 1000; // 30 minutos

const trabajos = new Map(); // jobId -> { pdfPath, paginas, creadoEn }

async function crearTrabajo(bufferPdf, paginas) {
  const jobId = crypto.randomBytes(16).toString('hex');
  const carpeta = path.join(DIR_BASE, jobId);
  await fs.mkdir(carpeta, { recursive: true });
  const pdfPath = path.join(carpeta, 'original.pdf');
  await fs.writeFile(pdfPath, bufferPdf);

  trabajos.set(jobId, { pdfPath, carpeta, paginas, creadoEn: Date.now() });
  return jobId;
}

function obtenerTrabajo(jobId) {
  return trabajos.get(jobId) || null;
}

async function borrarTrabajo(jobId) {
  const trabajo = trabajos.get(jobId);
  if (!trabajo) return;
  trabajos.delete(jobId);
  await fs.rm(trabajo.carpeta, { recursive: true, force: true }).catch(() => {});
}

async function barrerVencidos() {
  const ahora = Date.now();
  for (const [jobId, trabajo] of trabajos.entries()) {
    if (ahora - trabajo.creadoEn > VENCIMIENTO_MS) {
      await borrarTrabajo(jobId);
    }
  }
}

// Barrido cada 5 minutos — best-effort, no bloquea nada si falla.
setInterval(() => {
  barrerVencidos().catch((err) => console.error('[censura] error en el barrido de trabajos vencidos:', err.message));
}, 5 * 60 * 1000).unref();

module.exports = { crearTrabajo, obtenerTrabajo, borrarTrabajo };
