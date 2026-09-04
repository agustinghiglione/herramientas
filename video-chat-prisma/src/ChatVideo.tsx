import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { parsearGuion, eventoEnFrame, progresoTeclado, FRACCION_ESPERA_CAPTURA } from './guion';
import { ChatGPTHeader } from './components/ChatGPTHeader';
import { StatusBarOS } from './components/StatusBarOS';
import { ListaMensajes } from './components/ListaMensajes';
import { SugerenciasInicio } from './components/SugerenciasInicio';
import { ZonaEscritura } from './components/ZonaEscritura';
import { Captura } from './components/Captura';
import { BannerFinal } from './components/BannerFinal';
import { BannerImagen } from './components/BannerImagen';

const AUDIO_TECLADO = 'audio/u_a4gfvwagf1-iphone-keyboard-typing-sound-effect-336778.mp3';
const AUDIO_TECLADO_DURACION_SEG = 22.7;
const AUDIO_ENVIA = 'audio/son_duquotidient-message-envoye-iphone-apple-391098.mp3';
const AUDIO_CAPTURA = 'audio/peggy_marco-screenshot-iphone-sound-336170.mp3';
const AUDIO_CAPTURA_DURACION_SEG = 1.8; // duración real del click + su cola/reverb

export const ChatVideo: React.FC<{ guionTexto: string; bannerImagenDisponible?: boolean }> = ({
  guionTexto,
  bannerImagenDisponible,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  const { eventos, mensajesComprometidos } = useMemo(() => parsearGuion(guionTexto, fps), [guionTexto, fps]);
  // Todos los hooks van ANTES de cualquier return condicional (como el del
  // banner, más abajo) — si no, React se queja de "more hooks than during
  // the previous render" apenas la rama que hace early-return se activa.
  const primerEventoEscribe = useMemo(() => eventos.find((e) => e.accion.tipo === 'escribe'), [eventos]);

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
      // El sonido de shutter arranca junto con el flash (después de la pausa
      // de lectura previa), no al principio del evento — para que quede
      // sincronizado con la imagen. Puede seguir sonando un poco después de
      // que el evento visual termine (la cola del click se apaga de fondo ya
      // con el banner en pantalla) — no molesta, es solo la resonancia.
      const duracionEvento = e.hasta - e.desde;
      const inicioFlash = e.desde + Math.round(duracionEvento * FRACCION_ESPERA_CAPTURA);
      return (
        <Sequence key={i} from={inicioFlash} durationInFrames={Math.round(AUDIO_CAPTURA_DURACION_SEG * fps)}>
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
    // El banner definitivo es una imagen ya diseñada (public/banners/actual.png).
    // Si todavía no se subió ninguna, se cae al banner de texto programático
    // como respaldo — así el render nunca se rompe mientras se sigue
    // trabajando el diseño del banner por su cuenta.
    if (bannerImagenDisponible) {
      return (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
          <BannerImagen progreso={progreso} />
          {capaAudio}
        </AbsoluteFill>
      );
    }
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
  // Las sugerencias siguen montadas durante todo el tipeo (no solo antes de
  // que arranque) — así pueden hacer su propio fade-out de 3 frames apenas
  // se empieza a escribir, en vez de desaparecer de golpe. Mientras tanto,
  // debajo, ListaMensajes ya no tiene nada que mostrar (historial vacío, sin
  // respuesta en curso), así que no hay conflicto visual entre los dos.
  const mostrarSugerencias = !conversacionIniciada;

  return (
    // Raíz del canvas explícita a 100% ancho/alto, pegada a (0,0) y con
    // overflow:hidden — así el frame ocupa el 100% de los 1080x1920 sin
    // franjas vacías a los costados en ningún reproductor, sin depender
    // únicamente de los valores por defecto de AbsoluteFill.
    <AbsoluteFill style={{ backgroundColor: '#0d0d0d', width: '100%', height: '100%', top: 0, left: 0, overflow: 'hidden' }}>
      <AbsoluteFill style={{ backgroundColor: '#0d0d0d', transform: `scale(${escala})`, overflow: 'hidden' }}>
        <StatusBarOS />
        <ChatGPTHeader conversacionIniciada={conversacionIniciada} />
        {mostrarSugerencias ? (
          <SugerenciasInicio frame={frame} frameFadeOut={primerEventoEscribe?.desde} />
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
