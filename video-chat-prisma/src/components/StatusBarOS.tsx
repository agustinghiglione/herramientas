import React from 'react';
import { MARGEN_SEGURO_H, MARGEN_SEGURO_V } from '../margenSeguro';

const FUENTE_SISTEMA = '-apple-system, "SF Pro Text", Inter, sans-serif';

function IconoSenal() {
  return (
    <svg width="49" height="44" viewBox="0 0 20 14" fill="none">
      <rect x="0" y="9" width="4" height="5" rx="1" fill="#FFFFFF" />
      <rect x="5.5" y="6" width="4" height="8" rx="1" fill="#FFFFFF" />
      <rect x="11" y="3" width="4" height="11" rx="1" fill="#FFFFFF" />
      <rect x="16.5" y="0" width="4" height="14" rx="1" fill="#FFFFFF" />
    </svg>
  );
}

function IconoWifi() {
  return (
    <svg width="44" height="44" viewBox="0 0 18 14" fill="none">
      <path d="M1 4.5C6.5 -0.5 11.5 -0.5 17 4.5" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M4 8C7.5 4.8 10.5 4.8 14 8" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="9" cy="12" r="2" fill="#FFFFFF" />
    </svg>
  );
}

function IconoBateria({ porcentaje }: { porcentaje: number }) {
  // Sin número de porcentaje al lado — en la captura real de referencia del
  // iPhone del cliente, la barra de estado no muestra "89%", solo el ícono.
  return (
    <div style={{ position: 'relative', width: 83, height: 44, border: '4.2px solid rgba(255,255,255,0.7)', borderRadius: 11, padding: 5.5 }}>
      <div style={{ width: `${porcentaje}%`, height: '100%', background: '#FFFFFF', borderRadius: 1 }} />
      <div style={{ position: 'absolute', right: -11, top: 12, width: 6.4, height: 14.6, background: 'rgba(255,255,255,0.7)', borderRadius: 1 }} />
    </div>
  );
}

/**
 * La barra de estado del sistema operativo (hora, señal, wifi, batería) —
 * ninguna app la dibuja, siempre está ahí en una grabación de pantalla real.
 * Sin esto, por más que el resto de la pantalla sea idéntico a una app real,
 * algo se siente "flotando en el vacío" en vez de "dentro de un teléfono".
 * Es un renglón fijo — va siempre arriba de todo, antes que cualquier otra
 * cosa de la interfaz de la app, igual que en una captura real de iPhone.
 *
 * Contenido ajustado contra una captura real del iPhone del cliente: sin
 * "5G" y sin el número de porcentaje al lado de la batería — esa captura
 * de referencia solo muestra los tres íconos (señal, wifi, batería), nada
 * de texto extra.
 *
 * Escala subida ~1.36x (altura y todos los íconos) — contra la comparación
 * pixel a pixel de la captura real, esta barra se quedaba corta y dejaba
 * una franja de espacio "de más" arriba, en vez de ocupar la proporción
 * real que ocupa en un iPhone real.
 */
export const StatusBarOS: React.FC = () => {
  return (
    <div
      style={{
        height: 150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        // +MARGEN_SEGURO_* sobre los valores originales (65 / 22) — margen
        // de seguridad contra el recorte de TikTok, ver margenSeguro.ts.
        paddingLeft: 65 + MARGEN_SEGURO_H,
        paddingRight: 65 + MARGEN_SEGURO_H,
        paddingTop: 22 + MARGEN_SEGURO_V,
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 46, color: '#FFFFFF', fontFamily: FUENTE_SISTEMA, fontWeight: 600 }}>9:41</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <IconoSenal />
        <IconoWifi />
        <IconoBateria porcentaje={89} />
      </div>
    </div>
  );
};
