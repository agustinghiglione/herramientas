import React from 'react';
import { interpolate } from 'remotion';

export interface MensajeSimple {
  rol: 'usuario' | 'chat';
  texto: string;
  /** Frame en el que el mensaje pasó a formar parte del historial fijo. */
  frame: number;
}

interface Props {
  frame: number;
  historial: MensajeSimple[];
  /** Mensaje del chat que se está "escribiendo" en este momento, con revelado parcial por palabras. */
  respondiendo?: { texto: string; progreso: number };
}

// Cuánto tarda un mensaje recién agregado en asentarse (fade + leve deslizamiento
// hacia arriba), en frames. Sin esto los mensajes aparecen "pegados" de golpe,
// que es buena parte de por qué la conversación no se siente real.
const FRAMES_ENTRADA = 14;

function useEntrada(frame: number, frameDeAparicion: number) {
  const edad = frame - frameDeAparicion;
  const progreso = interpolate(edad, [0, FRAMES_ENTRADA], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // easeOutCubic a mano, para que el asentamiento frene suave en vez de cortar seco.
  const suavizado = 1 - Math.pow(1 - progreso, 3);
  return {
    opacity: suavizado,
    translateY: (1 - suavizado) * 22,
    scale: 0.96 + suavizado * 0.04,
  };
}

function BurbujaUsuario({ texto, frame, frameDeAparicion }: { texto: string; frame: number; frameDeAparicion: number }) {
  const { opacity, translateY, scale } = useEntrada(frame, frameDeAparicion);
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
      <div
        style={{
          maxWidth: '78%',
          background: '#2f2f2f',
          color: '#ececec',
          borderRadius: 22,
          padding: '18px 24px',
          fontSize: 30,
          lineHeight: 1.4,
          fontFamily: 'Inter, sans-serif',
          opacity,
          transform: `translateY(${translateY}px) scale(${scale})`,
          transformOrigin: 'bottom right',
        }}
      >
        {texto}
      </div>
    </div>
  );
}

function BloqueChat({
  texto,
  frame,
  frameDeAparicion,
}: {
  texto: string;
  frame: number;
  frameDeAparicion: number;
}) {
  const { opacity, translateY, scale } = useEntrada(frame, frameDeAparicion);
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 34, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #10a37f, #1a7f64)',
          marginTop: 4,
          opacity,
        }}
      />
      <div
        style={{
          color: '#ececec',
          fontSize: 30,
          lineHeight: 1.5,
          fontFamily: 'Inter, sans-serif',
          opacity,
          transform: `translateY(${translateY}px) scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {texto}
      </div>
    </div>
  );
}

/** Los tres puntitos que "respiran" mientras el chat compone la respuesta, antes de que aparezcan las palabras. */
function PuntosEscribiendo({ frame }: { frame: number }) {
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 34, alignItems: 'center' }}>
      <div
        style={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #10a37f, #1a7f64)',
          marginTop: 4,
        }}
      />
      <div
        style={{
          display: 'flex',
          gap: 10,
          background: '#2f2f2f',
          borderRadius: 20,
          padding: '20px 24px',
        }}
      >
        {[0, 1, 2].map((i) => {
          const fase = (frame + i * 5) % 24;
          const salto = interpolate(fase, [0, 6, 12, 24], [0, -8, 0, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={i}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: 'rgba(236,236,236,0.6)',
                transform: `translateY(${salto}px)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function textoParcialPorPalabras(texto: string, progreso: number) {
  const palabras = texto.split(' ');
  const cantidad = Math.max(1, Math.ceil(palabras.length * Math.min(1, Math.max(0, progreso))));
  return palabras.slice(0, cantidad).join(' ');
}

// Fracción inicial de cada respuesta que se muestra como "está escribiendo…"
// antes de empezar a revelar palabras. Vende mucho mejor la idea de que del
// otro lado hay una IA pensando, en vez de que el texto brote instantáneo.
const FRACCION_PENSANDO = 0.16;

export const ListaMensajes: React.FC<Props> = ({ frame, historial, respondiendo }) => {
  const pensando = respondiendo && respondiendo.progreso < FRACCION_PENSANDO;
  const progresoPalabras = respondiendo
    ? Math.max(0, (respondiendo.progreso - FRACCION_PENSANDO) / (1 - FRACCION_PENSANDO))
    : 0;

  return (
    <div
      style={{
        flex: 1,
        padding: '36px 30px',
        display: 'flex',
        flexDirection: 'column',
        // Los mensajes se anclan abajo y lo viejo se recorta arriba — así la
        // conversación se comporta como un chat real que hace scroll solo,
        // en vez de desbordarse fuera de pantalla a medida que crece.
        justifyContent: 'flex-end',
        overflow: 'hidden',
      }}
    >
      {historial.map((m, i) =>
        m.rol === 'usuario' ? (
          <BurbujaUsuario key={i} texto={m.texto} frame={frame} frameDeAparicion={m.frame} />
        ) : (
          <BloqueChat key={i} texto={m.texto} frame={frame} frameDeAparicion={m.frame} />
        ),
      )}
      {respondiendo && (pensando ? <PuntosEscribiendo frame={frame} /> : <BloqueChat texto={textoParcialPorPalabras(respondiendo.texto, progresoPalabras)} frame={frame} frameDeAparicion={frame} />)}
    </div>
  );
};
