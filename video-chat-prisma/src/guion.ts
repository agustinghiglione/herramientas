/**
 * El "idioma" del guion de video: texto plano, una acción por línea (o un
 * bloque de varias líneas para respuestas largas), que cualquiera puede
 * escribir sin saber nada de código. Este archivo lo interpreta y arma la
 * línea de tiempo (en frames) que usa ChatVideo.tsx para saber, en cada
 * frame, qué se ve y qué se escucha.
 *
 * Formato de línea (mayúsculas/minúsculas da igual, la duración va en segundos):
 *   esperar (1s)
 *   usuario escribe (2s): texto que va tipeando el usuario
 *   usuario envia
 *   captura
 *   banner (4s): texto de cierre / promoción
 *
 * "esperar" es un silencio con la pantalla de inicio a la vista (con sus
 * sugerencias) — útil como primer renglón del guion, para que no arranque
 * tipeando de golpe en el frame 0.
 *
 * Respuesta del chat — forma corta (una línea, sin formato):
 *   chat responde (3s): texto que "dice" el chat
 *
 * Respuesta del chat — forma larga (varias líneas, con negrita y tablas),
 * para respuestas que se ven "reales" tipo ChatGPT. Se abre dejando los dos
 * puntos vacíos, y se cierra con una línea que diga exactamente "---":
 *
 *   chat responde (6s):
 *   Primer párrafo de la respuesta.
 *
 *   Segundo párrafo, puede usar **negrita** así, o ++destacado++ (color de
 *   marca) para cuando la respuesta recomienda algo nuestro y ese texto
 *   tiene que llamar la atención — por ejemplo ++Consultora Prisma++.
 *
 *   tabla:
 *   🥇 | Uso | Herramienta | Por qué la recomiendo | Fuente
 *   🏢 | Otro uso | Otra herramienta | Otra razón | Fuente
 *   fin tabla
 *   ---
 *
 * Cada fila de tabla son 5 campos separados por "|": ícono, etiqueta,
 * nombre de la herramienta (sale en negrita), la razón, y una fuente
 * opcional (si se omite, no se muestra el chip de fuente en esa fila).
 *
 * Líneas vacías o que empiezan con # se ignoran.
 */

export interface Span {
  texto: string;
  negrita: boolean;
  /** Color de marca — para cuando la respuesta recomienda algo nuestro y ese texto tiene que llamar la atención. */
  destacado: boolean;
}

export interface FilaTabla {
  icono: string;
  etiqueta: string;
  herramienta: string;
  porque: string;
  fuente?: string;
}

export type BloqueContenido = { tipo: 'parrafo'; spans: Span[] } | { tipo: 'tabla'; filas: FilaTabla[] };

export type AccionGuion =
  | { tipo: 'esperar'; segundos: number }
  | { tipo: 'escribe'; segundos: number; texto: string }
  | { tipo: 'envia' }
  | { tipo: 'responde'; segundos: number; contenido: BloqueContenido[] }
  | { tipo: 'captura' }
  | { tipo: 'banner'; segundos: number; texto: string };

export interface EventoTimeline {
  accion: AccionGuion;
  desde: number; // frame de inicio (inclusive)
  hasta: number; // frame de fin (exclusive)
}

export interface MensajeComprometido {
  rol: 'usuario' | 'chat';
  contenido: BloqueContenido[];
  frame: number; // frame en el que el mensaje pasa a formar parte del historial fijo
}

export interface GuionParseado {
  eventos: EventoTimeline[];
  mensajesComprometidos: MensajeComprometido[];
  duracionTotal: number; // en frames
}

// Duraciones fijas para acciones que no llevan tiempo explícito en el guion.
const DURACION_ENVIA_SEG = 0.5; // coincide con el audio de "mensaje enviado"

// El evento "captura" tiene dos tiempos: primero una pausa de lectura sobre
// el chat ya terminado (se mira la respuesta un segundo antes de "sacar la
// captura"), y recién después el flash + sonido de screenshot, justo antes
// de que entre el banner — no al revés (antes el flash saltaba apenas
// terminaba el chat, y la pausa quedaba DESPUÉS del flash, con el banner
// recién entrando al final de esa pausa).
export const ESPERA_CAPTURA_SEG = 1; // pausa antes del flash, mirando el chat ya terminado
const DURACION_FLASH_CAPTURA_SEG = 0.5; // flash breve — el banner corta enseguida después
export const DURACION_CAPTURA_SEG = ESPERA_CAPTURA_SEG + DURACION_FLASH_CAPTURA_SEG;
// Fracción del evento "captura" en la que arranca el flash — la comparten el
// audio (ChatVideo.tsx) y el destello visual (Captura.tsx) para que nunca
// queden desincronizados entre sí.
export const FRACCION_ESPERA_CAPTURA = ESPERA_CAPTURA_SEG / DURACION_CAPTURA_SEG;

// Cuántas "unidades" de revelado vale una fila de tabla, comparado con una
// palabra suelta de un párrafo — así una tabla no aparece de golpe ni tarda
// una eternidad en revelarse.
const PESO_FILA_TABLA = 6;

/** Convierte "texto con **negrita** y ++destacado++ así" en spans. */
function parsearParrafo(texto: string): BloqueContenido {
  const spans: Span[] = [];
  const regex = /\*\*(.+?)\*\*|\+\+(.+?)\+\+/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texto)) !== null) {
    if (m.index > ultimo) {
      spans.push({ texto: texto.slice(ultimo, m.index), negrita: false, destacado: false });
    }
    if (m[1] !== undefined) {
      spans.push({ texto: m[1], negrita: true, destacado: false });
    } else if (m[2] !== undefined) {
      spans.push({ texto: m[2], negrita: false, destacado: true });
    }
    ultimo = regex.lastIndex;
  }
  if (ultimo < texto.length) {
    spans.push({ texto: texto.slice(ultimo), negrita: false, destacado: false });
  }
  return { tipo: 'parrafo', spans: spans.filter((s) => s.texto !== '') };
}

/** Texto plano de un conjunto de bloques, usado solo para logs/():* nada crítico. */
function textoPlano(bloques: BloqueContenido[]): string {
  return bloques
    .map((b) => (b.tipo === 'parrafo' ? b.spans.map((s) => s.texto).join('') : b.filas.map((f) => f.herramienta).join(', ')))
    .join(' ');
}

/**
 * Lee el bloque multilínea de una respuesta larga, empezando en `desde`
 * (la línea siguiente a "chat responde (Ns):"). Devuelve los bloques de
 * contenido y el índice de línea desde el que hay que seguir parseando.
 */
function leerBloqueRespuesta(lineas: string[], desde: number): { contenido: BloqueContenido[]; siguienteIndice: number } {
  const bloques: BloqueContenido[] = [];
  let parrafoActual: string[] = [];
  let i = desde;
  let terminado = false;

  const cerrarParrafo = () => {
    if (parrafoActual.length > 0) {
      bloques.push(parsearParrafo(parrafoActual.join(' ')));
      parrafoActual = [];
    }
  };

  while (i < lineas.length && !terminado) {
    const l = lineas[i].trim();

    if (l === '---') {
      i++;
      terminado = true;
      break;
    }

    // Corte de seguridad: si el guion se olvidó el "---" y arranca un
    // comando nuevo, cerramos el bloque acá en vez de tragarnos todo lo
    // que sigue como si fuera parte de la respuesta.
    if (/^(esperar|usuario (escribe|env[ií]a)|chat responde|captura|banner)\b/i.test(l)) {
      terminado = true;
      break;
    }

    if (l === '') {
      cerrarParrafo();
      i++;
      continue;
    }

    if (/^tabla\s*:?\s*$/i.test(l)) {
      cerrarParrafo();
      i++;
      const filas: FilaTabla[] = [];
      while (i < lineas.length) {
        const filaCruda = lineas[i].trim();
        if (filaCruda === '---') {
          terminado = true;
          i++;
          break;
        }
        if (/^fin tabla\s*$/i.test(filaCruda)) {
          i++;
          break;
        }
        if (filaCruda === '') {
          i++;
          continue;
        }
        const partes = filaCruda.split('|').map((p) => p.trim());
        filas.push({
          icono: partes[0] || '',
          etiqueta: partes[1] || '',
          herramienta: partes[2] || '',
          porque: partes[3] || '',
          fuente: partes[4] || undefined,
        });
        i++;
      }
      bloques.push({ tipo: 'tabla', filas });
      continue;
    }

    parrafoActual.push(l);
    i++;
  }

  cerrarParrafo();
  return { contenido: bloques, siguienteIndice: i };
}

export function parsearGuion(texto: string, fps: number): GuionParseado {
  const lineas = texto.split('\n');
  const acciones: AccionGuion[] = [];

  let i = 0;
  while (i < lineas.length) {
    const l = lineas[i].trim();
    i++;
    if (!l || l.startsWith('#')) continue;

    let m = l.match(/^esperar\s*\(([\d.]+)\s*s?\)\s*$/i);
    if (m) {
      acciones.push({ tipo: 'esperar', segundos: parseFloat(m[1]) });
      continue;
    }

    m = l.match(/^usuario escribe\s*\(([\d.]+)\s*s?\)\s*:\s*(.+)$/i);
    if (m) {
      acciones.push({ tipo: 'escribe', segundos: parseFloat(m[1]), texto: m[2].trim() });
      continue;
    }

    m = l.match(/^usuario env[ií]a\s*$/i);
    if (m) {
      acciones.push({ tipo: 'envia' });
      continue;
    }

    // Forma corta: todo en una línea.
    m = l.match(/^chat responde\s*\(([\d.]+)\s*s?\)\s*:\s*(.+)$/i);
    if (m) {
      acciones.push({ tipo: 'responde', segundos: parseFloat(m[1]), contenido: [parsearParrafo(m[2].trim())] });
      continue;
    }

    // Forma larga: los dos puntos quedan vacíos, el contenido viene en las líneas de abajo.
    m = l.match(/^chat responde\s*\(([\d.]+)\s*s?\)\s*:\s*$/i);
    if (m) {
      const segundos = parseFloat(m[1]);
      const { contenido, siguienteIndice } = leerBloqueRespuesta(lineas, i);
      acciones.push({ tipo: 'responde', segundos, contenido });
      i = siguienteIndice;
      continue;
    }

    m = l.match(/^captura\s*$/i);
    if (m) {
      acciones.push({ tipo: 'captura' });
      continue;
    }

    m = l.match(/^banner\s*\(([\d.]+)\s*s?\)\s*:\s*(.+)$/i);
    if (m) {
      acciones.push({ tipo: 'banner', segundos: parseFloat(m[1]), texto: m[2].trim() });
      continue;
    }

    console.warn(`[guion] línea no reconocida, se ignora: "${l}"`);
  }

  const eventos: EventoTimeline[] = [];
  const mensajesComprometidos: MensajeComprometido[] = [];
  let cursor = 0;
  let escribiendoActual: string | null = null;

  for (const accion of acciones) {
    if (accion.tipo === 'esperar') {
      const dur = Math.max(1, Math.round(accion.segundos * fps));
      eventos.push({ accion, desde: cursor, hasta: cursor + dur });
      cursor += dur;
    } else if (accion.tipo === 'escribe') {
      const dur = Math.max(1, Math.round(accion.segundos * fps));
      eventos.push({ accion, desde: cursor, hasta: cursor + dur });
      cursor += dur;
      escribiendoActual = accion.texto;
    } else if (accion.tipo === 'envia') {
      const dur = Math.max(1, Math.round(DURACION_ENVIA_SEG * fps));
      eventos.push({ accion, desde: cursor, hasta: cursor + dur });
      cursor += dur;
      if (escribiendoActual !== null) {
        mensajesComprometidos.push({
          rol: 'usuario',
          contenido: [parsearParrafo(escribiendoActual)],
          frame: cursor,
        });
        escribiendoActual = null;
      }
    } else if (accion.tipo === 'responde') {
      const dur = Math.max(1, Math.round(accion.segundos * fps));
      eventos.push({ accion, desde: cursor, hasta: cursor + dur });
      cursor += dur;
      mensajesComprometidos.push({ rol: 'chat', contenido: accion.contenido, frame: cursor });
    } else if (accion.tipo === 'captura') {
      const dur = Math.max(1, Math.round(DURACION_CAPTURA_SEG * fps));
      eventos.push({ accion, desde: cursor, hasta: cursor + dur });
      cursor += dur;
    } else if (accion.tipo === 'banner') {
      const dur = Math.max(1, Math.round(accion.segundos * fps));
      eventos.push({ accion, desde: cursor, hasta: cursor + dur });
      cursor += dur;
    }
  }

  return { eventos, mensajesComprometidos, duracionTotal: Math.max(cursor, fps) };
}

export function eventoEnFrame(eventos: EventoTimeline[], frame: number): EventoTimeline | undefined {
  return eventos.find((e) => frame >= e.desde && frame < e.hasta);
}

/** Progreso (0 a 1) de la animación de entrada/salida del teclado virtual, en frames. */
const FRAMES_DESLIZAMIENTO = 10;

export function progresoTeclado(frame: number, eventos: EventoTimeline[]): number {
  const eventosEscribe = eventos.filter((e) => e.accion.tipo === 'escribe');
  for (const e of eventosEscribe) {
    if (frame >= e.desde - FRAMES_DESLIZAMIENTO && frame < e.desde) {
      return (frame - (e.desde - FRAMES_DESLIZAMIENTO)) / FRAMES_DESLIZAMIENTO;
    }
    if (frame >= e.desde && frame < e.hasta) return 1;
    if (frame >= e.hasta && frame < e.hasta + FRAMES_DESLIZAMIENTO) {
      return 1 - (frame - e.hasta) / FRAMES_DESLIZAMIENTO;
    }
  }
  return 0;
}

/** Pseudoaleatorio determinístico en [0,1) — mismo resultado siempre para la misma semilla, sin depender de Math.random() (Remotion necesita que cada frame se pueda recalcular igual, en cualquier orden). */
function pseudoAleatorio(semilla: number): number {
  const x = Math.sin(semilla * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Curva de tipeo con ritmo humano: no todos los caracteres tardan lo mismo.
 * Pausas más largas después de espacios y signos de puntuación, y una
 * pequeña variación aleatoria (pero determinística) carácter a carácter —
 * así el tipeo no se ve como un contador lineal. Devuelve, para cada
 * carácter, el umbral acumulado (0 a 1) en el que termina de "aparecer".
 */
export function curvaTipeo(texto: string): number[] {
  const n = texto.length;
  if (n === 0) return [];
  const pesos: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = texto[i];
    let peso = 1;
    if (c === ' ') peso = 2.4;
    else if (/[.,;:?!¿¡—-]/.test(c)) peso = 3.2;
    const jitter = 0.7 + pseudoAleatorio(i * 7.13 + n * 0.37) * 0.6; // 0.7x a 1.3x
    pesos.push(Math.max(0.3, peso * jitter));
  }
  const total = pesos.reduce((a, b) => a + b, 0);
  let acumulado = 0;
  return pesos.map((p) => {
    acumulado += p;
    return acumulado / total;
  });
}

/**
 * Dado un texto y un progreso (0 a 1) sobre su curva de tipeo, devuelve
 * cuánto texto ya "apareció" y qué letra está en pleno tipeo ahora mismo
 * (para sincronizar el teclado) — una sola fuente de verdad para el texto
 * parcial y la tecla activa, así nunca se desincronizan entre sí.
 */
export function estadoTipeo(texto: string, progreso: number): { textoVisible: string; letraActiva: string | null; faseActiva: number } {
  if (texto.length === 0) return { textoVisible: '', letraActiva: null, faseActiva: 0 };

  const curva = curvaTipeo(texto);
  const p = Math.min(1, Math.max(0, progreso));

  let visibles = 0;
  for (const umbral of curva) {
    if (umbral <= p) visibles++;
    else break;
  }

  const indiceActivo = visibles < texto.length ? visibles : texto.length - 1;
  const umbralAnterior = indiceActivo === 0 ? 0 : curva[indiceActivo - 1];
  const umbralActual = curva[indiceActivo];
  const fase = umbralActual > umbralAnterior ? (p - umbralAnterior) / (umbralActual - umbralAnterior) : 1;

  return {
    textoVisible: texto.slice(0, visibles),
    letraActiva: texto[indiceActivo].toUpperCase(),
    faseActiva: Math.min(1, Math.max(0, fase)),
  };
}

/** Cuántas "unidades" de revelado (palabras, filas de tabla) tiene un conjunto de bloques. */
export function contarUnidades(bloques: BloqueContenido[]): number {
  let total = 0;
  for (const b of bloques) {
    if (b.tipo === 'parrafo') {
      total += b.spans.reduce((acc, s) => acc + (s.texto.trim().split(/\s+/).filter(Boolean).length || 0), 0);
    } else {
      total += b.filas.length * PESO_FILA_TABLA;
    }
  }
  return Math.max(1, total);
}

/**
 * Devuelve una versión parcial de los bloques, revelada hasta `progreso`
 * (0 a 1) — párrafos revelados palabra por palabra, tablas reveladas fila
 * por fila. Así una respuesta larga con tabla se arma en cámara en vez de
 * aparecer entera de golpe.
 */
export function revelarContenido(bloques: BloqueContenido[], progreso: number): BloqueContenido[] {
  const total = contarUnidades(bloques);
  let restantes = Math.max(0, Math.ceil(total * Math.min(1, Math.max(0, progreso))));
  const resultado: BloqueContenido[] = [];

  for (const b of bloques) {
    if (restantes <= 0) break;

    if (b.tipo === 'parrafo') {
      const spansRevelados: Span[] = [];
      for (const span of b.spans) {
        if (restantes <= 0) break;
        const partes = span.texto.split(/(\s+)/);
        let textoSpan = '';
        let usados = 0;
        for (const parte of partes) {
          if (parte.trim() === '') {
            textoSpan += parte;
            continue;
          }
          if (usados >= restantes) break;
          textoSpan += parte;
          usados++;
        }
        if (textoSpan) spansRevelados.push({ texto: textoSpan, negrita: span.negrita, destacado: span.destacado });
        restantes -= usados;
      }
      if (spansRevelados.length > 0) resultado.push({ tipo: 'parrafo', spans: spansRevelados });
    } else {
      const filasAMostrar = Math.min(b.filas.length, Math.floor(restantes / PESO_FILA_TABLA));
      if (filasAMostrar > 0) {
        resultado.push({ tipo: 'tabla', filas: b.filas.slice(0, filasAMostrar) });
        restantes -= filasAMostrar * PESO_FILA_TABLA;
      } else {
        restantes = 0;
      }
    }
  }

  return resultado;
}

export { textoPlano };
