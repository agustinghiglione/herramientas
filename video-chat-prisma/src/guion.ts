/**
 * El "idioma" del guion de video: texto plano, una acción por línea, que
 * cualquiera puede escribir sin saber nada de código. Este archivo lo
 * interpreta y arma la línea de tiempo (en frames) que usa ChatVideo.tsx
 * para saber, en cada frame, qué se ve y qué se escucha.
 *
 * Formato de línea (mayúsculas/minúsculas da igual, la duración va en segundos):
 *   usuario escribe (2s): texto que va tipeando el usuario
 *   usuario envia
 *   chat responde (3s): texto que "dice" el chat, se revela en el tiempo dado
 *   captura
 *   banner (4s): texto de cierre / promoción
 *
 * Líneas vacías o que empiezan con # se ignoran.
 */

export type AccionGuion =
  | { tipo: 'escribe'; segundos: number; texto: string }
  | { tipo: 'envia' }
  | { tipo: 'responde'; segundos: number; texto: string }
  | { tipo: 'captura' }
  | { tipo: 'banner'; segundos: number; texto: string };

export interface EventoTimeline {
  accion: AccionGuion;
  desde: number; // frame de inicio (inclusive)
  hasta: number; // frame de fin (exclusive)
}

export interface MensajeComprometido {
  rol: 'usuario' | 'chat';
  texto: string;
  frame: number; // frame en el que el mensaje pasa a formar parte del historial fijo
}

export interface GuionParseado {
  eventos: EventoTimeline[];
  mensajesComprometidos: MensajeComprometido[];
  duracionTotal: number; // en frames
}

// Duraciones fijas para acciones que no llevan tiempo explícito en el guion.
const DURACION_ENVIA_SEG = 0.5; // coincide con el audio de "mensaje enviado"
const DURACION_CAPTURA_SEG = 1.8; // apenas más que el audio de screenshot (1.72s)

function parsearLinea(lineaCruda: string): AccionGuion | null {
  const l = lineaCruda.trim();
  if (!l || l.startsWith('#')) return null;

  let m = l.match(/^usuario escribe\s*\(([\d.]+)\s*s?\)\s*:\s*(.+)$/i);
  if (m) return { tipo: 'escribe', segundos: parseFloat(m[1]), texto: m[2].trim() };

  m = l.match(/^usuario env[ií]a\s*$/i);
  if (m) return { tipo: 'envia' };

  m = l.match(/^chat responde\s*\(([\d.]+)\s*s?\)\s*:\s*(.+)$/i);
  if (m) return { tipo: 'responde', segundos: parseFloat(m[1]), texto: m[2].trim() };

  m = l.match(/^captura\s*$/i);
  if (m) return { tipo: 'captura' };

  m = l.match(/^banner\s*\(([\d.]+)\s*s?\)\s*:\s*(.+)$/i);
  if (m) return { tipo: 'banner', segundos: parseFloat(m[1]), texto: m[2].trim() };

  console.warn(`[guion] línea no reconocida, se ignora: "${l}"`);
  return null;
}

export function parsearGuion(texto: string, fps: number): GuionParseado {
  const acciones = texto
    .split('\n')
    .map(parsearLinea)
    .filter((a): a is AccionGuion => a !== null);

  const eventos: EventoTimeline[] = [];
  const mensajesComprometidos: MensajeComprometido[] = [];
  let cursor = 0;
  let escribiendoActual: string | null = null;

  for (const accion of acciones) {
    if (accion.tipo === 'escribe') {
      const dur = Math.max(1, Math.round(accion.segundos * fps));
      eventos.push({ accion, desde: cursor, hasta: cursor + dur });
      cursor += dur;
      escribiendoActual = accion.texto;
    } else if (accion.tipo === 'envia') {
      const dur = Math.max(1, Math.round(DURACION_ENVIA_SEG * fps));
      eventos.push({ accion, desde: cursor, hasta: cursor + dur });
      cursor += dur;
      if (escribiendoActual !== null) {
        mensajesComprometidos.push({ rol: 'usuario', texto: escribiendoActual, frame: cursor });
        escribiendoActual = null;
      }
    } else if (accion.tipo === 'responde') {
      const dur = Math.max(1, Math.round(accion.segundos * fps));
      eventos.push({ accion, desde: cursor, hasta: cursor + dur });
      cursor += dur;
      mensajesComprometidos.push({ rol: 'chat', texto: accion.texto, frame: cursor });
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
