import React from 'react';

/** Barra superior mínima, estilo app de ChatGPT: título centrado, íconos sutiles a los costados. */
export const ChatGPTHeader: React.FC = () => {
  return (
    <div
      style={{
        height: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 8, border: '2px solid rgba(255,255,255,0.35)' }} />
      <div style={{ color: '#ececec', fontSize: 30, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
        ChatGPT
      </div>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #10a37f, #1a7f64)',
        }}
      />
    </div>
  );
};
