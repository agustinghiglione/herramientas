/**
 * Saca el texto plano de un archivo subido (PDF, DOCX o TXT), sin guardar
 * nada en disco — todo se procesa en memoria a partir del buffer que llega
 * del upload, y se descarta apenas termina la request. No hay carpeta de
 * "subidos" ni base de datos: nada del documento del cliente queda en el
 * servidor más tiempo del que dura el pedido.
 */
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

async function extraerTexto(buffer, nombreArchivo, mimetype) {
  const extension = (nombreArchivo.split('.').pop() || '').toLowerCase();

  if (extension === 'pdf' || mimetype === 'application/pdf') {
    const resultado = await pdfParse(buffer);
    return resultado.text;
  }

  if (
    extension === 'docx' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const resultado = await mammoth.extractRawText({ buffer });
    return resultado.value;
  }

  if (extension === 'txt' || mimetype === 'text/plain') {
    return buffer.toString('utf-8');
  }

  throw new Error(`Formato no soportado (.${extension}). Por ahora acepto PDF, DOCX o TXT.`);
}

module.exports = { extraerTexto };
