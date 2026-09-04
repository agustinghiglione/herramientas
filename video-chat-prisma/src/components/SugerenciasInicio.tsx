import React from 'react';
import { interpolate } from 'remotion';
import { Image, Pencil, Globe, LucideIcon } from 'lucide-react';

const FUENTE_SISTEMA = '-apple-system, "SF Pro Text", Inter, sans-serif';

// Cuántos frames tarda el fade-out de las sugerencias apenas arranca el
// tipeo del primer carácter — rápido y sutil, no una transición larga.
const FRAMES_FADE_OUT = 3;

const SUGERENCIAS: { icono: LucideIcon; texto: string }[] = [
  { icono: Image, texto: 'Crear una imagen o sticker' },
  { icono: Pencil, texto: 'Escribe o edita' },
  { icono: Globe, texto: 'Busca en la web' },
];

interface Props {
  frame: number;
  /** Frame en el que arranca el tipeo del primer carácter — a partir de acá empieza el fade-out. undefined si no hay ninguno (no debería pasar en este guion). */
  frameFadeOut?: number;
}

/**
 * Lista de sugerencias rápidas — fiel a la pantalla de inicio real de la
 * app: una lista VERTICAL alineada a la izquierda, pegada arriba del campo
 * de entrada (nunca píldoras horizontales flotantes), con íconos
 * vectoriales de lucide-react en gris, sin fondo redondeado. Desaparecen
 * con un fade-out breve apenas el usuario empieza a escribir, no de golpe.
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        {SUGERENCIAS.map((s, i) => {
          const Icono = s.icono;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <Icono color="#A6A6A6" size={30} />
              <span style={{ fontSize: 28, color: '#ECECEC', fontFamily: FUENTE_SISTEMA }}>{s.texto}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
