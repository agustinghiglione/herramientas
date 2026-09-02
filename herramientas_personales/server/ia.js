/**
 * Le pide a Gemini que devuelva el mismo documento, pero sin la información
 * que se le indique. Mismo enfoque que ya usamos en Prisma: REST directo a
 * la API (sin el SDK completo), capa gratuita de Gemini.
 */
const MODELO = 'gemini-2.0-flash';

async function limpiarDocumento(textoOriginal, instrucciones) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Falta GEMINI_API_KEY en el .env.local del servidor.');
  }

  const prompt = `Te paso el texto completo de un documento. Tu única tarea es devolver ese mismo documento, pero eliminando o reemplazando por "[eliminado]" la información que te indico abajo. No resumas, no comentes, no agregues nada tuyo (ni introducciones ni conclusiones) — devolvé el documento completo, con el mismo orden y la misma estructura, solo con esa información sacada.

Información a eliminar: ${instrucciones}

--- DOCUMENTO ---
${textoOriginal}
--- FIN DEL DOCUMENTO ---

Devolvé solo el texto del documento ya limpio, sin explicaciones antes ni después.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
      }),
    },
  );

  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`Gemini respondió ${res.status}: ${detalle.slice(0, 300)}`);
  }

  const datos = await res.json();
  const texto = datos?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!texto) throw new Error('Gemini no devolvió texto utilizable.');
  return texto;
}

module.exports = { limpiarDocumento };
