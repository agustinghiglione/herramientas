# Viernes Clipper

Sistema que arma clips verticales de streamers de GTA VI a partir de los clips más vistos del público en Kick,
los filtra con Gemini y los publica en TikTok (como borradores), Instagram y Facebook. Se maneja desde el
servidor de Discord "Viernes" y se conecta con el CRM de `herramientas_personales` (calendario y recordatorios).

## Cómo funciona

1. **Origen:** cada 20 minutos revisa los clips más vistos de la semana en Kick de los streamers de cada cuenta
   (`kickclips.py`). Solo toma clips de GTA VI con un mínimo de vistas.
2. **Preparación:** descarga el clip, lo transcribe con faster-whisper y descarta las frases en inglés, que suelen ser
   el audio del juego (`render.py`).
3. **Juez (Gemini, plan gratuito):** puntúa el humor de 1 a 10 y propone el gancho, el corte, el remate para el bucle,
   los hashtags, el juego que se ve y las escenas sensibles (`juez.py`). Una cuenta puede usar su propia clave.
4. **Render 9:16:** cámara del streamer arriba y juego abajo, subtítulos solo de la voz del streamer, gancho en bucle
   (arranca con el remate y termina en el mismo punto). En las escenas sensibles se ve la cámara a pantalla completa.
   Las malas palabras se censuran en los subtítulos ("P***") y las fuertes llevan pitido.
5. **Filtros que descartan el clip:** nota menor a 7, juego que no es GTA VI, o gracia que depende de contenido sexual.
6. **Aprobación:** si Gemini lo aprobó se publica solo; si Gemini falló, queda para aprobar a mano en Discord.
7. **Publicación (`publisher.py`):** TikTok en modo borrador (se publica desde el teléfono), Instagram Reels y
   Facebook Reels con la Graph API.
8. **Página de borradores (`web.py`):** `https://consultoraprisma.digital/borradores/?k=<clave>` muestra los borradores
   pendientes con el video, la descripción para copiar y el botón "Ya lo publiqué". Cuando una cuenta junta 4,
   avisa en #recordatorios.
9. **Holakase (`holakase.py`):** sábado por medio genera con Gemini el plan de 2 semanas de videos para Google Flow
   y lo carga en el calendario del CRM.

## Canales de Discord

| Canal | Para qué |
|---|---|
| `#clips-generados`, `#clips-generados-<cuenta>` | clips nuevos de cada cuenta, con botones para aprobar o descartar |
| `#clips-publicados` | links de lo que ya se subió a cada red |
| `#recordatorios` | resumen de las 8:00, avisos de la agenda y de borradores de TikTok |
| `#notas` | lo que escribas acá se agenda en el calendario del CRM |
| `#holakase-plan` | plan de contenido de Holakase |

## Instalación en el VPS

```bash
sudo useradd -r -m -d /opt/clipper clipper
sudo apt install ffmpeg python3-venv
python3 -m venv /opt/clipper/venv
/opt/clipper/venv/bin/pip install -r clipper/requirements.txt
cp -r clipper/app /opt/clipper/app
cp clipper/config.example.yaml /opt/clipper/config.yaml      # streamers, cuentas y ajustes
cp clipper/.env.example /opt/clipper/.env                    # token de Discord, claves, puente del CRM
sudo cp clipper/deploy/clipper.service /etc/systemd/system/
sudo cp clipper/deploy/clipper-gemini /usr/local/bin/
sudo systemctl enable --now clipper
```

Para la página de borradores, agregar `deploy/nginx-borradores.conf` dentro del `server {}` del dominio
y recargar nginx.

## Comandos

```bash
clipper-gemini [cuenta]          # guarda la clave de Gemini (sin cuenta = la general; ej. petclub, holakase)
clipper tiktok-login <cuenta>    # conecta una cuenta de TikTok (es, petclub, ...)
clipper meta-login <cuenta>      # conecta Instagram y Facebook
clipper holakase-plan            # genera ya el plan de Holakase
clipper check                    # quién está en vivo
systemctl restart clipper        # reiniciar
journalctl -u clipper -f         # ver el registro
```

## Lo que no se versiona

Claves y datos quedan solo en el servidor: `.env` (Discord, Gemini, puente del CRM), `data/secrets.json`
(tokens de TikTok y Meta), `data/clipper.db`, los videos y los modelos.
