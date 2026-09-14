import React from 'react';
import { AbsoluteFill, Loop, OffthreadVideo, useVideoConfig } from 'remotion';

// Los tres clips reales (parte1/2/3.mp4) duran 4.096s cada uno. Cuando este
// componente necesita cubrir más tiempo que eso (por ejemplo mientras se
// escribe el mensaje 2, más largo), el clip se repite en loop en vez de
// congelarse en el último frame.
const DURACION_NATIVA_SEG = 4.096;

/**
 * Metraje real (864×496, panorámico) mostrado DENTRO de un cuadro 9:16 sin
 * recortarlo — antes se usaba objectFit:"cover", que para pasar un video
 * panorámico a vertical obliga a un zoom enorme (recorta ~68% del ancho
 * para poder "cubrir" el alto). Acá se ve el clip COMPLETO, sin recorte
 * (objectFit:"contain", se ve el perro entero) apoyado sobre una copia del
 * mismo video, bien desenfocada y agrandada, que rellena arriba/abajo — así
 * no hay franjas negras y el fondo sigue siendo "el perro" todo el tiempo,
 * como pidió Damian.
 *
 * Dos ajustes de esta vuelta:
 * 1) Sin audio del clip original — el sonido final del anuncio lo ponen
 *    solo los efectos (tecleo / mensaje enviado), nunca el audio de fondo
 *    grabado en el video real.
 * 2) El recorte "contain" se ancla ARRIBA (objectPosition: top) en vez de
 *    centrarse: así el video nítido empieza pegado a la barra del contacto,
 *    sin el margen difuminado que quedaba entre esa barra y el perro. Todo
 *    el sobrante desenfocado queda abajo, detrás del teclado/burbujas,
 *    donde no se nota. Un degradé suave en el borde inferior del video
 *    nítido evita el corte brusco contra el desenfoque de relleno.
 */
export const FondoVideo: React.FC<{ src: string }> = ({ src }) => {
  const { fps } = useVideoConfig();
  const framesLoop = Math.round(DURACION_NATIVA_SEG * fps);

  const degradeBorde = 'linear-gradient(to bottom, #000 0%, #000 90%, transparent 100%)';

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Loop durationInFrames={framesLoop}>
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <OffthreadVideo
            src={src}
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(70px) brightness(0.6)', transform: 'scale(1.2)' }}
          />
        </AbsoluteFill>
        <AbsoluteFill
          style={{
            WebkitMaskImage: degradeBorde,
            maskImage: degradeBorde,
          }}
        >
          <OffthreadVideo
            src={src}
            muted
            style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center top' }}
          />
        </AbsoluteFill>
      </Loop>
    </AbsoluteFill>
  );
};
