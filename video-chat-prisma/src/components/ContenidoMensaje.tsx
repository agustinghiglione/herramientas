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
  // Interlineado más ajustado y menos margen entre párrafos que en la
  // ronda anterior — así la respuesta termina más arriba y les deja a las
  // tarjetas de consejo la mitad inferior de la pantalla, que es donde
  // tiene que estar puesta la atención justo antes del corte al banner.
  return (
    <p style={{ margin: '0 0 16px', fontSize: 39, lineHeight: 1.3, color: colorBase, fontFamily: FUENTE_SISTEMA }}>
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

/**
 * Una fila de la "tabla" de comparación, como tarjeta — se lee mejor en
 * formato vertical que columnas que se cortan.
 *
 * Rediseñada como foco de conversión (según feedback del experto): título
 * grande y en blanco puro, bajada con más contraste, emoji como ancla
 * visual, y el link de la fuente en azul celeste — para que se lea de un
 * solo golpe de vista, sin tener que pausar el video.
 */
function TarjetaFila({ icono, etiqueta, herramienta, porque, fuente }: { icono: string; etiqueta: string; herramienta: string; porque: string; fuente?: string }) {
  return (
    <div
      style={{
        background: '#1E1E1E',
        border: '1.5px solid #3A3A3A',
        borderRadius: 19,
        padding: 32,
        marginBottom: 22,
        fontFamily: FUENTE_SISTEMA,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        {icono && <span style={{ fontSize: 42, lineHeight: 1 }}>{icono}</span>}
        <span style={{ fontSize: 26, color: '#A1A1A1' }}>{etiqueta}</span>
      </div>
      <div style={{ fontSize: 35, fontWeight: 700, color: '#FFFFFF', marginBottom: 12 }}>{herramienta}</div>
      {porque && (
        <div style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.4, color: '#E1E1E1', marginBottom: fuente ? 17 : 0 }}>
          {porque}
        </div>
      )}
      {fuente && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 999,
            padding: '7px 17px 7px 10px',
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: '#ececec',
            }}
          >
            IA
          </span>
          {/* Azul "link" (#007AFF, el mismo del botón de envío) para que se
              lea como un enlace clickeable, no como un dato al pasar. */}
          <span style={{ fontSize: 22, color: '#007AFF', fontWeight: 500 }}>{fuente}</span>
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
          // +20px de aire extra debajo de las tarjetas (pedido del experto)
          // para que respiren antes de la barra de entrada: 22px que ya
          // tenía este bloque + 20px = 42px.
          <div key={i} style={{ marginBottom: 42 }}>
            {b.filas.map((f, j) => (
              <TarjetaFila key={j} {...f} />
            ))}
          </div>
        ),
      )}
    </>
  );
};
