import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';

/**
 * Pantalla de cierre fija (estática, sin movimiento de cámara ni de texto)
 * con la identidad de Consultora Prisma y el dominio siempre visible —
 * el cierre de marca que tiene que llevar todo video de la campaña.
 */
export const BannerFinal: React.FC<{ texto: string; progreso: number }> = ({ texto, progreso }) => {
  const entrada = interpolate(progreso, [0, 0.15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: '#223c54',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 80px',
        textAlign: 'center',
        opacity: entrada,
      }}
    >
      <div
        style={{
          fontFamily: 'Manrope, sans-serif',
          fontSize: 40,
          color: '#faf8f5',
          letterSpacing: 2,
          marginBottom: 46,
        }}
      >
        <span style={{ fontWeight: 500 }}>CONSULTORA</span> <span style={{ fontWeight: 800 }}>PRISMA</span>
      </div>

      <div
        style={{
          width: 90,
          height: 4,
          background: '#e4b15e',
          borderRadius: 2,
          marginBottom: 46,
        }}
      />

      <div
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 34,
          lineHeight: 1.5,
          color: '#faf8f5',
          marginBottom: 56,
        }}
      >
        {texto}
      </div>

      <div
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 30,
          fontWeight: 600,
          color: '#e4b15e',
        }}
      >
        consultoraprisma.digital
      </div>
    </AbsoluteFill>
  );
};
