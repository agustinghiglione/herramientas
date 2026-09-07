/**
 * Todo lo que tiene que ver con convertir páginas de PDF a imagen y volver
 * a armar un PDF final. Acá está la parte que hace que la censura sea
 * REAL: una vez que sabemos qué recuadros hay que tapar en una página, esa
 * página se convierte en una simple imagen (foto) con los recuadros negros
 * ya "quemados" encima — no queda ningún texto seleccionable ni oculto
 * debajo, porque la página entera dejó de ser texto. Por eso no importa
 * qué visor de PDF use quien lo reciba: no hay forma de copiar lo que está
 * tapado, porque ya no existe como texto en el archivo.
 *
 * Las páginas que NO tienen ningún dato tapado se copian tal cual del PDF
 * original (siguen siendo vectoriales, se ven nítidas y el texto sigue
 * siendo seleccionable) — solo se "queman" las páginas que de verdad hacen
 * falta.
 *
 * Usa `pdftoppm` (parte de poppler-utils, un binario del sistema — NO un
 * paquete de npm) para rasterizar, y `sharp` para pintar los recuadros
 * negros encima de la imagen resultante.
 */

const { execFile } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

const DPI_PREVISUALIZACION = 120; // para mostrar en el navegador mientras se revisa
const DPI_FINAL = 200; // para el PDF final descargado — buena nitidez sin pesar demasiado

function ejecutar(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${cmd} falló: ${(stderr || err.message || '').toString().slice(0, 500)}`));
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * Rasteriza UNA página del PDF a un buffer PNG.
 * @param {string} pdfPath ruta al PDF en disco
 * @param {number} numeroPagina 1-indexado
 * @param {number} dpi
 */
async function rasterizarPagina(pdfPath, numeroPagina, dpi) {
  const prefijo = path.join(path.dirname(pdfPath), `pg-${numeroPagina}-${dpi}-${Date.now()}`);
  await ejecutar('pdftoppm', [
    '-png',
    '-r',
    String(dpi),
    '-f',
    String(numeroPagina),
    '-l',
    String(numeroPagina),
    '-singlefile',
    pdfPath,
    prefijo,
  ]);
  const archivoGenerado = `${prefijo}.png`;
  const buffer = await fs.readFile(archivoGenerado);
  await fs.unlink(archivoGenerado).catch(() => {});
  return buffer;
}

/** Genera el SVG con los rectángulos negros para pintar encima de la imagen de la página. */
function svgDeCajas(anchoPx, altoPx, cajas) {
  const rects = cajas
    .map((c) => {
      const x = (c.xPct / 100) * anchoPx;
      const y = (c.yPct / 100) * altoPx;
      const w = (c.wPct / 100) * anchoPx;
      const h = (c.hPct / 100) * altoPx;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="#000"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${anchoPx}" height="${altoPx}">${rects}</svg>`;
}

/**
 * Devuelve una imagen PNG (buffer) de la página a baja resolución, para
 * mostrarla en el navegador durante la revisión (sin recuadros — esos los
 * dibuja el frontend con CSS encima, así el usuario puede tildar/destildar
 * sin volver a pedir la imagen).
 */
async function previsualizarPagina(pdfPath, numeroPagina) {
  return rasterizarPagina(pdfPath, numeroPagina, DPI_PREVISUALIZACION);
}

/**
 * Arma el PDF final: copia las páginas sin detecciones activas tal cual
 * (vectoriales), y "quema" con recuadros negros las que sí tienen alguna.
 *
 * @param {string} pdfPath ruta al PDF original en disco
 * @param {Array<{numero:number, detecciones:Array<{activo:boolean, cajas:Array}>}>} paginas
 */
async function generarPdfCensurado(pdfPath, paginas) {
  const bytesOriginal = await fs.readFile(pdfPath);
  const docOriginal = await PDFDocument.load(bytesOriginal);
  const docFinal = await PDFDocument.create();

  for (const pagina of paginas) {
    const indice = pagina.numero - 1;
    const cajasActivas = pagina.detecciones.filter((d) => d.activo).flatMap((d) => d.cajas);

    if (cajasActivas.length === 0) {
      // Sin nada que tapar: se copia la página original, vectorial e intacta.
      const [copiada] = await docFinal.copyPages(docOriginal, [indice]);
      docFinal.addPage(copiada);
      continue;
    }

    // Con algo que tapar: se rasteriza a buena resolución, se queman los
    // recuadros negros, y esa imagen pasa a ser la página entera.
    const bufferPagina = await rasterizarPagina(pdfPath, pagina.numero, DPI_FINAL);
    const metadata = await sharp(bufferPagina).metadata();
    const anchoPx = metadata.width;
    const altoPx = metadata.height;

    const svg = svgDeCajas(anchoPx, altoPx, cajasActivas);
    const bufferConCajas = await sharp(bufferPagina)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toBuffer();

    const imagenEmbebida = await docFinal.embedPng(bufferConCajas);
    // Tamaño de página en puntos (1/72"), a partir del tamaño en píxeles y el DPI usado.
    const anchoPt = (anchoPx / DPI_FINAL) * 72;
    const altoPt = (altoPx / DPI_FINAL) * 72;
    const paginaNueva = docFinal.addPage([anchoPt, altoPt]);
    paginaNueva.drawImage(imagenEmbebida, { x: 0, y: 0, width: anchoPt, height: altoPt });
  }

  return Buffer.from(await docFinal.save());
}

module.exports = { previsualizarPagina, generarPdfCensurado, DPI_PREVISUALIZACION, DPI_FINAL };
