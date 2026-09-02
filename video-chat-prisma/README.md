# video-chat-prisma

Motor en React/Remotion que genera videos verticales (9:16, para TikTok/Reels)
simulando una conversación real con ChatGPT, a partir de un "guion" en texto
plano. Se usa desde la web de herramientas (`herramientas_personales`), que
manda el guion y devuelve el mp4 renderizado — pero también se puede probar
acá directo con `npm start` (Remotion Studio, con reproducción en vivo) o
`npm run render` (genera `out/video.mp4`).

El guion activo vive en `public/guiones/actual.txt`. Para armar un video
nuevo, hay que escribir un guion nuevo con el formato de abajo y pegarlo ahí
(o mandarlo por la web de herramientas, que hace lo mismo).

## Instalar y usar

```
npm install
```

Para previsualizar mientras se edita el guion (abre Remotion Studio en el
navegador, se actualiza solo con cada guardado):

```
npm start
```

Para generar el archivo final:

```
npm run render
```

Escribe el video en `out/video.mp4`, en 1080x1920 (9:16), listo para subir.
La primera vez puede tardar unos minutos porque Remotion descarga Chromium
para renderizar — es un paso único.

## Formato del guion

Una acción por línea. Mayúsculas/minúsculas no importan. Las líneas vacías o
que empiezan con `#` se ignoran (sirven de comentario).

```
esperar (1.2s)
usuario escribe (2.4s): che, ¿qué uso para controlar los gastos del negocio sin volverme loco?
usuario envia
chat responde (3s): Depende de cuánto movimiento tengas, pero hay opciones simples.
captura
banner (4s): Hacé el Diagnóstico Prisma gratis y descubrí en qué área de tu negocio conviene empezar.
```

- **`esperar (Ns)`** — silencio con la pantalla de inicio de la app a la
  vista (con sus sugerencias tipo "Resumir mis pendientes"). Conviene
  ponerlo como primera línea del guion, así el video no arranca tipeando de
  golpe en el primer frame.
- **`usuario escribe (Ns): texto`** — el usuario tipea ese texto letra por
  letra durante N segundos, con el teclado visible.
- **`usuario envia`** — manda el mensaje (el teclado se esconde, suena el
  efecto de "mensaje enviado").
- **`captura`** — flash blanco breve, simula una captura de pantalla.
- **`banner (Ns): texto`** — pantalla de cierre fija con la marca de
  Consultora Prisma y ese texto de promoción, durante N segundos. Normalmente
  va al final del guion.

### Respuesta del chat — forma corta

Para una respuesta simple, de una sola oración, todo en una línea:

```
chat responde (3s): Buena pregunta — depende de qué tan grande sea tu negocio.
```

### Respuesta del chat — forma larga (párrafos, negrita y tablas)

Para respuestas más elaboradas, tipo las que arma ChatGPT de verdad (varios
párrafos, alguna palabra en negrita, y comparaciones en formato tabla), se
deja la línea de apertura con los dos puntos vacíos, y el contenido va en las
líneas siguientes hasta una línea que diga exactamente `---`:

```
chat responde (7s):
Depende de cuánto movimiento tengas, pero en general hay tres caminos que funcionan bien.

Para **la mayoría de los negocios chicos**, así los ordenaría hoy:

tabla:
📋 | Recién arrancás | Planilla simple | Rápida de armar y entendés cada peso que entra y sale. | Guía Prisma
📱 | Ya tenés movimiento diario | App de gestión | Categoriza gastos solo y te avisa si algo se te va de rango. | Guía Prisma
🧾 | Impuestos y balances | Tu contador | Nadie reemplaza el criterio profesional a la hora de presentar todo. | Guía Prisma
fin tabla
---
```

Reglas de este bloque:

- Una línea en blanco separa párrafos.
- `**texto**` se muestra en negrita dentro de un párrafo.
- Un bloque `tabla:` ... `fin tabla` arma una tarjeta por cada línea, con 5
  campos separados por `|`: **ícono** (un emoji), **etiqueta** (texto chico
  arriba, ej. "Recién arrancás"), **herramienta** (sale en negrita grande),
  **por qué** (el texto explicativo), y **fuente** (opcional — si se pone,
  aparece como un chip abajo tipo cita; si se omite ese quinto campo, la
  tarjeta no lleva chip de fuente).
- La respuesta se revela en cámara — primero unos puntitos de "está
  escribiendo…", después el texto palabra por palabra, y las tablas fila por
  fila — todo dentro de los N segundos que se le dieron a ese `chat responde`.
  Si el contenido es mucho para esos segundos, va a revelarse rápido; convine
  dejar tiempo de sobra en respuestas con tabla (6-8s suele andar bien para
  un párrafo corto + 3 filas).
- Se pueden mezclar ambas formas en el mismo guion: alguna respuesta corta de
  una línea, y otras en bloque largo con tabla.

## Plantillas

Hoy solo existe la composición `ChatVideo` (`src/Root.tsx`), estilo ChatGPT.
Para sumar una plantilla nueva: registrar una `Composition` nueva ahí, y
agregarla al mapa `PLANTILLAS` en
`herramientas_personales/server/videoRender.js` (en el repo combinado
`herramientas`) para que aparezca como opción en la web.

## Audio

Los efectos (`public/audio/`) suenan automáticamente en los momentos que
corresponden — tipeo durante `usuario escribe`, "mensaje enviado" tanto en
`usuario envia` como al arrancar cada `chat responde`, y el flash de
`captura`. No hace falta declararlos en el guion.
