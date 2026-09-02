import React from 'react';
import { interpolate } from 'remotion';

interface Props {
  frame: number;
  escribiendo: { texto: string; progreso: number } | null;
  respondiendo: boolean;
  progresoTeclado: number; // 0 = oculto, 1 = visible
}

function IconoMas28() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 4V20M4 12H20" stroke="#ececec" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconoOndas() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="1" y="8" width="3" height="6" rx="1.5" fill="#fff" />
      <rect x="6.5" y="4" width="3" height="14" rx="1.5" fill="#fff" />
      <rect x="12" y="0" width="3" height="22" rx="1.5" fill="#fff" />
      <rect x="17.5" y="6" width="3" height="10" rx="1.5" fill="#fff" />
    </svg>
  );
}

function IconoFlechaArriba() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 17V3M10 3L4 9M10 3L16 9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoDetener() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="0" y="0" width="16" height="16" rx="3" fill="#fff" />
    </svg>
  );
}

/** El botón redondo cambia de ícono según el estado — ondas de voz en reposo, flecha al escribir, cuadrado mientras el chat responde. */
function BotonEnvio({ estado }: { estado: 'idle' | 'escribiendo' | 'respondiendo' }) {
  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        background: '#0a84ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {estado === 'idle' && <IconoOndas />}
      {estado === 'escribiendo' && <IconoFlechaArriba />}
      {estado === 'respondiendo' && <IconoDetener />}
    </div>
  );
}

const FILA_1 = 'QWERTYUIOP'.split('');
const FILA_2 = 'ASDFGHJKL'.split('');
const FILA_3 = 'ZXCVBNM'.split('');

/** Flecha de mayúsculas (⇧), dibujada a mano para no depender de fuentes de emoji. */
function IconoShift() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M12 3L21 12H16V19H8V12H3L12 3Z" fill="#ececec" />
    </svg>
  );
}

/** Ícono de borrar (⌫). */
function IconoBackspace() {
  return (
    <svg width="30" height="24" viewBox="0 0 30 24" fill="none">
      <path d="M9 1H27C28.1 1 29 1.9 29 3V21C29 22.1 28.1 23 27 23H9L1 12L9 1Z" stroke="#ececec" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 8L22 16M22 8L14 16" stroke="#ececec" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconoGlobo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9.5" stroke="#ececec" strokeWidth="1.4" />
      <ellipse cx="12" cy="12" rx="4" ry="9.5" stroke="#ececec" strokeWidth="1.4" />
      <path d="M2.5 12H21.5M3.6 7.5H20.4M3.6 16.5H20.4" stroke="#ececec" strokeWidth="1.4" />
    </svg>
  );
}

function IconoMic() {
  return (
    <svg width="20" height="26" viewBox="0 0 20 26" fill="none">
      <rect x="6" y="1" width="8" height="15" rx="4" stroke="#ececec" strokeWidth="1.5" />
      <path d="M2 12C2 17 5.6 20.5 10 20.5C14.4 20.5 18 17 18 12" stroke="#ececec" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 20.5V25" stroke="#ececec" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Una tecla estilo iOS: rectángulo redondeado con sombra de "borde inferior"
 * (como las teclas físicas del teclado de iPhone), que se levanta y muestra
 * la burbuja ampliada de la letra cuando está "presionada" — el gesto más
 * reconocible del teclado real.
 */
function Tecla({
  contenido,
  faseActiva, // 0..1, o null si esta tecla no está siendo presionada ahora
  ancho = 1,
  variante = 'letra',
}: {
  contenido: React.ReactNode;
  faseActiva: number | null;
  ancho?: number;
  variante?: 'letra' | 'especial' | 'enviar';
}) {
  const presionada = faseActiva !== null && faseActiva < 0.55;
  // Empuje rápido hacia abajo y rebote de vuelta, sincronizado con la fase real del tipeo.
  const hundido = faseActiva === null ? 0 : interpolate(faseActiva, [0, 0.15, 0.55, 1], [0, 1, 0, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fondo = variante === 'enviar' ? '#0a84ff' : variante === 'especial' ? '#232325' : presionada ? '#5a5a5d' : '#333335';

  return (
    <div style={{ flex: ancho, margin: '0 3px', position: 'relative' }}>
      {/* Burbuja ampliada que aparece sobre la tecla al tipear esa letra — el gesto icónico del teclado de iPhone. */}
      {variante === 'letra' && faseActiva !== null && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '100%',
            transform: `translate(-50%, ${interpolate(faseActiva, [0, 0.2], [10, -6], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px) scale(${interpolate(faseActiva, [0, 0.2, 0.55, 0.75], [0.7, 1, 1, 0.85], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
            opacity: interpolate(faseActiva, [0, 0.1, 0.6, 0.8], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            width: 64,
            height: 78,
            background: '#59595c',
            borderRadius: 12,
            boxShadow: '0 6px 14px rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 34,
            fontWeight: 500,
            fontFamily: '-apple-system, "SF Pro Text", Inter, sans-serif',
            pointerEvents: 'none',
          }}
        >
          {contenido}
        </div>
      )}
      <div
        style={{
          height: 78,
          borderRadius: 9,
          background: fondo,
          boxShadow: presionada ? '0 1px 0 rgba(0,0,0,0.5)' : '0 2px 0 rgba(0,0,0,0.55)',
          color: '#ececec',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: variante === 'letra' ? 25 : 20,
          fontWeight: variante === 'enviar' ? 600 : 400,
          fontFamily: '-apple-system, "SF Pro Text", Inter, sans-serif',
          transform: `translateY(${hundido * 3}px)`,
        }}
      >
        {contenido}
      </div>
    </div>
  );
}

function TecladoVirtual({ letraActiva, faseCaracter }: { letraActiva: string | null; faseCaracter: number }) {
  const fase = (l: string) => (letraActiva === l ? faseCaracter : null);

  return (
    <div style={{ background: '#0c0c0d', padding: '14px 8px 22px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', marginBottom: 10 }}>
        {FILA_1.map((l) => (
          <Tecla key={l} contenido={l} faseActiva={fase(l)} />
        ))}
      </div>
      <div style={{ display: 'flex', marginBottom: 10, padding: '0 27px' }}>
        {FILA_2.map((l) => (
          <Tecla key={l} contenido={l} faseActiva={fase(l)} />
        ))}
      </div>
      <div style={{ display: 'flex', marginBottom: 10 }}>
        <Tecla contenido={<IconoShift />} faseActiva={null} ancho={1.5} variante="especial" />
        {FILA_3.map((l) => (
          <Tecla key={l} contenido={l} faseActiva={fase(l)} />
        ))}
        <Tecla contenido={<IconoBackspace />} faseActiva={null} ancho={1.5} variante="especial" />
      </div>
      <div style={{ display: 'flex' }}>
        <Tecla contenido="123" faseActiva={null} ancho={1.5} variante="especial" />
        <Tecla contenido={<IconoGlobo />} faseActiva={null} ancho={1.3} variante="especial" />
        <Tecla contenido="" faseActiva={fase(' ')} ancho={5.4} variante="especial" />
        <Tecla contenido={<IconoMic />} faseActiva={null} ancho={1.3} variante="especial" />
      </div>
    </div>
  );
}

function textoParcialPorCaracteres(texto: string, progreso: number) {
  const n = Math.ceil(texto.length * Math.min(1, Math.max(0, progreso)));
  return texto.slice(0, n);
}

export const ZonaEscritura: React.FC<Props> = ({ frame, escribiendo, respondiendo, progresoTeclado }) => {
  const textoParcial = escribiendo ? textoParcialPorCaracteres(escribiendo.texto, escribiendo.progreso) : '';
  const cursorVisible = Math.floor(frame / 12) % 2 === 0;

  // A qué letra le "toca" estar presionada ahora mismo, derivado del progreso
  // real de tipeo (no un contador arbitrario) — así la tecla que se levanta
  // es siempre la que realmente se está escribiendo en el mensaje.
  let letraActiva: string | null = null;
  let faseCaracter = 0;
  if (escribiendo && escribiendo.texto.length > 0) {
    const L = escribiendo.texto.length;
    const posicion = Math.min(L - 0.0001, escribiendo.progreso * L);
    const indice = Math.max(0, Math.floor(posicion));
    faseCaracter = posicion - indice;
    letraActiva = escribiendo.texto[indice].toUpperCase();
  }

  const estadoBoton: 'idle' | 'escribiendo' | 'respondiendo' = escribiendo ? 'escribiendo' : respondiendo ? 'respondiendo' : 'idle';

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
            gap: 16,
            padding: '0 16px 0 22px',
          }}
        >
          <IconoMas28 />
          <div
            style={{
              flex: 1,
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
          <BotonEnvio estado={estadoBoton} />
        </div>
      </div>
      <div
        style={{
          transform: `translateY(${(1 - progresoTeclado) * 100}%)`,
          opacity: progresoTeclado,
        }}
      >
        <TecladoVirtual letraActiva={letraActiva} faseCaracter={faseCaracter} />
      </div>
    </div>
  );
};
