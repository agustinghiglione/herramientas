/** Fechas en hora de Argentina, como texto AAAA-MM-DD (sin depender de la zona del servidor). */
const ZONA = 'America/Argentina/Buenos_Aires';

function hoyISO(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function horaAR(d = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

function sumarDias(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 1 = lunes … 7 = domingo */
function diaSemana(iso) {
  const g = new Date(iso + 'T12:00:00Z').getUTCDay();
  return g === 0 ? 7 : g;
}

function lunesDe(iso) {
  return sumarDias(iso, 1 - diaSemana(iso));
}

/** Acepta 2026-11-02, 2/11/2026 o un Date de Excel. */
function normalizar(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

const NOMBRES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

module.exports = { ZONA, hoyISO, horaAR, sumarDias, diaSemana, lunesDe, normalizar, NOMBRES };
