import React from 'react';
import { BadgeCheck } from 'lucide-react';

const FUENTE_SISTEMA = '-apple-system, "SF Pro Text", Inter, sans-serif';
const VERDE_VERIFICADO = '#00A884';

/**
 * Barra superior minimalista. Ahora el perro le escribe directamente a
 * "Tienda +Cotas" (antes era la veterinaria) — con el tilde de verificado
 * de WhatsApp Business al lado del nombre, para que quede claro que es la
 * cuenta oficial de la tienda. Sin flecha de volver, sin avatar, sin
 * iconos de llamada ni "en línea": solo el nombre, en un tono translucido
 * para que el fondo (el perro, en video, corriendo de punta a punta detrás
 * de todo el overlay) se siga viendo siempre.
 *
 * La opacidad general de este + el resto del chat la controla el padre
 * (PerroWhatsApp.tsx envuelve header + mensajes + zona de escritura en un
 * único AbsoluteFill con opacity), así que este componente no necesita su
 * propio manejo de fade.
 */
export const WhatsAppHeader: React.FC<{ nombre?: string; verificado?: boolean }> = ({ nombre = 'Tienda +Cotas', verificado = true }) => {
  return (
    <div
      style={{
        background: 'rgba(7, 30, 26, 0.4)',
        backdropFilter: 'blur(3px)',
        height: 118,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          color: '#fff',
          fontSize: 38,
          fontWeight: 600,
          fontFamily: FUENTE_SISTEMA,
          letterSpacing: 0.3,
          textShadow: '0 1px 5px rgba(0,0,0,0.55)',
        }}
      >
        {nombre}
      </div>
      {verificado && (
        <BadgeCheck
          size={30}
          color="#fff"
          fill={VERDE_VERIFICADO}
          strokeWidth={2}
          style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}
        />
      )}
    </div>
  );
};
