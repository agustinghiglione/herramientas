import React from 'react';

const FUENTE_SISTEMA = '-apple-system, "SF Pro Text", Inter, sans-serif';

function IconoHistorial() {
  return (
    <svg width="46" height="35" viewBox="0 0 22 16" fill="none">
      <path d="M1 1H21M1 8H21M1 15H21" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

function IconoRefresh() {
  return (
    <svg width="36" height="36" viewBox="0 0 20 20" fill="none">
      <path
        d="M17 4V8H13M3 16V12H7M4.5 7.5C5.4 5 7.7 3.2 10.4 3C13.6 2.8 16.4 4.8 17.3 7.7M15.5 12.5C14.6 15 12.3 16.8 9.6 17C6.4 17.2 3.6 15.2 2.7 12.3"
        stroke="#ececec"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
 * fondo sólido #1A1A1A. El CONTENEDOR de los botones de refresh/lápiz+más
 * mantiene la opacidad suave (así se ven en la referencia real cuando no
 * son el ícono de navegación principal), pero los ÍCONOS en sí van en
 * blanco puro — y un +15% más grandes que la ronda anterior (hamburguesa
 * y lápiz, para que no se pierdan en pantallas móviles chicas).
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
          <div
            style={{
              background: '#222222',
              borderRadius: 29,
              padding: '18px 10px',
              display: 'flex',
              gap: 4,
            }}
          >
            <div
              style={{
                background: '#343434',
                borderRadius: 22,
                padding: '11px 29px',
                color: '#ececec',
                fontSize: 24,
                fontWeight: 600,
                fontFamily: FUENTE_SISTEMA,
              }}
            >
              Chat
            </div>
            <div style={{ padding: '11px 29px', color: 'rgba(236,236,236,0.55)', fontSize: 24, fontFamily: FUENTE_SISTEMA }}>
              Work
            </div>
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
            <IconoRefresh />
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
