import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FondoVideo } from './components/whatsapp/FondoVideo';
import { WhatsAppHeader } from './components/whatsapp/WhatsAppHeader';
import { ListaMensajesWhatsApp, MensajeWhatsApp } from './components/whatsapp/ListaMensajesWhatsApp';
import { ZonaEscrituraWhatsApp } from './components/whatsapp/ZonaEscrituraWhatsApp';
import { BannerPerro } from './components/whatsapp/BannerPerro';

/**
 * ============================================================================
 *  "El perro le escribe a la tienda" — v2, herramienta nueva separada de
 *  ChatVideo.
 * ============================================================================
 * A diferencia de la v1 (que cortaba del video real a una pantalla de
 * WhatsApp aparte, con flashes de corte), acá el metraje real del perro
 * (parte1 → parte2 → parte3) corre de punta a punta SIN cortes — la
 * "pantalla de WhatsApp" es un overlay TRANSLUCIDO encima de ese video, así
 * que el perro se sigue viendo siempre, como pidió Damian. El video final
 * NO usa el audio original de los clips — solo los efectos de sonido que
 * ponemos acá (tecleo + envío).
 *
 * Guion: el perro (haciéndose pasar por su dueña) le escribe directamente a
 * "Tienda +Cotas" (antes era la veterinaria — Damian pidió el cambio).
 * Escribe y envía el primer mensaje al final de parte1 (con sonido de
 * tecleo + sonido de envío), y el segundo al final de parte2 (ídem). Cada
 * mensaje se suma como burbuja fija, apilándose hacia abajo. Parte3 es el
 * remate: sin más tipeo, el teclado baja, se ve un instante la conversación
 * completa y el overlay se desvanece dejando solo al perro, que termina
 * sonriendo, antes del banner de cierre.
 *
 * Reusa la MISMA lógica de tipeo/teclado y los MISMOS sonidos (tecleo +
 * mensaje enviado) que ya usa la campaña de Consultora Prisma, pero vive en
 * su propia carpeta (components/whatsapp/) para no tocar esa herramienta.
 *
 * ---- Para ajustar el guion de ESTE anuncio, editar solo esta sección ----
 * (Los mensajes se reescribieron para que tengan sentido escribiéndole a la
 * tienda en vez de a la veterinaria — el texto exacto es un punto de
 * partida, fácil de ajustar con Damian antes de la entrega final.)
 */
const NOMBRE_CONTACTO = 'Tienda +Cotas';
const MENSAJE_1 = 'Hola, ¿cómo andan?';
const MENSAJE_2 = 'Otto está re copado con el juguete nuevo, ¿me guardan uno?';
const PALABRAS_PREDICTIVAS: [string, string, string] = ['perro', 'juguete', 'nuevo'];

// Duraciones de cada tramo, en segundos. Los tiempos de tipeo (~14
// caracteres/seg) se recalcularon para los mensajes nuevos, más cortos que
// los de la versión "veterinaria" — si se cambia el texto de nuevo,
// conviene reajustar estos dos también para que el tipeo no se sienta
// forzado.
const DUR_ENTRADA_TECLADO_SEG = 0.5; // el teclado sube apenas arranca parte1
const DUR_ESCRIBIR_1_SEG = 1.6;
const DUR_ENVIA_SEG = 0.5; // mismo tiempo para los dos envíos
const DUR_PAUSA_POST_ENVIO_1_SEG = 0.5;

const DUR_PAUSA_INICIO_2_SEG = 0.3; // el perro "chequea" un instante (parte2) antes de seguir escribiendo
const DUR_ESCRIBIR_2_SEG = 4.4;
const DUR_PAUSA_POST_ENVIO_2_SEG = 0.4;

const DUR_SALIDA_TECLADO_SEG = 0.4; // el teclado baja al arrancar parte3 — ya no hay más que escribir
const DUR_PAUSA_MENSAJES_SEG = 0.8; // los dos mensajes quedan un instante a la vista
const DUR_FADE_OVERLAY_SEG = 0.6; // todo el chat se desvanece, queda solo el perro
const DUR_RESTO_VIDEO_3_SEG = 0.4;

const DUR_BANNER_SEG = 2.2;

const AUDIO_TECLADO = 'audio/u_a4gfvwagf1-iphone-keyboard-typing-sound-effect-336778.mp3';
const AUDIO_ENVIA = 'audio/son_duquotidient-message-envoye-iphone-apple-391098.mp3';

export const PerroWhatsApp: React.FC = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const seg = (s: number) => Math.round(s * fps);

  const F_entradaTeclado = seg(DUR_ENTRADA_TECLADO_SEG);
  const F_escribir1 = seg(DUR_ESCRIBIR_1_SEG);
  const F_envia = seg(DUR_ENVIA_SEG);
  const F_pausaPostEnvio1 = seg(DUR_PAUSA_POST_ENVIO_1_SEG);
  const F_video1 = F_entradaTeclado + F_escribir1 + F_envia + F_pausaPostEnvio1;

  const F_pausaInicio2 = seg(DUR_PAUSA_INICIO_2_SEG);
  const F_escribir2 = seg(DUR_ESCRIBIR_2_SEG);
  const F_pausaPostEnvio2 = seg(DUR_PAUSA_POST_ENVIO_2_SEG);
  const F_video2 = F_pausaInicio2 + F_escribir2 + F_envia + F_pausaPostEnvio2;

  const F_salidaTeclado = seg(DUR_SALIDA_TECLADO_SEG);
  const F_pausaMensajes = seg(DUR_PAUSA_MENSAJES_SEG);
  const F_fadeOverlay = seg(DUR_FADE_OVERLAY_SEG);
  const F_restoVideo3 = seg(DUR_RESTO_VIDEO_3_SEG);
  const F_video3 = F_salidaTeclado + F_pausaMensajes + F_fadeOverlay + F_restoVideo3;

  const F_banner = seg(DUR_BANNER_SEG);

  const inicioVideo1 = 0;
  const inicioVideo2 = inicioVideo1 + F_video1;
  const inicioVideo3 = inicioVideo2 + F_video2;
  const inicioBanner = inicioVideo3 + F_video3;

  // --- Frames absolutos de cada evento clave ---
  const frameInicioEscribir1 = inicioVideo1 + F_entradaTeclado;
  const frameEnvio1 = frameInicioEscribir1 + F_escribir1; // mensaje 1 pasa a burbuja
  const frameFinEnvio1 = frameEnvio1 + F_envia;

  const frameInicioEscribir2 = inicioVideo2 + F_pausaInicio2;
  const frameEnvio2 = frameInicioEscribir2 + F_escribir2; // mensaje 2 pasa a burbuja
  const frameFinEnvio2 = frameEnvio2 + F_envia;

  const frameSalidaTeclado = inicioVideo3; // el teclado empieza a bajar apenas arranca parte3
  const frameInicioFade = inicioVideo3 + F_salidaTeclado + F_pausaMensajes;

  void frameFinEnvio1; // (reservado por si se necesita más adelante, p.ej. para un "leído")
  void frameFinEnvio2;

  // --- Qué mensaje se está escribiendo ahora, si alguno ---
  const escribiendoMsg1 = frame >= frameInicioEscribir1 && frame < frameEnvio1;
  const escribiendoMsg2 = frame >= frameInicioEscribir2 && frame < frameEnvio2;
  const escribiendo = escribiendoMsg1
    ? { texto: MENSAJE_1, progreso: (frame - frameInicioEscribir1) / F_escribir1 }
    : escribiendoMsg2
    ? { texto: MENSAJE_2, progreso: (frame - frameInicioEscribir2) / F_escribir2 }
    : null;

  // El teclado sube una sola vez (al arrancar parte1) y se queda arriba —
  // incluida la pausa/"chequeo" entre mensaje y mensaje — hasta que arranca
  // parte3, donde baja porque ya no hay más que escribir.
  const progresoTeclado = interpolate(
    frame,
    [inicioVideo1, inicioVideo1 + F_entradaTeclado, frameSalidaTeclado, frameSalidaTeclado + F_salidaTeclado],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Cada mensaje pasa a burbuja fija apenas termina de enviarse, apilándose
  // hacia abajo en el orden en que se mandan (mensaje 1 arriba, 2 debajo).
  const historial: MensajeWhatsApp[] = [];
  if (frame >= frameEnvio1) historial.push({ rol: 'saliente', texto: MENSAJE_1, frame: frameEnvio1, hora: '9:41' });
  if (frame >= frameEnvio2) historial.push({ rol: 'saliente', texto: MENSAJE_2, frame: frameEnvio2, hora: '9:41' });

  // Todo el overlay (header + mensajes + zona de escritura) se desvanece
  // sobre el final de parte3, para que el remate quede en el perro solo.
  const opacityOverlay = interpolate(frame, [frameInicioFade, frameInicioFade + F_fadeOverlay], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* --- El perro, de punta a punta: nunca se corta a una pantalla aparte --- */}
      <Sequence from={inicioVideo1} durationInFrames={F_video1}>
        <FondoVideo src={staticFile('publi/def1/parte1.mp4')} />
      </Sequence>
      <Sequence from={inicioVideo2} durationInFrames={F_video2}>
        <FondoVideo src={staticFile('publi/def1/parte2.mp4')} />
      </Sequence>
      <Sequence from={inicioVideo3} durationInFrames={F_video3}>
        <FondoVideo src={staticFile('publi/def1/parte3.mp4')} />
      </Sequence>

      {/* --- Overlay de chat, translucido, encima del video todo el tiempo --- */}
      <AbsoluteFill style={{ opacity: opacityOverlay, display: 'flex', flexDirection: 'column' }}>
        <WhatsAppHeader nombre={NOMBRE_CONTACTO} />
        <ListaMensajesWhatsApp frame={frame} historial={historial} />
        <ZonaEscrituraWhatsApp
          frame={frame}
          escribiendo={escribiendo}
          progresoTeclado={progresoTeclado}
          palabrasPredictivas={PALABRAS_PREDICTIVAS}
        />
      </AbsoluteFill>

      {/* --- Sonido de tecleo, uno por cada mensaje --- */}
      <Sequence from={frameInicioEscribir1} durationInFrames={Math.max(1, F_escribir1)}>
        <Audio src={staticFile(AUDIO_TECLADO)} volume={0.45} />
      </Sequence>
      <Sequence from={frameInicioEscribir2} durationInFrames={Math.max(1, F_escribir2)}>
        <Audio src={staticFile(AUDIO_TECLADO)} volume={0.45} />
      </Sequence>

      {/* --- Sonido de "mensaje enviado", uno por cada envío --- */}
      <Sequence from={frameEnvio1} durationInFrames={Math.max(1, F_envia)}>
        <Audio src={staticFile(AUDIO_ENVIA)} volume={0.85} />
      </Sequence>
      <Sequence from={frameEnvio2} durationInFrames={Math.max(1, F_envia)}>
        <Audio src={staticFile(AUDIO_ENVIA)} volume={0.85} />
      </Sequence>

      {/* --- Banner de cierre --- */}
      <Sequence from={inicioBanner} durationInFrames={F_banner}>
        <BannerPerro progreso={(frame - inicioBanner) / F_banner} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** Duración total de la composición, en frames — usada por Root.tsx. */
export function duracionPerroWhatsApp(fps: number): number {
  const seg = (s: number) => Math.round(s * fps);
  const F_video1 = seg(DUR_ENTRADA_TECLADO_SEG) + seg(DUR_ESCRIBIR_1_SEG) + seg(DUR_ENVIA_SEG) + seg(DUR_PAUSA_POST_ENVIO_1_SEG);
  const F_video2 = seg(DUR_PAUSA_INICIO_2_SEG) + seg(DUR_ESCRIBIR_2_SEG) + seg(DUR_ENVIA_SEG) + seg(DUR_PAUSA_POST_ENVIO_2_SEG);
  const F_video3 = seg(DUR_SALIDA_TECLADO_SEG) + seg(DUR_PAUSA_MENSAJES_SEG) + seg(DUR_FADE_OVERLAY_SEG) + seg(DUR_RESTO_VIDEO_3_SEG);
  const F_banner = seg(DUR_BANNER_SEG);
  return F_video1 + F_video2 + F_video3 + F_banner;
}
