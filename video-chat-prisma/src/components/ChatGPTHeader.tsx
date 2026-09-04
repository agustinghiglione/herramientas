import React from 'react';
import { Sparkle } from 'lucide-react';

const FUENTE_SISTEMA = '-apple-system, "SF Pro Text", Inter, sans-serif';

/** Ícono de menú — DOS barras horizontales, no tres. Contra una captura
 * real de referencia del iPhone del cliente confirmamos que el botón de
 * la izquierda de la app no es la hamburguesa clásica de 3 líneas. */
function IconoHistorial() {
  return (
    <svg width="56" height="40" viewBox="0 0 22 16" fill="none">
      <path d="M1 2H21M1 14H21" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" />
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

/**
 * Barra superior con sus dos estados reales de la app: pantalla de inicio
 * (píldora "Mejorar el plan" + chat de voz) antes de mandar el primer
 * mensaje, y barra mínima de conversación (lápiz de chat nuevo + más
 * opciones) después. El título "ChatGPT" fijo no existe en ninguno de los
 * dos — así es la app real.
 *
 * Escala subida ~1.36x en toda la barra (mismo factor que la status bar) —
 * contra la comparación pixel a pixel de la captura real del cliente, esta
 * barra y sus íconos se quedaban chicos y dejaban un espacio "de más"
 * arriba de la pantalla en vez de ocupar la proporción real.
 *
 * La píldora "Mejorar el plan" ya no va centrada: en la captura real está
 * pegada junto al ícono de menú, del lado izquierdo — no flotando en el
 * medio de la barra — así que ambos van agrupados en un mismo bloque a la
 * izquierda, y el botón de chat de voz queda solo del lado derecho.
 */
export const ChatGPTHeader: React.FC<{ conversacionIniciada: boolean }> = ({ conversacionIniciada }) => {
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
      {!conversacionIniciada ? (
        <>
          {/* Menú + píldora agrupados a la izquierda, uno junto al otro. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                background: '#1A1A1A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconoHistorial />
            </div>
            <div
              style={{
                background: '#1C2430',
                borderRadius: 999,
                padding: '25px 46px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <Sparkle color="#409CFF" size={44} fill="#409CFF" style={{ flexShrink: 0 }} />
              <span style={{ color: '#409CFF', fontSize: 48, fontWeight: 600, fontFamily: FUENTE_SISTEMA, whiteSpace: 'nowrap' }}>
                Mejorar el plan
              </span>
            </div>
          </div>
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              background: 'rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconoChatVoz />
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              background: '#1A1A1A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconoHistorial />
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 999,
              padding: '27px 46px',
              display: 'flex',
              alignItems: 'center',
              gap: 38,
            }}
          >
            <IconoLapiz />
            <IconoMas />
          </div>
        </>
      )}
    </div>
  );
};
