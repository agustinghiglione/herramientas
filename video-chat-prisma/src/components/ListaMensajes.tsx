import React from 'react';
import { interpolate } from 'remotion';
import type { BloqueContenido } from '../guion';
import { revelarContenido } from '../guion';
import { ContenidoMensaje } from './ContenidoMensaje';

export interface MensajeSimple {
  rol: 'usuario' | 'chat';
  contenido: BloqueContenido[];
  frame: number;
}

interface Props {
  frame: number;
  historial: MensajeSimple[];
  /** Respuesta del chat que se está revelando en este momento (0..1 de progreso sobre su contenido completo). */
  respondiendo?: { contenido: BloqueContenido[]; progreso: number };
}

// Cuánto tarda un mensaje recién agregado en asentarse (fade + leve deslizamiento
// hacia arriba), en frames. Sin esto los mensajes aparecen "pegados" de golpe.
const FRAMES_ENTRADA = 14;

function useEntrada(frame: number, frameDeAparicion: number) {
  const edad = frame - frameDeAparicion;
  const progreso = interpolate(edad, [0, FRAMES_ENTRADA], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const suavizado = 1 - Math.pow(1 - progreso, 3); // easeOutCubic a mano
  return {
    opacity: suavizado,
    translateY: (1 - suavizado) * 22,
    scale: 0.96 + suavizado * 0.04,
  };
}

function BurbujaUsuario({ contenido, frame, frameDeAparicion }: { contenido: BloqueContenido[]; frame: number; frameDeAparicion: number }) {
  const { opacity, translateY, scale } = useEntrada(frame, frameDeAparicion);
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
      <div
        style={{
          maxWidth: '85%',
          background: '#262626',
          color: '#ececec',
          borderRadius: 22,
          padding: '20px 28px',
          opacity,
          transform: `translateY(${translateY}px) scale(${scale})`,
          transformOrigin: 'bottom right',
        }}
      >
        <ContenidoMensaje bloques={contenido} variante="usuario" />
      </div>
    </div>
  );
}

// La respuesta del chat va sin burbuja ni avatar — texto plano contra el
// fondo, igual que la referencia real de la app de ChatGPT.
//
// A diferencia de la burbuja del usuario, un mensaje del chat NUNCA usa la
// animación de entrada (fade + deslizamiento) — ni siquiera una vez que ya
// pasó a formar parte del historial. La razón: para cuando un "chat
// responde" termina y se "compromete" al historial, ese mismo contenido ya
// estuvo un rato en pantalla revelándose palabra por palabra a opacidad
// plena (ver BloqueChatVivo abajo). Si al comprometerse volviera a arrancar
// la animación de entrada desde opacity:0, el texto "desaparecía" un
// instante y volvía a aparecer — justo el parpadeo que se reportó al pasar
// de la respuesta a la captura. Por eso un solo componente, sin animación,
// sirve para los dos casos (revelándose en vivo Y ya comprometido).
function BloqueChatVivo({ contenido }: { contenido: BloqueContenido[] }) {
  return (
    <div style={{ marginBottom: 34 }}>
      <ContenidoMensaje bloques={contenido} />
    </div>
  );
}

/** Los tres puntitos que "respiran" mientras el chat compone la respuesta, antes de que aparezcan las palabras. */
function PuntosEscribiendo({ frame }: { frame: number }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 34, alignItems: 'center' }}>
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
              width: 13,
              height: 13,
              borderRadius: '50%',
              background: 'rgba(236,236,236,0.55)',
              transform: `translateY(${salto}px)`,
            }}
          />
        );
      })}
    </div>
  );
}

// Fracción inicial de cada respuesta que se muestra como "está escribiendo…"
// antes de empezar a revelar contenido. Vende mucho mejor la idea de que del
// otro lado hay una IA pensando, en vez de que el texto brote instantáneo.
const FRACCION_PENSANDO = 0.12;

// Fracción de la ventana "post-pensando" que se usa para revelar el
// contenido — el resto (1 - esto) queda como pausa de lectura al final,
// con todo ya mostrado, antes de cortar al siguiente evento del guion.
const FRACCION_REVELADO = 0.82;

export const ListaMensajes: React.FC<Props> = ({ frame, historial, respondiendo }) => {
  const pensando = respondiendo && respondiendo.progreso < FRACCION_PENSANDO;
  // El contenido termina de revelarse un poco antes del final de la
  // duración (no exactamente al último frame) y se queda quieto ese resto
  // — un respiro para que se alcance a leer la respuesta, sobre todo
  // cuando termina recomendando algo nuestro, antes de cortar a lo que sigue.
  const progresoContenido = respondiendo
    ? Math.min(1, Math.max(0, (respondiendo.progreso - FRACCION_PENSANDO) / (1 - FRACCION_PENSANDO)) / FRACCION_REVELADO)
    : 0;

  return (
    <div
      style={{
        flex: 1,
        padding: '36px 32px',
        display: 'flex',
        flexDirection: 'column',
        // Los mensajes se anclan abajo y lo viejo se recorta arriba — así la
        // conversación se comporta como un chat real que hace scroll solo.
        // Esto YA logra, sin transform/interpolate manual, lo mismo que pide
        // un "translateY hacia arriba a medida que entra texto": el flex con
        // justifyContent:flex-end recalcula solo, cuadro a cuadro, cuánto
        // sube el bloque según la altura real del contenido — determinista
        // (no depende de medir el DOM) y sin hardcodear frames de inicio/fin,
        // así que se adapta a cualquier longitud de respuesta sin ajuste manual.
        justifyContent: 'flex-end',
        overflow: 'hidden',
        // Desvanecido superior tipo "vidrio esmerilado", igual al de la app
        // real cuando el contenido no entra entero en pantalla.
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, black 56px)',
        maskImage: 'linear-gradient(to bottom, transparent 0px, black 56px)',
      }}
    >
      {historial.map((m, i) =>
        m.rol === 'usuario' ? (
          <BurbujaUsuario key={i} contenido={m.contenido} frame={frame} frameDeAparicion={m.frame} />
        ) : (
          <BloqueChatVivo key={i} contenido={m.contenido} />
        ),
      )}
      {respondiendo &&
        (pensando ? (
          <PuntosEscribiendo frame={frame} />
        ) : (
          <BloqueChatVivo contenido={revelarContenido(respondiendo.contenido, progresoContenido)} />
        ))}
    </div>
  );
};
