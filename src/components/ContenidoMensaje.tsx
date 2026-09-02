import React from 'react';
import type { BloqueContenido } from '../guion';

/** Un párrafo: spans en negrita o normales, en fila. */
function Parrafo({ spans }: { spans: { texto: string; negrita: boolean }[] }) {
  return (
    <p style={{ margin: '0 0 22px', fontSize: 30, lineHeight: 1.5, color: '#ececec', fontFamily: 'Inter, sans-serif' }}>
      {spans.map((s, i) => (
        <span key={i} style={{ fontWeight: s.negrita ? 700 : 400 }}>
          {s.texto}
        </span>
      ))}
    </p>
  );
}

/** Una fila de la "tabla" de comparación, como tarjeta — se lee mejor en formato vertical que columnas que se cortan. */
function TarjetaFila({ icono, etiqueta, herramienta, porque, fuente }: { icono: string; etiqueta: string; herramienta: string; porque: string; fuente?: string }) {
  return (
    <div
      style={{
        background: '#2a2a2c',
        borderRadius: 18,
        padding: '22px 26px',
        marginBottom: 18,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {icono && <span style={{ fontSize: 24 }}>{icono}</span>}
        <span style={{ fontSize: 22, color: 'rgba(236,236,236,0.55)' }}>{etiqueta}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: '#ececec', marginBottom: 10 }}>{herramienta}</div>
      {porque && (
        <div style={{ fontSize: 25, lineHeight: 1.45, color: 'rgba(236,236,236,0.85)', marginBottom: fuente ? 14 : 0 }}>
          {porque}
        </div>
      )}
      {fuente && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 999,
            padding: '6px 14px 6px 8px',
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: '#ececec',
            }}
          >
            IA
          </span>
          <span style={{ fontSize: 19, color: 'rgba(236,236,236,0.7)' }}>{fuente}</span>
        </div>
      )}
    </div>
  );
}

/** Renderiza un conjunto de bloques (párrafos + tablas) — se le puede pasar la versión ya "revelada" parcialmente. */
export const ContenidoMensaje: React.FC<{ bloques: BloqueContenido[] }> = ({ bloques }) => {
  return (
    <>
      {bloques.map((b, i) =>
        b.tipo === 'parrafo' ? (
          <Parrafo key={i} spans={b.spans} />
        ) : (
          <div key={i} style={{ marginBottom: 22 }}>
            {b.filas.map((f, j) => (
              <TarjetaFila key={j} {...f} />
            ))}
          </div>
        ),
      )}
    </>
  );
};
