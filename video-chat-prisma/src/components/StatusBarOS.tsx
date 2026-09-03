import React from 'react';

function IconoSenal() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
      <rect x="0" y="9" width="4" height="5" rx="1" fill="#ececec" />
      <rect x="5.5" y="6" width="4" height="8" rx="1" fill="#ececec" />
      <rect x="11" y="3" width="4" height="11" rx="1" fill="#ececec" />
      <rect x="16.5" y="0" width="4" height="14" rx="1" fill="#ececec" />
    </svg>
  );
}

function IconoWifi() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
      <path d="M1 4.5C6.5 -0.5 11.5 -0.5 17 4.5" stroke="#ececec" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 8C7.5 4.8 10.5 4.8 14 8" stroke="#ececec" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="12" r="1.6" fill="#ececec" />
    </svg>
  );
}

function IconoBateria({ porcentaje }: { porcentaje: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 17, color: '#ececec', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>{porcentaje}%</span>
      <div style={{ position: 'relative', width: 26, height: 13, border: '1.4px solid rgba(255,255,255,0.6)', borderRadius: 3.5, padding: 2 }}>
        <div style={{ width: `${porcentaje}%`, height: '100%', background: '#ececec', borderRadius: 1 }} />
        <div style={{ position: 'absolute', right: -3, top: 4, width: 2, height: 5, background: 'rgba(255,255,255,0.6)', borderRadius: 1 }} />
      </div>
    </div>
  );
}

/**
 * La barra de estado del sistema operativo (hora, señal, wifi, batería) —
 * ninguna app la dibuja, siempre está ahí en una grabación de pantalla real.
 * Sin esto, por más que el resto de la pantalla sea idéntico a una app real,
 * algo se siente "flotando en el vacío" en vez de "dentro de un teléfono".
 */
export const StatusBarOS: React.FC = () => {
  return (
    <div
      style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
      }}
    >
      <div style={{ fontSize: 19, color: '#ececec', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>9:41</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconoSenal />
        <IconoWifi />
        <IconoBateria porcentaje={89} />
      </div>
    </div>
  );
};
