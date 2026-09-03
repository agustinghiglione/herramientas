import React from 'react';
import type { BloqueContenido } from '../guion';

const FUENTE_SISTEMA = '-apple-system, "SF Pro Text", Inter, sans-serif';

// Color de marca (mismo dorado del banner y del footer del sitio) para el
// texto "++destacado++" — cuando la respuesta recomienda algo nuestro, tiene
// que saltar a la vista en el medio del texto.
const COLOR_MARCA = '#e4b15e';

/**
 * Un párrafo: spans en negrita, normales, o destacados en color de marca.
 * `colorBase` distingue el mensaje del usuario (blanco puro, según el
 * pliego de especificaciones) de la respuesta del chat (#ECECEC) — la
 * negrita siempre pasa a blanco puro en ambos casos.
 */
function Parrafo({ spans, colorBase }: { spans: { texto: string; negrita: boolean; destacado: boolean }[]; colorBase: string }) {
  return (
    <p style={{ margin: '0 0 22px', fontSize: 30, lineHeight: 1.4, color: colorBase, fontFamily: FUENTE_SISTEMA }}>
      {spans.map((s, i) => (
        <span
          key={i}
          style={{
            fontWeight: s.negrita || s.destacado ? 700 : 400,
            color: s.destacado ? COLOR_MARCA : s.negrita ? '#FFFFFF' : undefined,
          }}
        >
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
        background: '#1E1E1E',
        border: '1px solid #2C2C2C',
        borderRadius: 16,
        padding: 24,
        marginBottom: 18,
        fontFamily: FUENTE_SISTEMA,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {icono && <span style={{ fontSize: 24 }}>{icono}</span>}
        <span style={{ fontSize: 22, color: '#A1A1A1' }}>{etiqueta}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, color: '#FFFFFF', marginBottom: 10 }}>{herramienta}</div>
      {porque && (
        <div style={{ fontSize: 22, lineHeight: 1.45, color: '#A1A1A1', marginBottom: fuente ? 14 : 0 }}>
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
          <span style={{ fontSize: 18, color: '#666666' }}>{fuente}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Renderiza un conjunto de bloques (párrafos + tablas) — se le puede pasar
 * la versión ya "revelada" parcialmente. `variante` decide el color base del
 * texto: blanco puro para la burbuja del usuario, #ECECEC para la respuesta
 * del chat (según el pliego de especificaciones de tipografía).
 */
export const ContenidoMensaje: React.FC<{ bloques: BloqueContenido[]; variante?: 'usuario' | 'chat' }> = ({ bloques, variante = 'chat' }) => {
  const colorBase = variante === 'usuario' ? '#FFFFFF' : '#ECECEC';
  return (
    <>
      {bloques.map((b, i) =>
        b.tipo === 'parrafo' ? (
          <Parrafo key={i} spans={b.spans} colorBase={colorBase} />
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
