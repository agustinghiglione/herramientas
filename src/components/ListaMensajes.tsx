import React from 'react';

export interface MensajeSimple {
  rol: 'usuario' | 'chat';
  texto: string;
}

interface Props {
  historial: MensajeSimple[];
  /** Mensaje del chat que se está "escribiendo" en este momento, con revelado parcial por palabras. */
  respondiendo?: { texto: string; progreso: number };
}

function BurbujaUsuario({ texto }: { texto: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
      <div
        style={{
          maxWidth: '78%',
          background: '#2f2f2f',
          color: '#ececec',
          borderRadius: 22,
          padding: '18px 24px',
          fontSize: 30,
          lineHeight: 1.4,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {texto}
      </div>
    </div>
  );
}

function BloqueChat({ texto }: { texto: string }) {
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 34, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #10a37f, #1a7f64)',
          marginTop: 4,
        }}
      />
      <div
        style={{
          color: '#ececec',
          fontSize: 30,
          lineHeight: 1.5,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {texto}
      </div>
    </div>
  );
}

function textoParcialPorPalabras(texto: string, progreso: number) {
  const palabras = texto.split(' ');
  const cantidad = Math.max(1, Math.ceil(palabras.length * Math.min(1, Math.max(0, progreso))));
  return palabras.slice(0, cantidad).join(' ');
}

export const ListaMensajes: React.FC<Props> = ({ historial, respondiendo }) => {
  return (
    <div
      style={{
        flex: 1,
        padding: '36px 30px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {historial.map((m, i) =>
        m.rol === 'usuario' ? <BurbujaUsuario key={i} texto={m.texto} /> : <BloqueChat key={i} texto={m.texto} />,
      )}
      {respondiendo && <BloqueChat texto={textoParcialPorPalabras(respondiendo.texto, respondiendo.progreso)} />}
    </div>
  );
};
