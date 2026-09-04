import React from 'react';
import { interpolate } from 'remotion';
import { Smile, Mic } from 'lucide-react';
import { estadoTipeo } from '../guion';

const FUENTE_SISTEMA = '-apple-system, "SF Pro Text", Inter, sans-serif';

interface Props {
  frame: number;
  escribiendo: { texto: string; progreso: number } | null;
  respondiendo: boolean;
  progresoTeclado: number; // 0 = oculto, 1 = visible
}

function IconoMas28() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
      <path d="M12 4V20M4 12H20" stroke="#A6A6A6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconoOndas() {
  return (
    <svg width="30" height="30" viewBox="0 0 22 22" fill="none">
      <rect x="1" y="8" width="3" height="6" rx="1.5" fill="#fff" />
      <rect x="6.5" y="4" width="3" height="14" rx="1.5" fill="#fff" />
      <rect x="12" y="0" width="3" height="22" rx="1.5" fill="#fff" />
      <rect x="17.5" y="6" width="3" height="10" rx="1.5" fill="#fff" />
    </svg>
  );
}

function IconoFlechaArriba() {
  return (
    <svg width="34" height="34" viewBox="0 0 20 20" fill="none">
      <path d="M10 17V3M10 3L4 9M10 3L16 9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconoDetener() {
  return (
    <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
      <rect x="0" y="0" width="16" height="16" rx="3" fill="#fff" />
    </svg>
  );
}

/** El botón redondo cambia de ícono según el estado — ondas de voz en reposo, flecha al escribir, cuadrado mientras el chat responde. */
function BotonEnvio({ estado }: { estado: 'idle' | 'escribiendo' | 'respondiendo' }) {
  return (
    <div
      style={{
        width: 76,
        height: 76,
        borderRadius: 38,
        background: '#007AFF',
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

/**
 * Botón de dictado por voz — sin fondo, a la izquierda del botón circular
 * celeste. Solo aparece en reposo (antes de que el usuario empiece a
 * escribir); la app real lo esconde apenas hay texto, dejando solo la
 * flecha de enviar.
 */
function BotonMic() {
  return (
    <div style={{ width: 53, height: 53, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <IconoMic />
    </div>
  );
}

// Layout en español: la fila 2 lleva la Ñ al final (a s d f g h j k l ñ) y,
// a diferencia del layout en inglés, esa fila NO va inset — tiene 10 teclas,
// igual que la fila 1, así que ocupa el mismo ancho completo.
const FILA_1 = 'QWERTYUIOP'.split('');
const FILA_2 = 'ASDFGHJKLÑ'.split('');
const FILA_3 = 'ZXCVBNM'.split('');

/** Flecha de mayúsculas (⇧), dibujada a mano para no depender de fuentes de emoji. */
function IconoShift() {
  return (
    <svg width="43" height="43" viewBox="0 0 24 24" fill="none">
      <path d="M12 3L21 12H16V19H8V12H3L12 3Z" fill="#ececec" />
    </svg>
  );
}

/** Ícono de borrar (⌫). */
function IconoBackspace() {
  return (
    <svg width="50" height="40" viewBox="0 0 30 24" fill="none">
      <path d="M9 1H27C28.1 1 29 1.9 29 3V21C29 22.1 28.1 23 27 23H9L1 12L9 1Z" stroke="#ececec" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 8L22 16M22 8L14 16" stroke="#ececec" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconoMic() {
  return (
    <svg width="24" height="31" viewBox="0 0 20 26" fill="none">
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
    <div style={{ flex: ancho, margin: '0 5px', position: 'relative' }}>
      {/* Burbuja ampliada que aparece sobre la tecla al tipear esa letra — el gesto icónico del teclado de iPhone. */}
      {variante === 'letra' && faseActiva !== null && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '100%',
            // "Pop" rápido y con un poco de rebote (translateY(-10px) scale(1.2)
            // apenas se presiona), en vez de una entrada lenta — así se lee
            // como un golpe de tecla real, no como un fade suave.
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
            fontFamily: '-apple-system, "SF Pro Text", Inter, sans-serif',
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
          boxShadow: presionada ? '0 1px 0 rgba(0,0,0,0.5)' : '0 2px 0 rgba(0,0,0,0.55)',
          color: '#ececec',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: variante === 'letra' ? 50 : 38,
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

/**
 * Barra de autocompletado predictivo, pegada arriba de la primera fila de
 * teclas — así se ve un teclado de iPhone real, nunca las teclas empiezan
 * pegadas contra el input. Tres celdas fijas con la marca (para este video
 * en particular), separadas por divisores finos.
 *
 * Fondo IDÉNTICO al del cuerpo del teclado (#2C2C2E) — no es un contenedor
 * propio con su propio color/esquinas, se funde con el teclado; lo único
 * que la separa en celdas son las dos líneas divisorias ultra finas.
 */
function BarraPredictiva() {
  const PALABRAS = ['consultora', 'prisma', 'digital'];
  return (
    <div
      style={{
        height: 50,
        display: 'flex',
        alignItems: 'stretch',
        background: '#2C2C2E',
      }}
    >
      {PALABRAS.map((palabra, i) => (
        <div
          key={palabra}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderLeft: i > 0 ? '1px solid #3A3A3C' : undefined,
          }}
        >
          <span style={{ fontSize: 22, color: '#D1D1D6', fontFamily: FUENTE_SISTEMA }}>{palabra}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Barra de navegación inferior (Home Dock) — franja propia, más oscura que
 * el cuerpo del teclado, que vive DEBAJO de la fila de espacio (no es parte
 * del cuerpo del teclado en sí). Aloja el ícono de emoji a la izquierda y
 * el de dictado a la derecha.
 *
 * Contra una captura real de referencia del iPhone del cliente: esa
 * captura NO muestra la barra blanca del home indicator dentro del
 * contenido de la app (el sistema la dibuja aparte, no queda en la
 * captura), así que la sacamos. Los íconos ahí van en blanco pleno y
 * trazo grueso, no gris apagado — se ven bien definidos, no apagados.
 */
function HomeDock() {
  return (
    <div
      style={{
        height: 90,
        background: '#151515',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 46px',
      }}
    >
      <Smile color="#FFFFFF" size={34} strokeWidth={2} />
      <Mic color="#FFFFFF" size={34} strokeWidth={2} />
    </div>
  );
}

// Teclado escalado ~1.66x respecto a la versión anterior, para llegar a
// los ~820px (42-43% del alto del canvas) que pidió el experto — en un
// iPhone real el teclado ocupa mucha más proporción de pantalla que lo
// que se ve en un mockup de escritorio.
//
// Layout en español (no en inglés): letras en minúscula (mayúscula fija
// solo activa con ⇧), Ñ al final de la fila del medio.
//
// Anatomía en dos bloques verticales independientes, igual que un iPhone
// real: el CUERPO del teclado (filas de letras + fila "123"/espacio, con
// la barra predictiva arriba) termina en la fila de espacio — ya no lleva
// el emoji ni el micrófono, esos íconos ahora viven en el HomeDock, la
// franja propia de abajo (más oscura, con el home indicator centrado).
function TecladoVirtual({ letraActiva, faseCaracter }: { letraActiva: string | null; faseCaracter: number }) {
  // letraActiva siempre llega en MAYÚSCULA (así lo devuelve estadoTipeo, para
  // no depender de mayúsculas/minúsculas al comparar) — las teclas en sí se
  // MUESTRAN en minúscula, así que la comparación va contra la versión en
  // mayúscula de cada letra, no contra lo que se ve en la tecla.
  const fase = (l: string) => (letraActiva === l ? faseCaracter : null);

  return (
    <div style={{ background: '#2C2C2E', borderTop: '1px solid rgba(255,255,255,0.06)', borderRadius: '34px 34px 0 0', overflow: 'hidden' }}>
      <BarraPredictiva />
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

export const ZonaEscritura: React.FC<Props> = ({ frame, escribiendo, respondiendo, progresoTeclado }) => {
  // Una sola fuente de verdad (ritmo humano, no lineal) para el texto
  // parcial Y la tecla activa del teclado — así nunca se desincronizan.
  const { textoVisible: textoParcial, letraActiva, faseActiva: faseCaracter } = escribiendo
    ? estadoTipeo(escribiendo.texto, escribiendo.progreso)
    : { textoVisible: '', letraActiva: null, faseActiva: 0 };
  const cursorVisible = Math.floor(frame / 12) % 2 === 0;

  const estadoBoton: 'idle' | 'escribiendo' | 'respondiendo' = escribiendo ? 'escribiendo' : respondiendo ? 'respondiendo' : 'idle';

  return (
    <div style={{ marginTop: 'auto' }}>
      {/* Espacio inferior subido de 20 a 46px — contra una captura real de
          referencia, el campo de texto no queda pegado al borde de abajo,
          deja un leve margen (más notorio todavía cuando el teclado está
          escondido y no hay nada debajo que lo empuje). */}
      <div style={{ padding: '0 28px 46px' }}>
        <div
          style={{
            background: '#171717',
            borderRadius: 60,
            height: 120,
            display: 'flex',
            alignItems: 'center',
            gap: 19,
            padding: '0 19px 0 29px',
          }}
        >
          <IconoMas28 />
          <div
            style={{
              flex: 1,
              color: escribiendo ? '#ececec' : '#737373',
              fontSize: escribiendo ? 36 : 31,
              fontFamily: FUENTE_SISTEMA,
            }}
          >
            {escribiendo ? (
              <span>
                {textoParcial}
                {cursorVisible ? '▍' : ''}
              </span>
            ) : (
              'Preguntar a ChatGPT'
            )}
          </div>
          {/* El dictado por voz solo tiene sentido antes de que haya texto — igual que la app real, desaparece apenas se empieza a escribir. */}
          {estadoBoton === 'idle' && <BotonMic />}
          <BotonEnvio estado={estadoBoton} />
        </div>
      </div>
      {/*
        El teclado colapsa animando su ALTURA real (truco de "grid-template-rows:
        0fr -> 1fr"), no solo un translateY/opacity — así, cuando se esconde,
        el espacio que ocupaba se libera de verdad en el layout y la burbuja de
        mensaje de arriba baja para recuperarlo, tal como en un teléfono real.
      */}
      <div style={{ display: 'grid', gridTemplateRows: `${progresoTeclado}fr`, opacity: progresoTeclado }}>
        <div style={{ overflow: 'hidden' }}>
          <TecladoVirtual letraActiva={letraActiva} faseCaracter={faseCaracter} />
        </div>
      </div>
    </div>
  );
};
