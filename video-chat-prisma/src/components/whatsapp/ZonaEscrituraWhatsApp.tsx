import React from 'react';
import { interpolate } from 'remotion';
import { Smile, Plus, Sticker, Camera, Send, Mic } from 'lucide-react';
import { estadoTipeo } from '../../guion';

const FUENTE_SISTEMA = '-apple-system, "SF Pro Text", Inter, sans-serif';

// Verde de WhatsApp (botón de envío) — se mantiene bien sólido a propósito:
// es el único elemento de acción, tiene que leerse claro incluso sobre
// video.
const VERDE_WHATSAPP = '#00A884';

interface Props {
  frame: number;
  escribiendo: { texto: string; progreso: number } | null;
  progresoTeclado: number; // 0 = oculto, 1 = visible
  /** Tres palabras para la barra predictiva — por defecto, palabras del propio mensaje del guion (ver PerroWhatsApp.tsx). */
  palabrasPredictivas?: [string, string, string];
}

/**
 * === Teclado iOS ===
 * Copiado a propósito desde components/ZonaEscritura.tsx (la herramienta de
 * Consultora Prisma) en vez de importarlo: es la MISMA lógica de tipeo/tecla
 * activa que pidió Damian reusar (curva de tipeo humana + tecla que se
 * "hunde" en sincro), pero esta herramienta vive en su propia carpeta
 * (components/whatsapp/) para no tocar nada de la campaña de Prisma que ya
 * está en producción. Si en algún momento se quiere una sola fuente de
 * verdad, este es el bloque a extraer a un archivo común.
 *
 * A diferencia del teclado de Prisma, TODO acá es translucido (fondos en
 * rgba, con blur) — el video del perro corre de punta a punta detrás y
 * tiene que seguir viéndose incluso con el teclado arriba.
 */

function IconoShift() {
  return (
    <svg width="43" height="43" viewBox="0 0 24 24" fill="none">
      <path d="M12 3L21 12H16V19H8V12H3L12 3Z" fill="#ececec" />
    </svg>
  );
}

function IconoBackspace() {
  return (
    <svg width="50" height="40" viewBox="0 0 30 24" fill="none">
      <path d="M9 1H27C28.1 1 29 1.9 29 3V21C29 22.1 28.1 23 27 23H9L1 12L9 1Z" stroke="#ececec" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 8L22 16M22 8L14 16" stroke="#ececec" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const FILA_1 = 'QWERTYUIOP'.split('');
const FILA_2 = 'ASDFGHJKLÑ'.split('');
const FILA_3 = 'ZXCVBNM'.split('');

function Tecla({
  contenido,
  faseActiva,
  ancho = 1,
  variante = 'letra',
}: {
  contenido: React.ReactNode;
  faseActiva: number | null;
  ancho?: number;
  variante?: 'letra' | 'especial' | 'enviar';
}) {
  const presionada = faseActiva !== null && faseActiva < 0.55;
  const hundido = faseActiva === null ? 0 : interpolate(faseActiva, [0, 0.15, 0.55, 1], [0, 1, 0, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fondo =
    variante === 'enviar'
      ? 'rgba(10, 132, 255, 0.85)'
      : variante === 'especial'
      ? 'rgba(35, 35, 37, 0.62)'
      : presionada
      ? 'rgba(100, 100, 103, 0.72)'
      : 'rgba(51, 51, 53, 0.62)';

  return (
    <div style={{ flex: ancho, margin: '0 5px', position: 'relative' }}>
      {variante === 'letra' && faseActiva !== null && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '100%',
            transform: `translate(-50%, ${interpolate(faseActiva, [0, 0.08, 0.22], [17, -17, -10], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px) scale(${interpolate(faseActiva, [0, 0.08, 0.22, 0.55, 0.75], [0.7, 1.2, 1, 1, 0.85], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
            opacity: interpolate(faseActiva, [0, 0.06, 0.6, 0.8], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            width: 130,
            height: 156,
            background: '#59595c',
            borderRadius: 23,
            boxShadow: '0 6px 14px rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 66,
            fontWeight: 500,
            fontFamily: FUENTE_SISTEMA,
            pointerEvents: 'none',
          }}
        >
          {contenido}
        </div>
      )}
      <div
        style={{
          height: 165,
          borderRadius: 17,
          background: fondo,
          boxShadow: presionada ? '0 1px 0 rgba(0,0,0,0.4)' : '0 2px 0 rgba(0,0,0,0.4)',
          color: '#ececec',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: variante === 'letra' ? 50 : 38,
          fontWeight: variante === 'enviar' ? 600 : 400,
          fontFamily: FUENTE_SISTEMA,
          transform: `translateY(${hundido * 3}px)`,
        }}
      >
        {contenido}
      </div>
    </div>
  );
}

function BarraPredictiva({ palabras }: { palabras: [string, string, string] }) {
  return (
    <div style={{ height: 50, display: 'flex', alignItems: 'stretch', background: 'rgba(44, 44, 46, 0.4)' }}>
      {palabras.map((palabra, i) => (
        <div
          key={palabra + i}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : undefined,
          }}
        >
          <span style={{ fontSize: 22, color: '#D1D1D6', fontFamily: FUENTE_SISTEMA, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{palabra}</span>
        </div>
      ))}
    </div>
  );
}

function HomeDock() {
  return (
    <div style={{ height: 90, background: 'rgba(21, 21, 21, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 46px' }}>
      <Smile color="#FFFFFF" size={34} strokeWidth={2} />
      <Mic color="#FFFFFF" size={34} strokeWidth={2} />
    </div>
  );
}

function TecladoVirtual({ letraActiva, faseCaracter, palabrasPredictivas }: { letraActiva: string | null; faseCaracter: number; palabrasPredictivas: [string, string, string] }) {
  const fase = (l: string) => (letraActiva === l ? faseCaracter : null);
  return (
    <div
      style={{
        background: 'rgba(28, 28, 30, 0.55)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '34px 34px 0 0',
        overflow: 'hidden',
      }}
    >
      <BarraPredictiva palabras={palabrasPredictivas} />
      <div style={{ padding: '14px 17px 0' }}>
        <div style={{ display: 'flex', marginBottom: 23 }}>
          {FILA_1.map((l) => (
            <Tecla key={l} contenido={l.toLowerCase()} faseActiva={fase(l)} />
          ))}
        </div>
        <div style={{ display: 'flex', marginBottom: 23 }}>
          {FILA_2.map((l) => (
            <Tecla key={l} contenido={l.toLowerCase()} faseActiva={fase(l)} />
          ))}
        </div>
        <div style={{ display: 'flex', marginBottom: 23 }}>
          <Tecla contenido={<IconoShift />} faseActiva={null} ancho={1.5} variante="especial" />
          {FILA_3.map((l) => (
            <Tecla key={l} contenido={l.toLowerCase()} faseActiva={fase(l)} />
          ))}
          <Tecla contenido={<IconoBackspace />} faseActiva={null} ancho={1.5} variante="especial" />
        </div>
        <div style={{ display: 'flex', marginBottom: 20 }}>
          <Tecla contenido="123" faseActiva={null} ancho={2} variante="especial" />
          <Tecla contenido="" faseActiva={fase(' ')} ancho={8} variante="especial" />
        </div>
      </div>
      <HomeDock />
    </div>
  );
}

/** Botón circular verde — mic en reposo, avión de papel (enviar) apenas hay texto. Mismo patrón de estado que BotonEnvio en la herramienta de Prisma. */
function BotonEnviarWhatsApp({ conTexto }: { conTexto: boolean }) {
  return (
    <div
      style={{
        width: 108,
        height: 108,
        borderRadius: 54,
        background: VERDE_WHATSAPP,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
      }}
    >
      {conTexto ? <Send color="#fff" size={46} strokeWidth={2.2} /> : <Mic color="#fff" size={46} strokeWidth={2.2} />}
    </div>
  );
}

export const ZonaEscrituraWhatsApp: React.FC<Props> = ({ frame, escribiendo, progresoTeclado, palabrasPredictivas = ['perro', 'juguete', 'nuevo'] }) => {
  const { textoVisible: textoParcial, letraActiva, faseActiva: faseCaracter } = escribiendo
    ? estadoTipeo(escribiendo.texto, escribiendo.progreso)
    : { textoVisible: '', letraActiva: null, faseActiva: 0 };
  const cursorVisible = Math.floor(frame / 12) % 2 === 0;
  const hayTexto = !!escribiendo;

  // Sombra suave para que los iconos que quedan AFUERA de la píldora (+ y
  // cámara, apoyados directo sobre el video) se lean bien sobre fondos
  // claros y oscuros del metraje real.
  const sombraIcono = { filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.55))' } as const;

  return (
    <div style={{ marginTop: 'auto' }}>
      {/*
        Barra de escritura — replica la disposición real de WhatsApp (foto
        de referencia de Damian): "+" suelto a la izquierda, la píldora con
        el ícono de sticker pegado a su borde derecho (no un emoji a la
        izquierda), cámara suelta a la derecha (se oculta en cuanto hay
        texto) y el botón circular mic/enviar al final.
      */}
      <div style={{ padding: '0 24px 40px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Plus color="#f2f2f2" size={40} strokeWidth={2.2} style={{ flexShrink: 0, ...sombraIcono }} />

        <div
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(8px)',
            borderRadius: 40,
            // minHeight (no height fija) — si el mensaje es largo y el texto
            // pasa a una segunda línea, la píldora tiene que crecer con él
            // en vez de dejar la línea de más colgando afuera del fondo.
            minHeight: 116,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '22px 20px 22px 28px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ flex: 1, color: hayTexto ? '#0d0d0d' : '#4a4a4a', fontSize: 34, lineHeight: 1.3, fontFamily: FUENTE_SISTEMA }}>
            {hayTexto ? (
              <span>
                {textoParcial}
                {cursorVisible ? '▍' : ''}
              </span>
            ) : (
              'Escribí un mensaje'
            )}
          </div>
          <Sticker color="#3a3a3a" size={36} strokeWidth={1.8} style={{ flexShrink: 0 }} />
        </div>

        {/* La cámara solo se ve en reposo — igual que en WhatsApp real, se
            oculta apenas hay texto y el botón circular pasa a "enviar". */}
        {!hayTexto && <Camera color="#f2f2f2" size={38} strokeWidth={1.8} style={{ flexShrink: 0, ...sombraIcono }} />}

        <BotonEnviarWhatsApp conTexto={hayTexto} />
      </div>

      <div style={{ display: 'grid', gridTemplateRows: `${progresoTeclado}fr`, opacity: progresoTeclado }}>
        <div style={{ overflow: 'hidden' }}>
          <TecladoVirtual letraActiva={letraActiva} faseCaracter={faseCaracter} palabrasPredictivas={palabrasPredictivas} />
        </div>
      </div>
    </div>
  );
};
