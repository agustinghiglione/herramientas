import React from 'react';

interface Props {
  frame: number;
  escribiendo: { texto: string; progreso: number } | null;
  progresoTeclado: number; // 0 = oculto, 1 = visible
}

const FILAS_TECLADO = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

function Tecla({ letra, activa }: { letra: string; activa: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        margin: '0 4px',
        height: 78,
        borderRadius: 8,
        background: activa ? '#4a4a4d' : '#3a3a3d',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 24,
        fontFamily: 'Inter, sans-serif',
        transition: 'background 0.1s',
      }}
    >
      {letra}
    </div>
  );
}

function TecladoVirtual({ frame }: { frame: number }) {
  // Una "tecla activa" que va rotando cuadro a cuadro, para sugerir que se
  // está tipeando sin tener que sincronizar letra por letra con el texto real.
  const todas = FILAS_TECLADO.join('');
  const activaGlobal = todas[Math.floor(frame / 4) % todas.length];

  return (
    <div style={{ background: '#2c2c2e', padding: '18px 10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      {FILAS_TECLADO.map((fila, i) => (
        <div key={i} style={{ display: 'flex', marginBottom: 8, paddingLeft: i * 14 }}>
          {fila.split('').map((letra) => (
            <Tecla key={letra} letra={letra} activa={letra === activaGlobal} />
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', marginTop: 4 }}>
        <div style={{ flex: 1, margin: '0 4px', height: 70, borderRadius: 8, background: '#3a3a3d' }} />
      </div>
    </div>
  );
}

function textoParcialPorCaracteres(texto: string, progreso: number) {
  const n = Math.ceil(texto.length * Math.min(1, Math.max(0, progreso)));
  return texto.slice(0, n);
}

export const ZonaEscritura: React.FC<Props> = ({ frame, escribiendo, progresoTeclado }) => {
  const textoParcial = escribiendo ? textoParcialPorCaracteres(escribiendo.texto, escribiendo.progreso) : '';
  const cursorVisible = Math.floor(frame / 12) % 2 === 0;

  return (
    <div style={{ marginTop: 'auto' }}>
      <div style={{ padding: '0 28px 18px' }}>
        <div
          style={{
            background: '#2f2f2f',
            borderRadius: 30,
            minHeight: 76,
            display: 'flex',
            alignItems: 'center',
            padding: '0 26px',
            color: escribiendo ? '#ececec' : 'rgba(236,236,236,0.4)',
            fontSize: 28,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {escribiendo ? (
            <span>
              {textoParcial}
              {cursorVisible ? '▍' : ''}
            </span>
          ) : (
            'Enviar un mensaje'
          )}
        </div>
      </div>
      <div
        style={{
          transform: `translateY(${(1 - progresoTeclado) * 100}%)`,
          opacity: progresoTeclado,
        }}
      >
        <TecladoVirtual frame={frame} />
      </div>
    </div>
  );
};
