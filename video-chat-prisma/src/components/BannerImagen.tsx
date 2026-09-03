import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile } from 'remotion';

/**
 * El banner final de cierre — desde ahora es una imagen ya diseñada aparte
 * (ver README: el flujo de aprobación de banners), no un texto armado por
 * código. Se espera que ocupe el mismo formato 1080x1920 de la composición
 * y se sube a public/banners/actual.png; acá solo se muestra a pantalla
 * completa con un fundido de entrada breve, sin zoom de cámara ni viñeta —
 * esos efectos son para la interfaz del chat, no para tocar un diseño ya
 * terminado.
 */
export const BannerImagen: React.FC<{ progreso: number }> = ({ progreso }) => {
  const opacidad = interpolate(progreso, [0, 0.08], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', opacity: opacidad }}>
      <Img src={staticFile('banners/actual.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </AbsoluteFill>
  );
};
