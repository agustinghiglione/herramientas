import React from 'react';

const FUENTE_SISTEMA = '-apple-system, "SF Pro Text", Inter, sans-serif';

function IconoSenal() {
  return (
    <svg width="39" height="35" viewBox="0 0 20 14" fill="none">
      <rect x="0" y="9" width="4" height="5" rx="1" fill="#FFFFFF" />
      <rect x="5.5" y="6" width="4" height="8" rx="1" fill="#FFFFFF" />
      <rect x="11" y="3" width="4" height="11" rx="1" fill="#FFFFFF" />
      <rect x="16.5" y="0" width="4" height="14" rx="1" fill="#FFFFFF" />
    </svg>
  );
}

function IconoWifi() {
  return (
    <svg width="35" height="35" viewBox="0 0 18 14" fill="none">
      <path d="M1 4.5C6.5 -0.5 11.5 -0.5 17 4.5" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M4 8C7.5 4.8 10.5 4.8 14 8" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="9" cy="12" r="2.2" fill="#FFFFFF" />
    </svg>
  );
}

function IconoBateria({ porcentaje }: { porcentaje: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 37, color: '#FFFFFF', fontFamily: FUENTE_SISTEMA, fontWeight: 600 }}>{porcentaje}%</span>
      <div style={{ position: 'relative', width: 46, height: 24, border: '2.3px solid rgba(255,255,255,0.7)', borderRadius: 6, padding: 3 }}>
        <div style={{ width: `${porcentaje}%`, height: '100%', background: '#FFFFFF', borderRadius: 1 }} />
        <div style={{ position: 'absolute', right: -6, top: 7, width: 3.5, height: 8, background: 'rgba(255,255,255,0.7)', borderRadius: 1 }} />
      </div>
    </div>
  );
}

/**
 * La barra de estado del sistema operativo (hora, señal 5G, wifi, batería) —
 * ninguna app la dibuja, siempre está ahí en una grabación de pantalla real.
 * Sin esto, por más que el resto de la pantalla sea idéntico a una app real,
 * algo se siente "flotando en el vacío" en vez de "dentro de un teléfono".
 * Es un renglón fijo — va siempre arriba de todo, antes que cualquier otra
 * cosa de la interfaz de la app, igual que en una captura real de iPhone.
 *
 * Medidas según la última ronda de ajuste del experto: +15% adicional
 * sobre los íconos y la tipografía de la vuelta anterior (para que no se
 * pierdan en pantallas móviles chicas) — hora y porcentaje a 37px/600,
 * íconos de ~35-39px.
 */
export const StatusBarOS: React.FC = () => {
  return (
    <div
      style={{
        height: 104,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 48,
        paddingRight: 48,
        paddingTop: 16,
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 37, color: '#FFFFFF', fontFamily: FUENTE_SISTEMA, fontWeight: 600 }}>9:41</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
        <IconoSenal />
        <span style={{ fontSize: 25, color: '#FFFFFF', fontFamily: FUENTE_SISTEMA, fontWeight: 500, letterSpacing: 0.2 }}>5G</span>
        <IconoWifi />
        <IconoBateria porcentaje={89} />
      </div>
    </div>
  );
};
