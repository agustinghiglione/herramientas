import React from 'react';
import { Sparkles } from 'lucide-react';

const FUENTE_SISTEMA = '-apple-system, "SF Pro Text", Inter, sans-serif';

function IconoHistorial() {
  return (
    <svg width="46" height="35" viewBox="0 0 22 16" fill="none">
      <path d="M1 1H21M1 8H21M1 15H21" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

/** Ícono de chat de voz — mismas barras de onda que el botón de dictado del
 * input, reutilizadas acá como el botón circular de modo voz de la barra
 * superior (así es como abre la app real antes de mandar el primer mensaje). */
function IconoChatVoz() {
  return (
    <svg width="30" height="30" viewBox="0 0 22 22" fill="none">
      <rect x="1" y="8" width="3" height="6" rx="1.5" fill="#ececec" />
      <rect x="6.5" y="4" width="3" height="14" rx="1.5" fill="#ececec" />
      <rect x="12" y="0" width="3" height="22" rx="1.5" fill="#ececec" />
      <rect x="17.5" y="6" width="3" height="10" rx="1.5" fill="#ececec" />
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
              padding: '18px 30px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Sparkles color="#409CFF" size={28} style={{ flexShrink: 0 }} />
            <span style={{ color: '#409CFF', fontSize: 24, fontWeight: 600, fontFamily: FUENTE_SISTEMA, whiteSpace: 'nowrap' }}>
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
