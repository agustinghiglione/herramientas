import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile } from 'remotion';

/**
 * Pantalla de cierre — banner #1 del futuro "menú de banners".
 *
 * Foto real de fondo (public/img/foto_main.png) con un degradé de marca
 * encima para que el texto se lea bien sin taparla del todo, el wordmark de
 * Consultora Prisma arriba, la frase de marca "La claridad transforma
 * decisiones" como titular, y debajo el texto puntual que trae el guion
 * (la línea de "banner (Ns): texto") más el dominio siempre visible.
 *
 * Nota de diseño: en vez de pegar el ícono real de public/img/favicon.png
 * (una ilustración fotorrealista de un prisma con fondo gris, se ve como un
 * sticker pegado arriba de una foto) se dibujó un ícono geométrico propio,
 * plano y en dorado — más consistente con el resto de la identidad. Si en
 * algún momento hay un isotipo vectorial real de Prisma, es cuestión de
 * reemplazar <PrismaIcon /> por ese archivo.
 */
export const BannerFinal: React.FC<{ texto: string; progreso: number }> = ({ texto, progreso }) => {
  const entrada = interpolate(progreso, [0, 0.15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const subeTexto = interpolate(progreso, [0, 0.2], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ opacity: entrada }}>
      <AbsoluteFill>
        <Img
          src={staticFile('img/foto_main.png')}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '77% 50%' }}
        />
      </AbsoluteFill>

      {/* Degradé de marca: oscurece arriba (para el wordmark) y abajo (para
          el titular/CTA/dominio), deja respirar la foto en el medio. */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(34,60,84,0.62) 0%, rgba(34,60,84,0.12) 30%, rgba(34,60,84,0.18) 55%, rgba(34,60,84,0.72) 78%, rgba(34,60,84,0.94) 100%)',
        }}
      />

      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '96px 80px 88px',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <PrismaIcon size={34} />
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 34, color: '#faf8f5', letterSpacing: 2 }}>
            <span style={{ fontWeight: 500 }}>CONSULTORA</span> <span style={{ fontWeight: 800 }}>PRISMA</span>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div
          style={{
            transform: `translateY(${subeTexto}px)`,
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: 58,
            lineHeight: 1.18,
            color: '#faf8f5',
            marginBottom: 34,
            maxWidth: 780,
          }}
        >
          La claridad transforma decisiones
        </div>

        <div
          style={{
            width: 90,
            height: 4,
            background: '#e4b15e',
            borderRadius: 2,
            marginBottom: 34,
          }}
        />

        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 32,
            fontWeight: 500,
            lineHeight: 1.5,
            color: '#faf8f5',
            marginBottom: 30,
            maxWidth: 760,
          }}
        >
          {texto}
        </div>

        <div
          style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: 1.5,
            color: '#e4b15e',
          }}
        >
          CONSULTORAPRISMA.DIGITAL
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Ícono geométrico simple del prisma — trazo plano en dorado. */
function PrismaIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3L21 19H3L12 3Z" stroke="#e4b15e" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 3V19" stroke="#e4b15e" strokeWidth="1.2" opacity="0.7" />
    </svg>
  );
}
