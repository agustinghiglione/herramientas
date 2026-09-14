/**
 * Margen de seguridad extra contra el recorte/zoom que aplican las
 * plataformas (TikTok lo hace al procesar el video subido) — se sumó
 * después de notar, en el primer video subido de verdad, que la
 * plataforma recorta un poco los bordes.
 *
 * La idea: separar el TEXTO y los ÍCONOS un poco más del borde del
 * cuadro. El FONDO no se toca — sigue ocupando el 100% de los 1080x1920
 * en todos los componentes; el color de fondo entra hasta el borde igual
 * que antes, esto solo empuja el contenido hacia adentro.
 *
 * Si en la práctica el recorte real de TikTok es más chico o más grande
 * que esto, es cuestión de subir o bajar estos dos números acá y volver a
 * renderizar — no hace falta tocar cada componente por separado.
 */
export const MARGEN_SEGURO_H = 28; // px extra a cada lado (izquierda/derecha)
export const MARGEN_SEGURO_V = 34; // px extra (arriba, y abajo)
