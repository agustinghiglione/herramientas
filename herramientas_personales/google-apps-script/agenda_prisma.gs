/**
 * Agenda de reuniones de Consultora Prisma.
 *
 * Corre en la cuenta consultoraprismadigital@gmail.com (la dueña de la página de
 * reservas de Google Calendar). Cada 5 minutos revisa las reservas nuevas y:
 *   1. le manda al cliente una confirmación con la marca Prisma,
 *   2. le manda un recordatorio 24 horas antes y otro 30 minutos antes,
 *   3. si el mail del cliente está en la planilla Clientes_Maps, lo pasa a "Reunión agendada",
 *   4. anota cada reserva en la pestaña "Reuniones" de esa misma planilla.
 * Si el cliente reprograma, se manda una confirmación nueva y los recordatorios se reinician.
 * Los mails salen de esta cuenta de Gmail con el nombre "Consultora Prisma" y, si el cliente
 * responde, la respuesta va a contacto@consultoraprisma.digital.
 *
 * Cómo instalarlo (una sola vez), con la sesión de consultoraprismadigital@gmail.com:
 * 1. Compartí la planilla Clientes_Maps con consultoraprismadigital@gmail.com como Editor
 *    (si la planilla es de otra cuenta).
 * 2. Entrá a https://script.google.com/home → "Proyecto nuevo" → pegá este archivo en Code.gs.
 * 3. Configuración del proyecto (engranaje) → Zona horaria: "(GMT-03:00) Buenos Aires".
 * 4. Revisá la CONFIGURACIÓN de abajo; TITULO_RESERVA tiene que ser igual al título de la
 *    página de reservas de Google Calendar.
 * 5. Elegí la función "instalar" en el menú de arriba y tocá Ejecutar. Autorizá los permisos
 *    ("Configuración avanzada" → "Ir a … (no seguro)": es tu propio script).
 * 6. Para probar sin esperar: hacé una reserva de prueba con otro mail y ejecutá "revisarAgenda".
 * Para apagarlo: ejecutá "desinstalar".
 */

// ================= CONFIGURACIÓN =================
var CONFIG = {
  TITULO_RESERVA: 'Reunión con Consultora Prisma', // título de la página de reservas
  ID_PLANILLA: '1C9R8Z4jOQhcJdhuoZg_oBsPMG5VZT_KDg8i7MJ27zgk', // Clientes_Maps
  HOJA_CLIENTES: 'Clientes',
  HOJA_REUNIONES: 'Reuniones',
  RESPONDER_A: 'contacto@consultoraprisma.digital',
  NOMBRE: 'Consultora Prisma',
  WEB: 'https://consultoraprisma.digital',
  ZONA: 'America/Argentina/Buenos_Aires',
  DIAS_A_REVISAR: 21, // reservas a futuro que mira el script
};

// ================= instalación =================
function instalar() {
  desinstalar();
  ScriptApp.newTrigger('revisarAgenda').timeBased().everyMinutes(5).create();
  revisarAgenda();
  Logger.log('Listo: la agenda se revisa cada 5 minutos.');
}

function desinstalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'revisarAgenda') ScriptApp.deleteTrigger(t);
  });
}

// ================= revisión =================
function revisarAgenda() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    var ahora = new Date();
    var hasta = new Date(ahora.getTime() + CONFIG.DIAS_A_REVISAR * 86400000);
    var props = PropertiesService.getScriptProperties();
    var yo = Session.getEffectiveUser().getEmail().toLowerCase();
    var eventos = CalendarApp.getDefaultCalendar().getEvents(ahora, hasta);

    eventos.forEach(function (ev) {
      if (ev.getTitle().indexOf(CONFIG.TITULO_RESERVA) !== 0) return;
      var invitado = ev.getGuestList().filter(function (g) {
        return g.getEmail().toLowerCase() !== yo && g.getGuestStatus() !== CalendarApp.GuestStatus.NO;
      })[0];
      if (!invitado) return;

      var clave = 'ev_' + ev.getId();
      var estado = JSON.parse(props.getProperty(clave) || '{}');
      var inicio = ev.getStartTime();
      var datos = {
        email: invitado.getEmail(),
        nombre: invitado.getName() || nombreDelTitulo_(ev.getTitle()),
        inicio: inicio,
        meet: linkMeet_(ev),
      };

      // Reprogramada: se confirma de nuevo y se reinician los recordatorios.
      if (estado.inicio && estado.inicio !== inicio.toISOString()) estado = { reprogramada: true };

      var faltan = (inicio.getTime() - ahora.getTime()) / 60000; // minutos hasta la reunión
      if (!estado.confirmado) {
        enviar_(datos, estado.reprogramada ? 'reprogramada' : 'confirmacion');
        estado.confirmado = true;
        estado.inicio = inicio.toISOString();
        // El recordatorio de 24 h solo tiene sentido si se reservó con más de un día de anticipación.
        estado.masDe24h = faltan > 24 * 60;
        marcarEnPlanilla_(datos, estado.reprogramada ? 'Reprogramada' : 'Reservada');
      }
      // 24 h antes
      if (!estado.r24 && faltan <= 24 * 60) {
        if (estado.masDe24h && faltan > 60) enviar_(datos, 'recordatorio24');
        estado.r24 = true;
      }
      // 30 min antes
      if (!estado.r30 && faltan <= 30 && faltan > 0) {
        enviar_(datos, 'recordatorio30');
        estado.r30 = true;
      }
      props.setProperty(clave, JSON.stringify(estado));
    });
    limpiarViejas_(props, ahora);
  } finally {
    lock.releaseLock();
  }
}

// ================= mails =================
function enviar_(d, tipo) {
  var cuando = Utilities.formatDate(d.inicio, CONFIG.ZONA, "EEEE d 'de' MMMM 'a las' HH:mm");
  cuando = traducir_(cuando);
  var hola = d.nombre ? 'Hola, ' + d.nombre.split(' ')[0] + ':' : 'Hola:';
  var meet = d.meet ? '<p style="margin:0 0 14px">Link de la videollamada: <a href="' + d.meet + '" style="color:#345b78">' + d.meet + '</a></p>'
    : '<p style="margin:0 0 14px">El link de la videollamada está en la invitación de Google Calendar que te llegó.</p>';
  var textos = {
    confirmacion: {
      asunto: 'Reunión confirmada · ' + cuando,
      cuerpo: '<p style="margin:0 0 14px">' + hola + '</p><p style="margin:0 0 14px">Confirmamos tu reunión con Consultora Prisma el <b>' + cuando + '</b> (hora de Argentina). Dura 30 minutos.</p>' + meet +
        '<p style="margin:0 0 14px">Antes de la reunión vamos a repasar tu caso para llegar con ideas concretas. Si querés sumar algo que te preocupe del negocio, respondé este mail.</p>' +
        '<p style="margin:0 0 14px">Si necesitás cambiar el horario, usá el link de la invitación o respondé este mail.</p>',
    },
    reprogramada: {
      asunto: 'Reunión reprogramada · ' + cuando,
      cuerpo: '<p style="margin:0 0 14px">' + hola + '</p><p style="margin:0 0 14px">Listo, tu reunión con Consultora Prisma quedó para el <b>' + cuando + '</b> (hora de Argentina).</p>' + meet,
    },
    recordatorio24: {
      asunto: 'Mañana nos vemos · ' + cuando,
      cuerpo: '<p style="margin:0 0 14px">' + hola + '</p><p style="margin:0 0 14px">Te recordamos que mañana, <b>' + cuando + '</b>, tenemos la reunión de 30 minutos.</p>' + meet,
    },
    recordatorio30: {
      asunto: 'En 30 minutos empezamos',
      cuerpo: '<p style="margin:0 0 14px">' + hola + '</p><p style="margin:0 0 14px">En 30 minutos empieza nuestra reunión (' + cuando + ').</p>' + meet,
    },
  };
  var t = textos[tipo];
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#223c54;font-size:15px;line-height:1.55;max-width:560px">' +
    '<p style="margin:0 0 18px;font-size:12px;letter-spacing:.14em;color:#345b78">CONSULTORA PRISMA</p>' + t.cuerpo +
    '<p style="margin:18px 0 0;color:#5b6672;font-size:14px">El equipo de Consultora Prisma<br><a href="' + CONFIG.WEB + '" style="color:#5b6672">www.consultoraprisma.digital</a></p></div>';
  MailApp.sendEmail({ to: d.email, subject: t.asunto, htmlBody: html, name: CONFIG.NOMBRE, replyTo: CONFIG.RESPONDER_A });
}

function traducir_(s) {
  var dias = { Monday: 'lunes', Tuesday: 'martes', Wednesday: 'miércoles', Thursday: 'jueves', Friday: 'viernes', Saturday: 'sábado', Sunday: 'domingo' };
  var meses = { January: 'enero', February: 'febrero', March: 'marzo', April: 'abril', May: 'mayo', June: 'junio', July: 'julio', August: 'agosto', September: 'septiembre', October: 'octubre', November: 'noviembre', December: 'diciembre' };
  Object.keys(dias).forEach(function (k) { s = s.replace(k, dias[k]); });
  Object.keys(meses).forEach(function (k) { s = s.replace(k, meses[k]); });
  return s;
}

function nombreDelTitulo_(titulo) {
  var m = titulo.match(/\(([^)]+)\)\s*$/);
  return m ? m[1] : '';
}

/** Link de Meet: solo si está activado el servicio avanzado "Google Calendar API"; si no, se avisa que está en la invitación. */
function linkMeet_(ev) {
  try {
    var id = ev.getId().replace('@google.com', '');
    var e = Calendar.Events.get('primary', id);
    return e.hangoutLink || '';
  } catch (x) {
    return '';
  }
}

// ================= planilla =================
function marcarEnPlanilla_(d, tipo) {
  try {
    var libro = SpreadsheetApp.openById(CONFIG.ID_PLANILLA);
    var cuando = Utilities.formatDate(d.inicio, CONFIG.ZONA, 'dd/MM/yyyy HH:mm');
    var hoy = Utilities.formatDate(new Date(), CONFIG.ZONA, 'yyyy-MM-dd');

    // Registro de todas las reservas
    var reu = libro.getSheetByName(CONFIG.HOJA_REUNIONES) || libro.insertSheet(CONFIG.HOJA_REUNIONES);
    if (reu.getLastRow() === 0) reu.appendRow(['Registrada', 'Reunión', 'Nombre', 'Email', 'Movimiento', 'Cliente de Maps']).setFontWeight('bold');

    // Cliente de Maps con ese mail → Reunión agendada
    var hoja = libro.getSheetByName(CONFIG.HOJA_CLIENTES);
    var encontrado = '';
    if (hoja && hoja.getLastRow() > 1) {
      var cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
      var col = function (n) { return cab.indexOf(n) + 1; };
      var filas = hoja.getRange(2, 1, hoja.getLastRow() - 1, cab.length).getDisplayValues();
      for (var i = 0; i < filas.length; i++) {
        if (String(filas[i][col('email') - 1]).trim().toLowerCase() === d.email.toLowerCase()) {
          var fila = i + 2;
          var poner = { estadoContacto: 'Reunión agendada', proximoPaso: 'Reunión el ' + cuando + ' (preparar el caso antes)', ultimoContacto: hoy, actualizadoEn: new Date().toISOString() };
          Object.keys(poner).forEach(function (k) { if (col(k) > 0) hoja.getRange(fila, col(k)).setNumberFormat('@').setValue(poner[k]); });
          encontrado = filas[i][col('nombre') - 1];
          break;
        }
      }
    }
    reu.appendRow([hoy, cuando, d.nombre, d.email, tipo, encontrado || '—']);
  } catch (err) {
    Logger.log('No pude actualizar la planilla: ' + err);
  }
}

function limpiarViejas_(props, ahora) {
  var todas = props.getProperties();
  Object.keys(todas).forEach(function (k) {
    if (k.indexOf('ev_') !== 0) return;
    try {
      var e = JSON.parse(todas[k]);
      if (e.inicio && new Date(e.inicio).getTime() < ahora.getTime() - 2 * 86400000) props.deleteProperty(k);
    } catch (x) { props.deleteProperty(k); }
  });
}
