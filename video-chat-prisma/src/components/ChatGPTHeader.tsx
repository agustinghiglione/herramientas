import React from 'react';

function IconoHistorial() {
  return (
    <svg width="25" height="18" viewBox="0 0 22 16" fill="none">
      <path d="M1 1H21M1 8H21M1 15H21" stroke="#ececec" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconoRefresh() {
  return (
    <svg width="23" height="23" viewBox="0 0 20 20" fill="none">
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

function IconoLapiz() {
  return (
    <svg width="23" height="23" viewBox="0 0 20 20" fill="none">
      <path
        d="M13.5 2.5L17.5 6.5L7 17H3V13L13.5 2.5Z"
        stroke="#ececec"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconoMas() {
  return (
    <svg width="23" height="7" viewBox="0 0 20 6" fill="none">
      <circle cx="3" cy="3" r="2.4" fill="#ececec" />
      <circle cx="10" cy="3" r="2.4" fill="#ececec" />
      <circle cx="17" cy="3" r="2.4" fill="#ececec" />
    </svg>
  );
}

/**
 * Barra superior con sus dos estados reales de la app: pantalla de inicio
 * (selector Chat/Work + refresh) antes de mandar el primer mensaje, y barra
 * mínima de conversación (lápiz de chat nuevo + más opciones) después. El
 * título "ChatGPT" fijo no existe en ninguno de los dos — así es la app real.
 */
export const ChatGPTHeader: React.FC<{ conversacionIniciada: boolean }> = ({ conversacionIniciada }) => {
  return (
    <div
      style={{
        height: 122,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
      }}
    >
      <div
        style={{
          width: 62,
          height: 62,
          borderRadius: 31,
          background: 'rgba(255,255,255,0.06)',
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
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 999,
              padding: '15px 8px',
              display: 'flex',
              gap: 4,
            }}
          >
            <div
              style={{
                background: 'rgba(255,255,255,0.12)',
                borderRadius: 999,
                padding: '9px 24px',
                color: '#ececec',
                fontSize: 24,
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Chat
            </div>
            <div style={{ padding: '9px 24px', color: 'rgba(236,236,236,0.55)', fontSize: 24, fontFamily: 'Inter, sans-serif' }}>
              Work
            </div>
          </div>
          <div
            style={{
              width: 62,
              height: 62,
              borderRadius: 31,
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
            padding: '17px 28px',
            display: 'flex',
            alignItems: 'center',
            gap: 24,
          }}
        >
          <IconoLapiz />
          <IconoMas />
        </div>
      )}
    </div>
  );
};
