# video-chat-prisma

Motor en React (Remotion) para generar videos verticales (9:16, listos para
TikTok) que simulan una conversación real con ChatGPT: se ve al usuario
escribir con el teclado, enviar el mensaje, el teclado se minimiza, el chat
responde, se simula una captura de pantalla y cierra con un banner fijo de
Consultora Prisma.

Todo el diseño (React) ya está hecho. Lo único que hace falta para generar
un video nuevo es escribir un guion de texto plano — nada de código.

## Instalar (una sola vez)

```
npm install
```

## Previsualizar mientras se edita el guion

```
npm start
```

Abre Remotion Studio en el navegador: un reproductor donde se ve el video
completo, se puede mover el cursor frame a frame, y cada vez que se guarda
un cambio en el guion se actualiza solo.

## Generar el archivo .mp4 final

```
npm run render
```

Escribe el video en `out/video.mp4`, en 1080x1920 (9:16), listo para subir.
La primera vez que se corre puede tardar unos minutos porque Remotion
descarga una versión de Chromium para renderizar — es un paso único.

## Cómo escribir un guion

El guion que se usa hoy está en `public/guiones/actual.txt`. Para hacer un
video distinto, reemplazá el contenido de ese archivo por un guion nuevo con
el mismo formato y volvé a correr `npm start` o `npm run render`.

Una acción por línea. Los tiempos van en segundos:

```
usuario escribe (2s): acá va exactamente lo que el usuario tipea
usuario envia
chat responde (3s): acá va lo que "dice" el chat, se revela de a palabras
chat responde (2s): se puede encadenar más de una respuesta seguida
captura
banner (4s): el texto de cierre — la promoción directa a la consultora
```

- `usuario escribe (Ns): texto` — se ve el teclado virtual subir, el texto
  aparece letra por letra durante N segundos, con el sonido de tipeo real.
- `usuario envia` — el mensaje pasa a la conversación (burbuja a la derecha),
  el teclado se minimiza, suena el "mensaje enviado".
- `chat responde (Ns): texto` — la respuesta se revela de a palabras durante
  N segundos, con el ícono de ChatGPT a la izquierda.
- `captura` — destello blanco + sonido de captura de pantalla (dura ~1.8s,
  no hace falta poner tiempo).
- `banner (Ns): texto` — pantalla final fija con la marca de Consultora
  Prisma, el texto que se le pase, y el dominio `consultoraprisma.digital`
  siempre visible al pie. Dura N segundos y cierra el video.
- Líneas vacías o que empiezan con `#` se ignoran (sirven como comentarios).

El texto del banner es libre — conviene que cada video cierre con la
situación puntual que resolvió la conversación (ej: "¿No sabés si tu negocio
es rentable? Hacé el Diagnóstico Prisma gratis."), siguiendo el mismo
criterio que el plan de contenido de TikTok: un dolor concreto → cómo Prisma
ayuda ahí → el dominio.

## Los 3 clips cortos (el plan de "3-4 segundos por plataforma")

Este motor genera UN video completo de punta a punta. Si en cambio se quiere
seguir el enfoque de generar 3-4 clips cortos en distintas plataformas de IA
y pegarlos, este mismo guion sirve igual de base: cada bloque (escribe /
responde / captura / banner) se puede recortar como una escena separada para
pedirle a otra herramienta que la genere, manteniendo el mismo guion como
única fuente de verdad del texto y los tiempos.

## Próximo paso: conectarlo a la página de herramientas

Hoy este proyecto se usa desde la terminal (`npm start` / `npm run render`).
Cuando el motor esté afinado, el siguiente paso es envolverlo en una ruta
del servidor de `herramientas_personales` (subir un guion desde el
navegador → el servidor corre `remotion render` → devuelve el .mp4), igual
que se pensó para las otras herramientas de esa página.

## Los audios

Los tres efectos están en `public/audio/` (los subiste vos): tipeo de
teclado, mensaje enviado y captura de pantalla. El motor los recorta y
sincroniza solo según los tiempos del guion — no hace falta tocarlos.
