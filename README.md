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

## Clientes Maps (`/crm.html#clientes`)

Prospección del estudio contable con negocios encontrados en Google Maps. **Los datos viven en Google Sheets**
(planilla `Clientes_Maps`, pestaña `Clientes`), a través de un Apps Script propio.

- **Importar Excel:** `.xlsx` o `.csv` con una fila por negocio (columna `nombre` o `negocio` obligatoria; el resto se reconoce
  por nombre: rubro, zona, teléfono, mail, web, instagram, presencia, prioridad, gancho…). Volver a importar actualiza, no duplica.
- **Ficha de cada cliente:** datos, seguimiento (web objeto, contacto, diagnóstico), informes y muestra web, mail.
- **Copiar ficha completa:** texto listo para pegar en el chat de informes. El chat devuelve los informes, las dos imágenes
  de la muestra (compu y celular) y un bloque `json` que se pega con **Pegar resultado del chat** para completar los campos.
- **Archivos:** imágenes (png/jpg/webp) e informes (html/pdf) quedan en `server/data/clientes/<id>/`. Al subir el primero se crea
  una página pública para el cliente, `/informe/<código>`, con la muestra, los informes y los botones al diagnóstico y a la agenda.
- **Mail:** se envía desde la casilla de Prisma con la Mail API de Hostinger, con las imágenes de la muestra dentro del mail
  y un botón al informe. **Armar borrador** propone un texto; siempre se revisa antes de enviar.
- **Respuestas:** cada `MAIL_REVISAR_MIN` minutos se revisa la bandeja. Si el cliente contestó, pasa a *Respondió* y la respuesta
  se clasifica (Interesado / No interesado / Revisar). Si es claramente de interés, se le contesta solo en el mismo hilo con el link
  de agenda (`AGENDA_URL`), una vez. Ante la duda no se manda nada: queda para revisar a mano.
- **WhatsApp:** para quien no tiene mail, el mismo texto se copia o se abre en WhatsApp.

### Puesta en marcha
1. Instalar `google-apps-script/clientes_maps.gs` en Apps Script (instrucciones en el encabezado del archivo).
2. Completar en `.env.local` las variables de la sección "Clientes Maps" de `.env.example`
   (`CLIENTES_SCRIPT_URL`, `CLIENTES_SCRIPT_CLAVE`, `MAIL_API_TOKEN`, `AGENDA_URL`, …).
3. `git pull` y reiniciar la app (no hay dependencias nuevas).
4. Hacer backup también de `server/data/clientes/` (imágenes e informes).

### Agenda de reuniones (`google-apps-script/agenda_prisma.gs`)
Corre en la cuenta consultoraprismadigital@gmail.com, dueña de la página de reservas de Google Calendar.
Cada 5 minutos: confirmación con la marca Prisma al cliente que reservó, recordatorios 24 h y 30 min antes,
cliente de la planilla a "Reunión agendada" y registro en la pestaña "Reuniones". Instalación en el encabezado del archivo.
El link de la página de reservas va en `AGENDA_URL` del `.env.local`.

## Viernes Clipper (`clipper/`)

Clips verticales de streamers de GTA VI (Kick) filtrados con Gemini y publicados en TikTok, Instagram y Facebook,
manejado desde Discord y conectado con este CRM por el puente (`server/crm/puente.js`). Ver `clipper/README.md`.
