# herramientas

Repositorio de las herramientas personales de Consultora Prisma.

- `herramientas_personales/` — sitio web (Node/Express) en herramientas.consultoraprisma.digital.
  La raíz abre **Mi panel** (`/crm.html`, CRM personal). También está **Análisis de datos**
  (`/analisis.html`), conectado a la planilla de Prisma.

El generador de videos de chat y la limpieza de documentos se quitaron el 31/10/2026
(siguen en el historial de git si alguna vez hacen falta).

## CRM personal (`herramientas_personales` → /crm.html)

Panel personal (página de inicio de Herramientas), con la misma contraseña (`ADMIN_PASSWORD`):

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
