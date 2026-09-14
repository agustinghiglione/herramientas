import React from 'react';
import { interpolate } from 'remotion';
import { Check, CheckCheck } from 'lucide-react';

const FUENTE_SISTEMA = '-apple-system, "SF Pro Text", Inter, sans-serif';
const AZUL_LEIDO = '#53BDEB'; // celeste de los tildes "leído" de WhatsApp

export interface MensajeWhatsApp {
  rol: 'entrante' | 'saliente';
  texto: string;
  /** Frame en el que el mensaje pasa a formar parte del historial fijo (para la animación de entrada). */
  frame: number;
  hora?: string;
  /** Solo aplica a mensajes salientes: muestra el tilde simple (enviado) o doble celeste (leído). */
  leido?: boolean;
}

const FRAMES_ENTRADA = 14;

function useEntrada(frame: number, frameDeAparicion: number) {
  const edad = frame - frameDeAparicion;
  const progreso = interpolate(edad, [0, FRAMES_ENTRADA], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const suavizado = 1 - Math.pow(1 - progreso, 3);
  return { opacity: suavizado, translateY: (1 - suavizado) * 22, scale: 0.96 + suavizado * 0.04 };
}

function Burbuja({ msg, frame }: { msg: MensajeWhatsApp; frame: number }) {
  const { opacity, translateY, scale } = useEntrada(frame, msg.frame);
  const saliente = msg.rol === 'saliente';
  return (
    <div style={{ display: 'flex', justifyContent: saliente ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '80%',
          // Translucido a propósito — el fondo (el video del perro) tiene
          // que seguir viéndose a través de la burbuja, como pidió Damian
          // para toda la "plantilla de mensajes".
          background: saliente ? 'rgba(217, 253, 211, 0.84)' : 'rgba(255, 255, 255, 0.84)',
          backdropFilter: 'blur(4px)',
          color: '#111111',
          borderRadius: 18,
          borderTopRightRadius: saliente ? 4 : 18,
          borderTopLeftRadius: saliente ? 18 : 4,
          padding: '20px 24px 14px',
          opacity,
          transform: `translateY(${translateY}px) scale(${scale})`,
          transformOrigin: saliente ? 'bottom right' : 'bottom left',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ fontSize: 34, lineHeight: 1.35, fontFamily: FUENTE_SISTEMA }}>{msg.texto}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginTop: 6 }}>
          {msg.hora && <span style={{ fontSize: 21, color: 'rgba(0,0,0,0.45)', fontFamily: FUENTE_SISTEMA }}>{msg.hora}</span>}
          {saliente &&
            (msg.leido ? <CheckCheck size={22} color={AZUL_LEIDO} strokeWidth={2.4} /> : <Check size={22} color="rgba(0,0,0,0.45)" strokeWidth={2.4} />)}
        </div>
      </div>
    </div>
  );
}

export const ListaMensajesWhatsApp: React.FC<{ frame: number; historial: MensajeWhatsApp[] }> = ({ frame, historial }) => {
  return (
    <div
      style={{
        flex: 1,
        padding: '32px 28px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        gap: 18,
        overflow: 'hidden',
      }}
    >
      {historial.map((m, i) => (
        <Burbuja key={i} msg={m} frame={frame} />
      ))}
    </div>
  );
};
