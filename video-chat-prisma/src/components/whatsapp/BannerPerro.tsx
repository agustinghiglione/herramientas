import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile } from 'remotion';

/**
 * Banner de cierre de este anuncio — mismo esqueleto visual que BannerFinal
 * (foto real + degradé de marca + wordmark + titular + CTA + dominio), pero
 * con foto del perro y texto propios de este producto, no de Consultora
 * Prisma. Todo lo que dice "TODO" abajo son placeholders a reemplazar por
 * Damian antes de publicar (nombre del producto, link, etc.) — la imagen de
 * fondo (public/img/foto_perro_banner.png) es un frame real sacado de
 * parte1.mp4, no una foto de stock.
 */
export const BannerPerro: React.FC<{ progreso: number }> = ({ progreso }) => {
  const entrada = interpolate(progreso, [0, 0.15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const subeTexto = interpolate(progreso, [0, 0.2], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ opacity: entrada }}>
      <AbsoluteFill>
        <Img
          src={staticFile('img/foto_perro_banner.png')}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '58% 40%' }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(7,30,26,0.60) 0%, rgba(7,30,26,0.08) 32%, rgba(7,30,26,0.15) 55%, rgba(7,30,26,0.75) 80%, rgba(7,30,26,0.95) 100%)',
        }}
      />

      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '96px 80px 88px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 40 }}>🐾</span>
          {/* TODO(Damian): nombre de marca/tienda del producto */}
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 34, color: '#faf8f5', letterSpacing: 2, fontWeight: 700 }}>
            [NOMBRE DE LA MARCA]
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* TODO(Damian): titular / nombre del juguete */}
        <div style={{ transform: `translateY(${subeTexto}px)`, fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 58, lineHeight: 1.18, color: '#faf8f5', marginBottom: 34, maxWidth: 780 }}>
          El juguete que tu perro ya está pidiendo
        </div>

        <div style={{ width: 90, height: 4, background: '#00A884', borderRadius: 2, marginBottom: 34 }} />

        {/* TODO(Damian): bajada / precio / promo */}
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 32, fontWeight: 500, lineHeight: 1.5, color: '#faf8f5', marginBottom: 30, maxWidth: 760 }}>
          [Bajada corta: precio, promo o llamado a la acción]
        </div>

        {/* TODO(Damian): link o @handle real */}
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 26, fontWeight: 600, letterSpacing: 1.5, color: '#00A884' }}>
          [TULINK.COM]
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
