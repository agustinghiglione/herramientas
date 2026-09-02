/**
 * Arma el PDF final a partir del texto ya limpio. Todo en memoria (un
 * buffer), nunca se escribe a disco — se devuelve directo como descarga.
 */
const PDFDocument = require('pdfkit');

function generarPdf(textoLimpio, nombreOriginal) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 56, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc
      .fontSize(10)
      .fillColor('#5b6672')
      .text(`Documento limpiado automáticamente a partir de: ${nombreOriginal}`, { align: 'right' });
    doc.moveDown(1.5);

    doc.fontSize(11).fillColor('#1a1a1a').text(textoLimpio, {
      align: 'left',
      lineGap: 4,
    });

    doc.end();
  });
}

module.exports = { generarPdf };
