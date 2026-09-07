const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');

// video-chat-prisma vive como carpeta hermana dentro del mismo repo
// (herramientas/herramientas_personales y herramientas/video-chat-prisma).
const VIDEO_CHAT_DIR = path.join(__dirname, '..', '..', 'video-chat-prisma');
const GUION_PATH = path.join(VIDEO_CHAT_DIR, 'public', 'guiones', 'actual.txt');
const OUT_DIR = path.join(VIDEO_CHAT_DIR, 'out');
const BANNERS_DIR = path.join(VIDEO_CHAT_DIR, 'public', 'banners');
const BANNER_ACTUAL_PATH = path.join(BANNERS_DIR, 'actual.png');

// Plantillas disponibles hoy -> id de composición de Remotion (src/Root.tsx
// en video-chat-prisma). Para sumar una plantilla nueva: registrar ahí una
// Composition nueva y agregar acá su entrada — nada más cambia.
const PLANTILLAS = {
  chatgpt: { nombre: 'Chat estilo ChatGPT', composicion: 'ChatVideo' },
};

const TIMEOUT_MS = 5 * 60 * 1000; // el render puede tardar en un VPS chico

// ---------- Catálogo de banners ----------
// Cada banner "aprobado" vive como banner-<id>.png dentro de public/banners.
// El que está activo en un momento dado se copia (siempre con ese nombre
// exacto) a actual.png, que es el único archivo que Remotion sabe leer
// (ver BannerImagen.tsx en video-chat-prisma) — así el motor de video no
// necesita saber nada de "catálogos" ni "ids", sigue siendo tan simple como
// siempre fue.

const PREFIJO_BANNER = 'banner-';

function slugificar(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // saca acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Valida que un id de banner sea un nombre de archivo seguro (sin ../ ni rutas). */
function idValido(id) {
  return typeof id === 'string' && /^[a-z0-9-]{1,60}$/.test(id);
}

async function listarBanners() {
  await fs.mkdir(BANNERS_DIR, { recursive: true });
  const archivos = await fs.readdir(BANNERS_DIR);
  const banners = [];
  for (const archivo of archivos) {
    if (archivo === 'actual.png' || !archivo.toLowerCase().endsWith('.png')) continue;
    if (!archivo.startsWith(PREFIJO_BANNER)) continue;
    const id = archivo.slice(0, -4); // saca ".png"
    const nombreLegible = id
      .slice(PREFIJO_BANNER.length)
      .replace(/-/g, ' ')
      .replace(/^./, (c) => c.toUpperCase());
    banners.push({ id, nombre: nombreLegible || id });
  }
  banners.sort((a, b) => a.id.localeCompare(b.id));
  return banners;
}

function rutaImagenBanner(id) {
  if (!idValido(id)) return null;
  return path.join(BANNERS_DIR, `${id}.png`);
}

/** Guarda un banner nuevo en el catálogo a partir de un buffer PNG subido por el admin. */
async function guardarBannerNuevo(buffer, nombreSugerido) {
  await fs.mkdir(BANNERS_DIR, { recursive: true });
  const base = slugificar(nombreSugerido) || `nuevo-${Date.now()}`;
  let id = `${PREFIJO_BANNER}${base}`;
  let intento = 2;
  // Evita pisar un banner existente si dos suben el mismo nombre.
  while (
    await fs
      .access(path.join(BANNERS_DIR, `${id}.png`))
      .then(() => true)
      .catch(() => false)
  ) {
    id = `${PREFIJO_BANNER}${base}-${intento++}`;
  }
  await fs.writeFile(path.join(BANNERS_DIR, `${id}.png`), buffer);
  return { id, nombre: id.slice(PREFIJO_BANNER.length).replace(/-/g, ' ') };
}

// ---------- Render ----------

/** Corre "npx remotion render" sobre video-chat-prisma y devuelve la ruta del mp4 generado. */
async function renderizarVideo(guionTexto, plantillaId, bannerId) {
  const plantilla = PLANTILLAS[plantillaId];
  if (!plantilla) {
    throw new Error(`Plantilla desconocida: "${plantillaId}".`);
  }

  await fs.mkdir(path.dirname(GUION_PATH), { recursive: true });
  await fs.writeFile(GUION_PATH, guionTexto, 'utf-8');

  if (bannerId) {
    const origen = rutaImagenBanner(bannerId);
    if (!origen) {
      throw new Error(`Banner desconocido: "${bannerId}".`);
    }
    await fs.mkdir(BANNERS_DIR, { recursive: true });
    await fs.copyFile(origen, BANNER_ACTUAL_PATH);
  }
  // Si no se especifica bannerId, se deja actual.png tal cual está (el
  // último banner elegido sigue siendo el que se usa).

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

module.exports = {
  renderizarVideo,
  PLANTILLAS,
  listarBanners,
  guardarBannerNuevo,
  rutaImagenBanner,
};
