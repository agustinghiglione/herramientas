import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { parsearGuion, eventoEnFrame, progresoTeclado } from './guion';
import { ChatGPTHeader } from './components/ChatGPTHeader';
import { StatusBarOS } from './components/StatusBarOS';
import { ListaMensajes } from './components/ListaMensajes';
import { SugerenciasInicio } from './components/SugerenciasInicio';
import { ZonaEscritura } from './components/ZonaEscritura';
import { Captura } from './components/Captura';
import { BannerFinal } from './components/BannerFinal';

const AUDIO_TECLADO = 'audio/u_a4gfvwagf1-iphone-keyboard-typing-sound-effect-336778.mp3';
const AUDIO_TECLADO_DURACION_SEG = 22.7;
const AUDIO_ENVIA = 'audio/son_duquotidient-message-envoye-iphone-apple-391098.mp3';
const AUDIO_CAPTURA = 'audio/peggy_marco-screenshot-iphone-sound-336170.mp3';

export const ChatVideo: React.FC<{ guionTexto: string }> = ({ guionTexto }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  const { eventos, mensajesComprometidos } = useMemo(() => parsearGuion(guionTexto, fps), [guionTexto, fps]);

  const historial = mensajesComprometidos.filter((m) => m.frame <= frame);

  const eventoActual = eventoEnFrame(eventos, frame);

  // Capa de audio: se arma una sola vez a partir de los eventos, cada uno
  // dentro de su propio Sequence — Remotion se encarga de que solo suene
  // durante su ventana de frames, no hace falta filtrar a mano por frame.
  const capaAudio = eventos.map((e, i) => {
    if (e.accion.tipo === 'escribe') {
      const duracionSeg = (e.hasta - e.desde) / fps;
      const offsetSeg = (i * 3.7) % Math.max(1, AUDIO_TECLADO_DURACION_SEG - duracionSeg);
      return (
        <Sequence key={i} from={e.desde} durationInFrames={e.hasta - e.desde}>
          <Audio src={staticFile(AUDIO_TECLADO)} startFrom={Math.round(offsetSeg * fps)} volume={0.45} />
        </Sequence>
      );
    }
    if (e.accion.tipo === 'envia') {
      return (
        <Sequence key={i} from={e.desde} durationInFrames={e.hasta - e.desde}>
          <Audio src={staticFile(AUDIO_ENVIA)} />
        </Sequence>
      );
    }
    if (e.accion.tipo === 'responde') {
      // Mismo sonido de "mensaje enviado", pero disparado al arrancar la
      // respuesta del chat — así se escucha cada vez que el chat manda un
      // mensaje, no solo cuando lo manda el usuario.
      return (
        <Sequence key={i} from={e.desde} durationInFrames={Math.max(1, Math.round(0.5 * fps))}>
          <Audio src={staticFile(AUDIO_ENVIA)} volume={0.85} />
        </Sequence>
      );
    }
    if (e.accion.tipo === 'captura') {
      return (
        <Sequence key={i} from={e.desde} durationInFrames={e.hasta - e.desde}>
          <Audio src={staticFile(AUDIO_CAPTURA)} />
        </Sequence>
      );
    }
    return null;
  });

  // Zoom in casi imperceptible a lo largo de todo el video — sin esto la
  // cámara se siente demasiado "clavada", como una captura de pantalla fija
  // en vez de un video. Un truco de producción, no de la UI en sí.
  const escala = interpolate(frame, [0, Math.max(1, durationInFrames)], [1, 1.018], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (eventoActual?.accion.tipo === 'banner') {
    const progreso = (frame - eventoActual.desde) / (eventoActual.hasta - eventoActual.desde);
    return (
      <AbsoluteFill style={{ backgroundColor: '#0d0d0d' }}>
        <AbsoluteFill style={{ transform: `scale(${escala})` }}>
          <BannerFinal texto={eventoActual.accion.texto} progreso={progreso} />
        </AbsoluteFill>
        <Vinieta />
        {capaAudio}
      </AbsoluteFill>
    );
  }

  const escribiendo =
    eventoActual?.accion.tipo === 'escribe'
      ? {
          texto: eventoActual.accion.texto,
          progreso: (frame - eventoActual.desde) / (eventoActual.hasta - eventoActual.desde),
        }
      : null;

  const accionResponde = eventoActual && eventoActual.accion.tipo === 'responde' ? eventoActual.accion : null;
  const respondiendoAhora = accionResponde !== null;
  const respondiendo =
    accionResponde && eventoActual
      ? {
          contenido: accionResponde.contenido,
          progreso: (frame - eventoActual.desde) / (eventoActual.hasta - eventoActual.desde),
        }
      : null;

  const enCaptura = eventoActual?.accion.tipo === 'captura';
  const progresoCaptura = enCaptura ? (frame - eventoActual!.desde) / (eventoActual!.hasta - eventoActual!.desde) : 0;

  // La conversación "arranca" (cambia el header, se esconden las sugerencias
  // de inicio) apenas se dispara el primer envío, no recién cuando termina
  // de asentarse el mensaje — así coincide con el momento real en que la
  // app cambia de pantalla.
  const conversacionIniciada = historial.length > 0 || eventoActual?.accion.tipo === 'envia';
  const mostrarSugerencias = !conversacionIniciada && !escribiendo;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0d0d0d' }}>
      <AbsoluteFill style={{ backgroundColor: '#0d0d0d', transform: `scale(${escala})` }}>
        <StatusBarOS />
        <ChatGPTHeader conversacionIniciada={conversacionIniciada} />
        {mostrarSugerencias ? (
          <SugerenciasInicio />
        ) : (
          <ListaMensajes frame={frame} historial={historial} respondiendo={respondiendo ?? undefined} />
        )}
        <ZonaEscritura
          frame={frame}
          escribiendo={escribiendo}
          respondiendo={respondiendoAhora}
          progresoTeclado={progresoTeclado(frame, eventos)}
        />
        {enCaptura && <Captura progreso={progresoCaptura} />}
      </AbsoluteFill>
      <Vinieta />
      {capaAudio}
    </AbsoluteFill>
  );
};

/** Sombreado sutil en las esquinas, tipo brillo de panel OLED de un celular real — fijo, no se escala con el zoom de cámara. */
function Vinieta() {
  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)',
        pointerEvents: 'none',
      }}
    />
  );
}
