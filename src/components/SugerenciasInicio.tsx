import React from 'react';

const SUGERENCIAS: { emoji: string; texto: string; atenuada?: boolean }[] = [
  { emoji: '📊', texto: 'Resumir mis pendientes' },
  { emoji: '✉️', texto: 'Redactar un mail de seguimiento' },
  { emoji: '📅', texto: 'Prepararme para la próxima reunión', atenuada: true },
];

/** Las sugerencias que muestra la pantalla de inicio antes de que el usuario empiece a escribir — pura ambientación. */
export const SugerenciasInicio: React.FC = () => {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 30px 24px', gap: 34 }}>
      {SUGERENCIAS.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20, opacity: s.atenuada ? 0.4 : 1 }}>
          <span style={{ fontSize: 26 }}>{s.emoji}</span>
          <span style={{ fontSize: 28, color: '#ececec', fontFamily: 'Inter, sans-serif' }}>{s.texto}</span>
        </div>
      ))}
    </div>
  );
};
