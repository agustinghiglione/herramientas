import React from 'react';
import { interpolate } from 'remotion';
import { Sparkle } from 'lucide-react';

const FUENTE_SISTEMA = '-apple-system, "SF Pro Text", Inter, sans-serif';

/** Ícono de menú — DOS barras horizontales, no tres, y la de abajo un poco
 * más corta que la de arriba (no del mismo largo) — así es en la captura
 * real de referencia del iPhone del cliente, confirmado también contra una
 * segunda foto real del estado de conversación (con el chat ya arrancado). */
function IconoHistorial() {
  return (
    <svg width="56" height="40" viewBox="0 0 22 16" fill="none">
      <path d="M1 2H21M1 14H16" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

/** Ícono de chat de voz — círculo abierto con una colita, como el ícono de
 * modo voz real de la app (no las barras de onda que usa el botón de
 * dictado del input; contra la captura real de referencia son distintos). */
function IconoChatVoz() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
      {/* Círculo abierto (con un pequeño hueco abajo a la izquierda) + colita, como una burbuja de chat estilizada. */}
      <circle cx="12" cy="12" r="8.5" stroke="#ececec" strokeWidth="1.8" strokeDasharray="40 6" strokeDashoffset="-8" strokeLinecap="round" />
      <path d="M8.2 18.6L6.8 21.5L10 19.8" stroke="#ececec" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** El lápiz y los tres puntos van en blanco puro (no la opacidad suave de sus
 * botones contenedores) — a esta escala, con opacidad reducida se leen como
 * "puntitos diminutos" en vez de íconos claros. */
function IconoLapiz() {
  return (
    <svg width="58" height="58" viewBox="0 0 20 20" fill="none">
      <path
        d="M13.5 2.5L17.5 6.5L7 17H3V13L13.5 2.5Z"
        stroke="#FFFFFF"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconoMas() {
  return (
    <svg width="58" height="18" viewBox="0 0 20 6" fill="none">
      <circle cx="3" cy="3" r="3" fill="#FFFFFF" />
      <circle cx="10" cy="3" r="3" fill="#FFFFFF" />
      <circle cx="17" cy="3" r="3" fill="#FFFFFF" />
    </svg>
  );
}

const CIRCULO = {
  width: 100,
  height: 100,
  borderRadius: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
} as const;

/**
 * Barra superior con sus dos estados reales de la app: pantalla de inicio
 * (píldora "Mejorar el plan" + chat de voz) antes de mandar el primer
 * mensaje, y barra mínima de conversación (lápiz de chat nuevo + más
 * opciones) después. El título "ChatGPT" fijo no existe en ninguno de los
 * dos — así es la app real. El ícono de menú (hamburguesa de 2 barras) es
 * el único elemento que NO cambia entre estados — se queda fijo en su
 * lugar durante toda la transición.
 *
 * Escala subida ~1.36x en toda la barra (mismo factor que la status bar) —
 * contra la comparación pixel a pixel de la captura real del cliente, esta
 * barra y sus íconos se quedaban chicos y dejaban un espacio "de más"
 * arriba de la pantalla en vez de ocupar la proporción real.
 *
 * La transición entre los dos estados (al mandar el primer mensaje, cuando
 * se esconde el teclado) no es un corte seco — contra el feedback del
 * cliente viendo el momento exacto en la app real: la píldora "Mejorar el
 * plan" se encoge y se desvanece HACIA el ícono de menú, como si la
 * "absorbiera" (achicándose desde su borde izquierdo, pegado al menú), y
 * del lado derecho el círculo de chat de voz se desvanece mientras la
 * píldora de lápiz+puntos aparece y crece en el mismo lugar, como si el
 * círculo "se extendiera" hacia esa forma más ancha.
 */
export const ChatGPTHeader: React.FC<{ progreso: number }> = ({ progreso }) => {
  const p = Math.min(1, Math.max(0, progreso));

  const pillEscala = interpolate(p, [0, 1], [1, 0.15]);
  const pillOpacidad = interpolate(p, [0, 0.7], [1, 0], { extrapolateRight: 'clamp' });

  const vozOpacidad = interpolate(p, [0, 0.55], [1, 0], { extrapolateRight: 'clamp' });
  const vozEscala = interpolate(p, [0, 1], [1, 0.7]);

  const convOpacidad = interpolate(p, [0.35, 1], [0, 1], { extrapolateLeft: 'clamp' });
  const convEscala = interpolate(p, [0.35, 1], [0.7, 1], { extrapolateLeft: 'clamp' });

  return (
    <div
      style={{
        height: 150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 38px',
      }}
    >
      {/* Izquierda: menú fijo + píldora que se encoge hacia él. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={{ ...CIRCULO, background: '#1A1A1A' }}>
          <IconoHistorial />
        </div>
        {pillOpacidad > 0.001 && (
          <div
            style={{
              background: '#1C2430',
              borderRadius: 999,
              padding: '25px 46px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              opacity: pillOpacidad,
              transform: `scale(${pillEscala})`,
              transformOrigin: 'left center',
            }}
          >
            <Sparkle color="#409CFF" size={44} fill="#409CFF" style={{ flexShrink: 0 }} />
            <span style={{ color: '#409CFF', fontSize: 48, fontWeight: 600, fontFamily: FUENTE_SISTEMA, whiteSpace: 'nowrap' }}>
              Mejorar el plan
            </span>
          </div>
        )}
      </div>

      {/* Derecha: círculo de voz y píldora lápiz+puntos, superpuestos en el
          mismo lugar (ancla a la derecha) para que uno se desvanezca justo
          donde el otro va creciendo, en vez de saltar de posición. */}
      <div style={{ position: 'relative', width: 260, height: 112, flexShrink: 0 }}>
        {vozOpacidad > 0.001 && (
          <div
            style={{
              ...CIRCULO,
              background: 'rgba(255,255,255,0.06)',
              position: 'absolute',
              right: 0,
              top: '50%',
              opacity: vozOpacidad,
              transform: `translateY(-50%) scale(${vozEscala})`,
              transformOrigin: 'right center',
            }}
          >
            <IconoChatVoz />
          </div>
        )}
        {convOpacidad > 0.001 && (
          <div
            style={{
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 999,
              padding: '27px 46px',
              display: 'flex',
              alignItems: 'center',
              gap: 38,
              position: 'absolute',
              right: 0,
              top: '50%',
              opacity: convOpacidad,
              transform: `translateY(-50%) scale(${convEscala})`,
              transformOrigin: 'right center',
            }}
          >
            <IconoLapiz />
            <IconoMas />
          </div>
        )}
      </div>
    </div>
  );
};
