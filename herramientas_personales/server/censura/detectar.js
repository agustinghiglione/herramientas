/**
 * Detecta datos sensibles dentro de los items de texto que ya sacamos con
 * posición (extraerPosiciones.js). Dos motores, porque cada uno es bueno en
 * lo suyo:
 *
 *  - Patrones (regex): para todo lo que tiene un formato fijo y no hace
 *    falta "entender" el texto — DNI/NIE, email, teléfono, IBAN/cuenta y
 *    fechas. Rápido, gratis y 100% confiable dentro de su formato.
 *
 *  - Gemini: para lo que SÍ requiere entender el texto — nombres y
 *    apellidos de personas, y direcciones postales. Le pasamos la lista de
 *    items de la página (con su id) y le pedimos que nos diga, por cada
 *    dato que encuentre, en qué id(s) está y el fragmento exacto de texto
 *    dentro de cada uno — así podemos ubicar la posición exacta sin tener
 *    que volver a buscar el texto (evita falsos matches con texto repetido
 *    en la página) incluso cuando el dato viene metido en medio de una
 *    oración y no en un renglón propio.
 *
 * Cada detección final queda con: categoria, y una lista de "cajas"
 * (una por item que toca), cada una ya recortada al fragmento exacto
 * dentro del ancho del item (aproximando la posición del caracter de
 * forma lineal — no tenemos el ancho de cada letra individual, pero para
 * dibujar un recuadro negro alcanza y sobra con esa aproximación, sumando
 * un margen chico para no cortar el dato por un pixel).
 */

const MODELO = 'gemini-2.0-flash';
const MARGEN_VERTICAL_PCT = 0.3; // margen extra arriba/abajo de cada caja, en % de la página
const PADDING_CARACTERES = 1.4; // "caracteres" extra de margen a cada lado (ver nota en cajaDesdeRango)

// Ancho relativo aproximado de cada tipo de caracter, para ubicar un
// fragmento dentro de un item mejor que con un simple conteo de caracteres
// (que le erraría bastante en textos con muchos espacios/dígitos, como
// "Fecha de nacimiento: 14/03/1985" — dígitos y espacios son más angostos
// que el promedio de una letra minúscula). Sigue siendo una aproximación
// (no tenemos las métricas reales de la fuente), por eso además sumamos el
// margen de PADDING_CARACTERES a cada lado.
function anchoRelativo(caracter) {
  if (/[0-9]/.test(caracter)) return 0.56;
  if (caracter === ' ') return 0.28;
  if ('.,:;\'"|!ilj'.includes(caracter)) return 0.32;
  if ('mwMW'.includes(caracter)) return 0.92;
  if (/[A-ZÁÉÍÓÚÑ]/.test(caracter)) return 0.68;
  return 0.52;
}

/** Posición horizontal acumulada (0..1) del caracter `indice` dentro de `texto`. */
function posicionRelativa(texto, indice) {
  let total = 0;
  for (let i = 0; i < texto.length; i++) total += anchoRelativo(texto[i]);
  if (total === 0) return indice / (texto.length || 1);
  let acumulado = 0;
  for (let i = 0; i < indice; i++) acumulado += anchoRelativo(texto[i]);
  return acumulado / total;
}

// ---------- Patrones ----------

const PATRONES = [
  { categoria: 'dni_nie', re: /\b(?:[0-9]{8}[A-Za-z]|[XYZxyz][0-9]{7}[A-Za-z])\b/g },
  { categoria: 'email', re: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g },
  { categoria: 'telefono', re: /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}\b(?=[^%]|$)/g },
  { categoria: 'iban_cuenta', re: /\b[A-Za-z]{2}\d{2}(?:[\s]?\d{4}){4,6}\b/g },
  {
    categoria: 'fecha',
    re: /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b|\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?\d{2,4}\b/gi,
  },
];

// Los teléfonos son el patrón más "ambiguo" (números de bloque con espacios
// también matchean cosas como IBANs cortos o códigos postales largos). Para
// no generar demasiados falsos positivos, un teléfono válido tiene que tener
// al menos 7 dígitos en total.
function contarDigitos(s) {
  return (s.match(/\d/g) || []).length;
}

function contextoContiene(texto, palabras, ventana = 45) {
  const bajo = texto.toLowerCase();
  return palabras.some((p) => bajo.includes(p));
}

/** Corre los patrones sobre el texto de UN item y devuelve fragmentos {categoria, inicio, fin, texto}. */
function detectarPatronesEnItem(item) {
  const candidatos = [];
  for (const { categoria, re } of PATRONES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(item.texto))) {
      if (categoria === 'telefono' && contarDigitos(m[0]) < 7) continue;
      if (categoria === 'iban_cuenta' && contarDigitos(m[0]) < 10) continue;
      let categoriaFinal = categoria;
      if (categoria === 'fecha') {
        categoriaFinal = contextoContiene(item.texto, ['nacimiento', 'nacido', 'nació', 'f. nac', 'fecha nac'])
          ? 'fecha_nacimiento'
          : 'fecha';
      }
      candidatos.push({ categoria: categoriaFinal, inicio: m.index, fin: m.index + m[0].length, texto: m[0] });
    }
  }

  // Varios patrones pueden matchear el mismo tramo (p. ej. un IBAN contiene
  // una racha de dígitos que también parece un teléfono). Nos quedamos con
  // el fragmento más largo de cada zona solapada, para no listar el mismo
  // dato dos veces con una etiqueta equivocada.
  candidatos.sort((a, b) => b.fin - b.inicio - (a.fin - a.inicio));
  const aceptados = [];
  for (const c of candidatos) {
    const solapaMucho = aceptados.some((a) => Math.min(a.fin, c.fin) - Math.max(a.inicio, c.inicio) > 0);
    if (!solapaMucho) aceptados.push(c);
  }
  return aceptados.sort((a, b) => a.inicio - b.inicio);
}

/**
 * Convierte un rango de caracteres [inicio,fin) dentro de item.texto a una
 * caja en % de página.
 *
 * pdf.js nos da el ancho total del item, pero no el de cada letra — para
 * ubicar un fragmento DENTRO de un item (p. ej. el "12345678Z" dentro de
 * "DNI: 12345678Z") solo podemos aproximar linealmente (ancho del item ×
 * proporción de caracteres). Con fuentes proporcionales eso tiene un margen
 * de error de hasta un caracter o dos, y en un tapado el error tiene que
 * jugar SIEMPRE a favor de tapar de más, nunca de menos — así que en vez de
 * un margen fijo en % de página (que no escala con el tamaño de fuente ni
 * el largo del fragmento), estiramos el rango en una fracción de caracter
 * completo a cada lado antes de convertir a porcentaje.
 */
function cajaDesdeRango(item, inicio, fin) {
  const largo = item.texto.length || 1;
  const inicioAcolchado = Math.max(0, inicio - PADDING_CARACTERES);
  const finAcolchado = Math.min(largo, fin + PADDING_CARACTERES);
  const desde = posicionRelativa(item.texto, Math.round(inicioAcolchado));
  const hasta = posicionRelativa(item.texto, Math.round(finAcolchado));
  return {
    xPct: Math.max(0, item.xPct + item.wPct * desde),
    yPct: Math.max(0, item.yPct - MARGEN_VERTICAL_PCT),
    wPct: item.wPct * (hasta - desde),
    hPct: item.hPct + MARGEN_VERTICAL_PCT * 2,
  };
}

// ---------- Gemini (nombres y direcciones) ----------

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    detecciones: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          categoria: { type: 'STRING', enum: ['nombre', 'direccion'] },
          fragmentos: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                id: { type: 'INTEGER' },
                texto: { type: 'STRING' },
              },
              required: ['id', 'texto'],
            },
          },
        },
        required: ['categoria', 'fragmentos'],
      },
    },
  },
  required: ['detecciones'],
};

async function detectarConGemini(items) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Sin la key, seguimos solo con los patrones — mejor detectar de menos
    // que romper el análisis entero.
    console.warn('[censura] Falta GEMINI_API_KEY — se omite la detección de nombres y direcciones.');
    return [];
  }
  if (items.length === 0) return [];

  const lista = items.map((it) => `${it.id}: ${it.texto}`).join('\n');
  const prompt = `Te paso el texto de una página de un documento (contrato, factura, nómina, etc.), partido en fragmentos numerados. Cada línea es "id: texto".

Tu tarea: encontrar SOLO dos tipos de datos personales:
- "nombre": nombre y apellido de una PERSONA física (no el nombre de una empresa, ni el de "Consultora Prisma", ni cargos como "el prestador" o "la empresa").
- "direccion": una dirección postal completa o parcial (calle, número, piso, código postal, ciudad) referida a una persona o domicilio particular.

No incluyas emails, teléfonos, DNI, IBAN ni fechas — de eso ya nos encargamos aparte.

Para cada dato que encuentres, devolvé en qué fragmento(s) está y copiá el TEXTO EXACTO (tal cual aparece, sin agregar ni sacar espacios) de la parte de ese fragmento que corresponde al dato — si el dato ocupa varios fragmentos consecutivos, listá uno por cada fragmento que toca.

Si no hay ningún nombre de persona ni dirección en el texto, devolvé una lista vacía.

Fragmentos:
${lista}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    },
  );

  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`Gemini respondió ${res.status}: ${detalle.slice(0, 300)}`);
  }

  const datos = await res.json();
  const texto = datos?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texto) return [];

  let parseado;
  try {
    parseado = JSON.parse(texto);
  } catch {
    console.warn('[censura] Gemini devolvió JSON inválido, se ignora esta página para nombre/dirección.');
    return [];
  }

  return Array.isArray(parseado.detecciones) ? parseado.detecciones : [];
}

// ---------- Combinar todo ----------

/**
 * @param {Array<{numero:number, anchoPt:number, altoPt:number, items:Array}>} paginas
 * @returns páginas con una lista `detecciones` agregada a cada una.
 */
async function detectarSensibles(paginas) {
  const resultado = [];
  let idDeteccion = 0;

  for (const pagina of paginas) {
    const detecciones = [];
    const itemsPorId = new Map(pagina.items.map((it) => [it.id, it]));

    // 1) Patrones, item por item.
    for (const item of pagina.items) {
      for (const frag of detectarPatronesEnItem(item)) {
        detecciones.push({
          id: idDeteccion++,
          categoria: frag.categoria,
          texto: frag.texto,
          activo: true,
          cajas: [cajaDesdeRango(item, frag.inicio, frag.fin)],
        });
      }
    }

    // 2) Gemini, para nombres y direcciones (puede fallar sin romper el resto).
    try {
      const deteccionesIA = await detectarConGemini(pagina.items);
      for (const det of deteccionesIA) {
        const cajas = [];
        const textos = [];
        for (const frag of det.fragmentos || []) {
          const item = itemsPorId.get(frag.id);
          if (!item || !frag.texto) continue;
          const inicio = item.texto.indexOf(frag.texto);
          if (inicio === -1) {
            // No calzó exacto (Gemini a veces normaliza espacios) — tapamos
            // el item completo antes que no tapar nada.
            cajas.push(cajaDesdeRango(item, 0, item.texto.length));
          } else {
            cajas.push(cajaDesdeRango(item, inicio, inicio + frag.texto.length));
          }
          textos.push(frag.texto);
        }
        if (cajas.length > 0) {
          detecciones.push({
            id: idDeteccion++,
            categoria: det.categoria,
            texto: textos.join(' '),
            activo: true,
            cajas,
          });
        }
      }
    } catch (err) {
      console.error('[censura] Gemini falló para esta página, se sigue solo con patrones:', err.message);
    }

    resultado.push({ ...pagina, detecciones });
  }

  return resultado;
}

module.exports = { detectarSensibles, cajaDesdeRango };
