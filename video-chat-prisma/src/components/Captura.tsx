import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { FRACCION_ESPERA_CAPTURA } from '../guion';

/**
 * Destello blanco breve que simula el flash de una captura de pantalla.
 * Primero hay una pausa de lectura (sin flash, se ve el chat ya terminado
 * y quieto) y recién en el último tramo del evento aparece el flash, justo
 * antes de que corte al banner — "termina el chat, espera, screenshot,
 * banner", no "termina el chat, screenshot, espera, banner".
 */
export const Captura: React.FC<{ progreso: number }> = ({ progreso }) => {
  // Pico de opacidad casi al instante DESPUÉS de la pausa, y se apaga justo
  // cuando el evento termina (ahí es cuando entra el banner).
  const picoFlash = FRACCION_ESPERA_CAPTURA + (1 - FRACCION_ESPERA_CAPTURA) * 0.25;
  const opacidad = interpolate(progreso, [0, FRACCION_ESPERA_CAPTURA, picoFlash, 1], [0, 0, 0.85, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (opacidad <= 0) return null;

  return (
    <AbsoluteFill
      style={{
        background: '#fff',
        opacity: opacidad,
        pointerEvents: 'none',
      }}
    />
  );
};
