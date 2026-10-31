# herramientas

Repositorio de las herramientas personales de Consultora Prisma. Cada
subcarpeta es un proyecto independiente con su propio package.json:

- `herramientas_personales/` — sitio web con herramientas (Node/Express).
  Primera herramienta: limpieza de documentos con IA.
- `video-chat-prisma/` — motor en React/Remotion para generar videos de
  TikTok que simulan una conversación de chat.

## CRM personal (`herramientas_personales` → /crm.html)

Panel personal dentro de Herramientas, con la misma contraseña (`ADMIN_PASSWORD`):

- **Hoy:** objetivos del día con checklist, piezas para publicar con todos los detalles (descripción, hashtags, stickers, link UTM y pedido para la IA, con botón de copiar), agenda personal y próximos días.
- **Semana / Mes:** calendario con el plan de Instagram, eventos personales y objetivos.
- **Subir plan:** se arrastra el Excel que arma la tarea programada de los sábados (`Prisma_calendario_instagram.xlsx`, pestaña `Esta_semana`). Carga las 7 piezas y crea solos los objetivos: publicar cada pieza, producir los reels en Flow el día anterior, crear las imágenes con IA el domingo y pasar al contador lo impositivo. Subir el mismo Excel dos veces no duplica nada.
- **Recordatorios:** se repiten cada semana (ya vienen cargados los del sábado a la mañana) y, si se configura SMTP, llega un resumen diario por mail.

Datos: `server/data/crm.json` (no se versiona; conviene hacerle backup).

### Puesta en marcha en el VPS
```bash
git pull
cd herramientas_personales
npm install            # suma exceljs y nodemailer
# opcional, para el mail diario: completar SMTP_* y CRM_MAIL_TO en .env.local (ver .env.example)
# reiniciar la app como la tengas corriendo (pm2 restart …, systemctl restart …, etc.)
```
