const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');

// video-chat-prisma vive como carpeta hermana dentro del mismo repo
// (herramientas/herramientas_personales y herramientas/video-chat-prisma).
const VIDEO_CHAT_DIR = path.join(__dirname, '..', '..', 'video-chat-prisma');
const GUION_PATH = path.join(VIDEO_CHAT_DIR, 'public', 'guiones', 'actual.txt');
const OUT_DIR = path.join(VIDEO_CHAT_DIR, 'out');

// Plantillas disponibles hoy -> id de composición de Remotion (src/Root.tsx
// en video-chat-prisma). Para sumar una plantilla nueva: registrar ahí una
// Composition nueva y agregar acá su entrada — nada más cambia.
const PLANTILLAS = {
  chatgpt: { nombre: 'Chat estilo ChatGPT', composicion: 'ChatVideo' },
};

const TIMEOUT_MS = 5 * 60 * 1000; // el render puede tardar en un VPS chico

/** Corre "npx remotion render" sobre video-chat-prisma y devuelve la ruta del mp4 generado. */
async function renderizarVideo(guionTexto, plantillaId) {
  const plantilla = PLANTILLAS[plantillaId];
  if (!plantilla) {
    throw new Error(`Plantilla desconocida: "${plantillaId}".`);
  }

  await fs.mkdir(path.dirname(GUION_PATH), { recursive: true });
  await fs.writeFile(GUION_PATH, guionTexto, 'utf-8');

  await fs.mkdir(OUT_DIR, { recursive: true });
  const nombreArchivo = `video-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.mp4`;
  const outPath = path.join(OUT_DIR, nombreArchivo);

  await new Promise((resolve, reject) => {
    execFile(
      'npx',
      ['remotion', 'render', plantilla.composicion, outPath],
      { cwd: VIDEO_CHAT_DIR, timeout: TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        if (err) {
          const detalle = (stderr || '').trim().slice(-2000);
          reject(new Error(detalle || err.message));
          return;
        }
        resolve();
      },
    );
  });

  return outPath;
}

module.exports = { renderizarVideo, PLANTILLAS };
