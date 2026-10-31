const { leer } = require('./store');
const { sumarDias, diaSemana } = require('./fechas');

/** Todo lo de un rango de fechas: piezas, eventos y tareas (incluye las recurrentes del día). */
function agenda(desde, hasta) {
  const d = leer();
  const dias = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) dias.push(f);
  return dias.map((fecha) => ({
    fecha,
    contenidos: d.contenidos.filter((c) => c.fecha === fecha),
    eventos: d.eventos.filter((e) => e.fecha === fecha).sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99')),
    tareas: tareasDelDia(d, fecha),
  }));
}

function tareasDelDia(d, fecha) {
  const propias = d.tareas.filter((t) => t.fecha === fecha);
  const recurrentes = d.recurrentes
    .filter((r) => r.activo && Number(r.diaSemana) === diaSemana(fecha) && (!r.desde || fecha >= r.desde))
    .map((r) => {
      const clave = `rec:${r.id}:${fecha}`;
      const guardada = propias.find((t) => t.clave === clave);
      return guardada || { id: clave, clave, fecha, titulo: r.titulo, detalle: r.detalle, hora: r.hora, hecha: false, origen: 'recurrente' };
    });
  const resto = propias.filter((t) => !String(t.clave || '').startsWith('rec:'));
  return [...recurrentes, ...resto].sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99'));
}

module.exports = { agenda, tareasDelDia };
