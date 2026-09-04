import React from 'react';
import { interpolate } from 'remotion';

const FUENTE_SISTEMA = '-apple-system, "SF Pro Text", Inter, sans-serif';

// Cuántos frames tarda el fade-out de las sugerencias apenas arranca el
// tipeo del primer carácter — rápido y sutil, no una transición larga.
const FRAMES_FADE_OUT = 3;

function IconoImagen() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="3" stroke="#ececec" strokeWidth="1.6" />
      <circle cx="8" cy="10" r="2" stroke="#ececec" strokeWidth="1.6" />
      <path d="M4 17L9 12L13 16L16 13L20 17" stroke="#ececec" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoEditar() {
  return (
    <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
      <path d="M13.5 2.5L17.5 6.5L7 17H3V13L13.5 2.5Z" stroke="#ececec" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function IconoBuscar() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="10.5" cy="10.5" r="7" stroke="#ececec" strokeWidth="1.6" />
      <path d="M20 20L15.5 15.5" stroke="#ececec" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const SUGERENCIAS: { icono: React.FC; texto: string }[] = [
  { icono: IconoImagen, texto: 'Crear una imagen o sticker' },
  { icono: IconoEditar, texto: 'Escribe o edita' },
  { icono: IconoBuscar, texto: 'Busca en la web' },
];

interface Props {
  frame: number;
  /** Frame en el que arranca el tipeo del primer carácter — a partir de acá empieza el fade-out. undefined si no hay ninguno (no debería pasar en este guion). */
  frameFadeOut?: number;
}

/**
 * Chips de sugerencias rápidas, en fila y con ícono — igual que la pantalla
 * de inicio real de la app: van pegados arriba del campo de entrada (no
 * flotando en medio de un lienzo vacío), y desaparecen con un fade-out
 * breve apenas el usuario empieza a escribir, no de golpe.
 */
export const SugerenciasInicio: React.FC<Props> = ({ frame, frameFadeOut }) => {
  const opacidad =
    frameFadeOut !== undefined
      ? interpolate(frame, [frameFadeOut, frameFadeOut + FRAMES_FADE_OUT], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

  if (opacidad <= 0) return null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 28px 20px', opacity: opacidad }}>
      <div style={{ display: 'flex', gap: 16 }}>
        {SUGERENCIAS.map((s, i) => {
          const Icono = s.icono;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: '#1E1E1E',
                border: '1px solid #2C2C2C',
                borderRadius: 999,
                padding: '14px 22px',
                flexShrink: 0,
              }}
            >
              <Icono />
              <span style={{ fontSize: 24, color: '#ececec', fontFamily: FUENTE_SISTEMA, whiteSpace: 'nowrap' }}>{s.texto}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
