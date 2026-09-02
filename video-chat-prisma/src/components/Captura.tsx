import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';

/** Destello blanco breve que simula el flash de una captura de pantalla. */
export const Captura: React.FC<{ progreso: number }> = ({ progreso }) => {
  // Pico de opacidad casi al instante, después se apaga rápido.
  const opacidad = interpolate(progreso, [0, 0.12, 0.4, 1], [0, 0.85, 0, 0], {
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
