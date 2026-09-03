import React from 'react';
import { Composition, staticFile } from 'remotion';
import { ChatVideo } from './ChatVideo';
import { parsearGuion } from './guion';

const FPS = 30;
const ANCHO = 1080;
const ALTO = 1920; // 9:16, formato TikTok

/**
 * El guion activo vive en public/guiones/actual.txt. Para cambiar el
 * contenido del video, editá ese archivo (o reemplazalo por otro guion con
 * el mismo formato) y volvé a correr "npm start" o "npm run render" — no
 * hace falta tocar nada de este archivo.
 *
 * calculateMetadata corre en Node antes de renderizar/previsualizar, así que
 * puede leer el guion real y calcular la duración exacta del video en vez de
 * dejarla fija a mano.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ChatVideo"
      component={ChatVideo}
      fps={FPS}
      width={ANCHO}
      height={ALTO}
      durationInFrames={300}
      defaultProps={{ guionTexto: '', bannerImagenDisponible: false }}
      calculateMetadata={async () => {
        const res = await fetch(staticFile('guiones/actual.txt'));
        const guionTexto = await res.text();
        const { duracionTotal } = parsearGuion(guionTexto, FPS);
        // El banner final ahora es una imagen ya diseñada (ver
        // public/banners/actual.png) — se chequea acá, en Node, si existe
        // antes de renderizar. Si todavía no se subió ninguna, ChatVideo usa
        // el banner de texto programático como respaldo, para no romper el
        // render mientras el banner definitivo se sigue trabajando aparte.
        const resBanner = await fetch(staticFile('banners/actual.png'));
        return {
          durationInFrames: duracionTotal,
          props: { guionTexto, bannerImagenDisponible: resBanner.ok },
        };
      }}
    />
  );
};
