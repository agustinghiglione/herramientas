import React from 'react';
import { Sparkle } from 'lucide-react';

const FUENTE_SISTEMA = '-apple-system, "SF Pro Text", Inter, sans-serif';

/** Ícono de menú — DOS barras horizontales, no tres. Contra una captura
 * real de referencia del iPhone del cliente confirmamos que el botón de
 * la izquierda de la app no es la hamburguesa clásica de 3 líneas. */
function IconoHistorial() {
  return (
    <svg width="42" height="30" viewBox="0 0 22 16" fill="none">
      <path d="M1 2H21M1 14H21" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

/** Ícono de chat de voz — círculo abierto con una colita, como el ícono de
 * modo voz real de la app (no las barras de onda que usa el botón de
 * dictado del input; contra la captura real de referencia son distintos). */
function IconoChatVoz() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
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
    <svg width="44" height="44" viewBox="0 0 20 20" fill="none">
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
    <svg width="44" height="14" viewBox="0 0 20 6" fill="none">
      <circle cx="3" cy="3" r="3" fill="#FFFFFF" />
      <circle cx="10" cy="3" r="3" fill="#FFFFFF" />
      <circle cx="17" cy="3" r="3" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * Barra superior con sus dos estados reales de la app: pantalla de inicio
 * (selector Chat/Work + refresh) antes de mandar el primer mensaje, y barra
 * mínima de conversación (lápiz de chat nuevo + más opciones) después. El
 * título "ChatGPT" fijo no existe en ninguno de los dos — así es la app real.
 *
 * Medidas según las rondas de ajuste de escala del experto: barra a 110px
 * de alto, botones circulares de 76x76px, el de menú (hamburguesa) con
 * fondo sólido #1A1A1A. El CONTENEDOR de los botones de lápiz+más
 * mantiene la opacidad suave (así se ven en la referencia real cuando no
 * son el ícono de navegación principal), pero los ÍCONOS en sí van en
 * blanco puro — y un +15% más grandes que la ronda anterior (hamburguesa
 * y lápiz, para que no se pierdan en pantallas móviles chicas).
 *
 * El estado de ANTES de escribir (pantalla de inicio) ya no muestra el
 * selector Chat/Work — la app real, en ese momento, muestra la píldora
 * con destello "✨ Mejorar el plan" en el centro y el botón de chat de voz
 * a la derecha (no un botón de refresh).
 *
 * Contra una captura real de referencia del iPhone del cliente: el texto
 * de la píldora "Mejorar el plan" iba notablemente más grande de lo que
 * teníamos (ajustado acá a 36px/destello 32px), el destello es una ÚNICA
 * estrellita (Sparkle, no el racimo de Sparkles), y el ícono de menú de la
 * izquierda son 2 barras, no 3.
 */
export const ChatGPTHeader: React.FC<{ conversacionIniciada: boolean }> = ({ conversacionIniciada }) => {
  return (
    <div
      style={{
        height: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
      }}
    >
      <div
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          background: '#1A1A1A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconoHistorial />
      </div>

      {!conversacionIniciada ? (
        <>
          {/* Píldora nativa con destello — reemplaza al selector Chat/Work,
              que no existe en la pantalla de inicio real de la app. */}
          <div
            style={{
              background: '#1C2430',
              borderRadius: 999,
              padding: '18px 34px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Sparkle color="#409CFF" size={32} fill="#409CFF" style={{ flexShrink: 0 }} />
            <span style={{ color: '#409CFF', fontSize: 36, fontWeight: 600, fontFamily: FUENTE_SISTEMA, whiteSpace: 'nowrap' }}>
              Mejorar el plan
            </span>
          </div>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              background: 'rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconoChatVoz />
          </div>
        </>
      ) : (
        <div
          style={{
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 999,
            padding: '20px 34px',
            display: 'flex',
            alignItems: 'center',
            gap: 29,
          }}
        >
          <IconoLapiz />
          <IconoMas />
        </div>
      )}
    </div>
  );
};
