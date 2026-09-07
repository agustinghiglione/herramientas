/**
 * Saca el texto de un PDF PÁGINA POR PÁGINA, pero a diferencia de pdf-parse
 * (que usamos en la limpieza de texto libre) acá necesitamos la POSICIÓN de
 * cada fragmento de texto dentro de la página — para poder despué dibujar un
 * recuadro negro exactamente donde está el dato sensible.
 *
 * pdfjs-dist (v4) solo viene en formato ESM, así que se importa con
 * import() dinámico aunque este archivo sea CommonJS — es la forma
 * soportada de usar un paquete ESM desde código CJS en Node.
 *
 * Cada "item" de texto que devuelve pdf.js suele ser una palabra o un
 * fragmento corto (no la línea entera), así que le asignamos un id
 * incremental a cada uno — ese id es lo que via   ja de acá a la detección
 * (regex e IA) y de vuelta a las coordenadas, sin tener que volver a buscar
 * el texto dentro de la página (evita falsos matches con texto repetido).
 */

let pdfjsPromise = null;
function cargarPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsPromise;
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<Array<{
 *   numero: number,
 *   anchoPt: number,
 *   altoPt: number,
 *   items: Array<{ id: number, texto: string, xPct: number, yPct: number, wPct: number, hPct: number }>
 * }>>}
 */
async function extraerPosiciones(buffer) {
  const pdfjs = await cargarPdfjs();
  // Node no tiene Worker de DOM — desactivamos el worker y dejamos que
  // pdf.js parsee todo en el mismo proceso (más simple para un uso puntual
  // como este, sin necesidad de hilos separados).
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;

  const paginas = [];
  let idGlobal = 0;

  for (let numero = 1; numero <= doc.numPages; numero++) {
    const pagina = await doc.getPage(numero);
    const viewport = pagina.getViewport({ scale: 1 });
    const anchoPt = viewport.width;
    const altoPt = viewport.height;

    const contenido = await pagina.getTextContent();
    const items = [];

    for (const item of contenido.items) {
      const texto = item.str;
      if (!texto || !texto.trim()) continue;

      // item.transform = [a, b, c, d, e, f] — e,f es la posición (origen
      // abajo-izquierda, como en PDF). item.width/height ya vienen en
      // unidades de página (pt) a escala 1.
      const [, , , , e, f] = item.transform;
      const ancho = item.width;
      const alto = item.height || Math.abs(item.transform[3]) || 10;

      // Convertimos a porcentaje de la página, con origen arriba-izquierda
      // (así el frontend puede dibujar el recuadro con CSS sin pensar en
      // sistemas de coordenadas de PDF).
      const xPct = (e / anchoPt) * 100;
      const yPct = ((altoPt - f - alto) / altoPt) * 100;
      const wPct = (ancho / anchoPt) * 100;
      const hPct = (alto / altoPt) * 100;

      items.push({ id: idGlobal++, texto, xPct, yPct, wPct, hPct });
    }

    paginas.push({ numero, anchoPt, altoPt, items });
  }

  await doc.destroy();
  return paginas;
}

module.exports = { extraerPosiciones };
