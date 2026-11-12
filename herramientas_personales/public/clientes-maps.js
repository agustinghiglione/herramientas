// ================= Clientes Maps (prospección del estudio contable) =================
// Los datos viven en la planilla Clientes_Maps de Google Sheets (vía Apps Script).
// Usa api(), modal(), cerrar(), toast(), copiar(), esc() y $() de crm.html.

const CM_CSS = `
.cm-estado{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:12.5px;color:var(--ink-faint);margin:-8px 0 16px}
.cm-estado b{font-weight:600}.cm-estado .ok{color:var(--ok)}.cm-estado .no{color:var(--gold)}.cm-estado .mal{color:var(--error)}
.cm-embudo{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:10px;margin-bottom:16px}
.cm-embudo button{background:var(--card);border:1px solid var(--border-soft);border-radius:14px;padding:12px 14px;text-align:left}
.cm-embudo button.on{border-color:var(--primary);box-shadow:0 0 0 1px var(--primary) inset}
.cm-embudo .n{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums}.cm-embudo .l{font-size:12px;color:var(--ink-faint)}
.cm-filtros{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center}
.cm-filtros input,.cm-filtros select{width:auto;flex:0 1 180px}.cm-filtros input{flex:1 1 220px}
.cm-filtros .cuenta{margin-left:auto;color:var(--ink-faint);font-size:12.5px}
.cm-tabla{width:100%;border-collapse:collapse;font-size:13px}
.cm-tabla th{text-align:left;color:var(--ink-faint);font-weight:500;font-size:12px;padding:8px}
.cm-tabla td{padding:10px 8px;border-top:1px solid var(--border-soft);vertical-align:middle}
.cm-tabla tr.cm-fila{cursor:pointer}.cm-tabla tr.cm-fila:hover td{background:var(--card-2)}
.cm-tabla .nom{font-weight:600}.cm-tabla .sub{color:var(--ink-faint);font-size:12px}
.cm-envoltura{overflow-x:auto}
.pill{display:inline-block;font-size:11.5px;font-weight:600;padding:3px 8px;border-radius:999px;white-space:nowrap;background:var(--card-2);color:var(--ink-soft)}
.pill.web{color:var(--primary);background:var(--primary-glow)}.pill.redes{color:var(--gold);background:color-mix(in srgb,var(--gold) 14%,transparent)}.pill.sin{color:var(--error);background:color-mix(in srgb,var(--error) 14%,transparent)}
.pill.interesado{color:var(--ok);background:color-mix(in srgb,var(--ok) 14%,transparent)}.pill.no_interesado{color:var(--error);background:color-mix(in srgb,var(--error) 14%,transparent)}.pill.revisar{color:var(--gold);background:color-mix(in srgb,var(--gold) 14%,transparent)}
.prio::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:var(--ink-faint)}
.prio.Alta::before{background:var(--error)}.prio.Media::before{background:var(--gold)}
.cm-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px}.cm-grid .campo{margin-bottom:8px}.cm-grid .ancho{grid-column:1/-1}
.cm-arch{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.cm-arch .a{border:1px solid var(--border-soft);border-radius:12px;padding:10px;background:var(--bg-soft);display:flex;flex-direction:column;gap:8px}
.cm-arch .a b{font-size:12.5px}.cm-arch img{width:100%;max-height:130px;object-fit:cover;object-position:top;border-radius:8px;border:1px solid var(--border)}
.cm-arch .vacio{padding:0}.cm-arch .acc{display:flex;gap:6px;flex-wrap:wrap}
.cm-resp{background:var(--bg-soft);border:1px solid var(--border-soft);border-radius:12px;padding:12px;white-space:pre-wrap;line-height:1.5;font-size:13.5px;max-height:220px;overflow:auto}
.cm-aviso{border:1px solid var(--gold);color:var(--gold);border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.5;margin-bottom:16px}
.cm-aviso.mal{border-color:var(--error);color:var(--error)}
.cm-pegar{display:none;margin-top:10px}.cm-pegar.on{display:block}
@media (max-width:760px){.cm-grid{grid-template-columns:1fr}.cm-tabla .ocultable{display:none}}
`;
(function () { const s = document.createElement('style'); s.textContent = CM_CSS; document.head.appendChild(s); })();

const CM = { datos: null, f: { q: '', zona: '', rubro: '', pres: '', contacto: '' } };
const CM_CLASES = { interesado: 'Interesado', no_interesado: 'No interesado', revisar: 'Revisar', automatica: 'Respuesta automática' };
const cmPres = (p) => (p === 'Web propia' ? 'web' : p === 'Solo redes' ? 'redes' : 'sin');
const cmArchivoUrl = (id, nombre) => `/api/crm/clientes/${encodeURIComponent(id)}/archivos/${encodeURIComponent(nombre)}?token=${encodeURIComponent(token())}&v=${Date.now()}`;
const cmLinkPublico = (c) => (c.codigoPublico ? `${location.origin}/informe/${c.codigoPublico}` : '');

async function cmCargar(forzar) {
  CM.datos = await api('/clientes' + (forzar ? '?forzar=1' : ''));
  return CM.datos;
}

function cmFiltrados() {
  const { q, zona, rubro, pres, contacto } = CM.f, t = q.toLowerCase();
  const orden = { Alta: 0, Media: 1, Baja: 2 };
  return CM.datos.clientes.filter((c) => (!zona || c.zona === zona) && (!rubro || c.rubro === rubro) && (!pres || c.presencia === pres)
    && (!contacto || (c.estadoContacto || 'Sin contactar') === contacto)
    && (!t || [c.nombre, c.rubro, c.zona, c.notas, c.email].join(' ').toLowerCase().includes(t)))
    .sort((a, b) => (orden[a.prioridad] ?? 3) - (orden[b.prioridad] ?? 3) || a.nombre.localeCompare(b.nombre));
}

async function vistaClientes(main, forzar) {
  if (!CM.datos || forzar) {
    main.innerHTML = '<div class="card vacio">Cargando clientes desde la planilla…</div>';
    try { await cmCargar(forzar); }
    catch (e) {
      main.innerHTML = `<div class="barra"><div><h1>Clientes Maps</h1></div></div><div class="cm-aviso mal">${esc(e.message)}</div>`;
      return;
    }
  }
  const d = CM.datos, est = d.estado, o = d.opciones;
  const rubros = [...new Set(d.clientes.map((c) => c.rubro).filter(Boolean))].sort();
  const zonas = [...new Set(d.clientes.map((c) => c.zona).filter(Boolean))].sort();
  const lista = cmFiltrados();
  const sel = (id, todos, arr, v) => `<select id="${id}"><option value="">${todos}</option>${arr.map((x) => `<option${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>`;

  main.innerHTML = `
  <div class="barra"><div><h1>Clientes Maps</h1><div class="sub">Prospectos para el estudio contable · la base vive en Google Sheets</div></div><div class="espacio"></div>
    <label class="btn" style="cursor:pointer">Importar Excel<input type="file" id="cm-importar" accept=".xlsx,.csv" hidden></label>
    <button class="btn" id="cm-exportar">Descargar Excel</button>
    <button class="btn" id="cm-revisar">Revisar respuestas</button>
    <button class="btn" id="cm-recargar" title="Volver a leer la planilla">Actualizar</button>
    <button class="btn primario" id="cm-nuevo">+ Cliente</button></div>
  <div class="cm-estado">
    <span>Planilla: ${d.origen === 'planilla' ? '<b class="ok">conectada</b>' : `<b class="mal">sin respuesta, mostrando el respaldo del ${esc(new Date(d.respaldoDe).toLocaleString('es-AR'))}</b>`}</span>
    <span>Mail: ${est.mail ? `<b class="ok">${esc(est.remitente)}</b>` : '<b class="no">falta MAIL_API_TOKEN</b>'}</span>
    <span>Agenda automática: ${est.autoAgenda ? '<b class="ok">activada</b>' : `<b class="no">${est.agendaUrl ? 'desactivada' : 'falta AGENDA_URL'}</b>`}</span>
    <span>Última revisión de respuestas: ${est.ultimaRevision ? esc(new Date(est.ultimaRevision).toLocaleString('es-AR')) : 'todavía ninguna'}</span>
  </div>
  ${d.origen !== 'planilla' && d.error ? `<div class="cm-aviso mal">${esc(d.error)} Los cambios no se pueden guardar hasta que la planilla responda.</div>` : ''}
  ${!d.clientes.length ? '<div class="cm-aviso">La planilla está vacía. Usá <b>Importar Excel</b> con la lista de clientes (o cargá uno con <b>+ Cliente</b>).</div>' : ''}
  <div class="cm-embudo">${o.ESTADOS_CONTACTO.map((e) => `<button data-cm-contacto="${esc(e)}" class="${CM.f.contacto === e ? 'on' : ''}"><div class="n">${d.clientes.filter((c) => (c.estadoContacto || 'Sin contactar') === e).length}</div><div class="l">${esc(e)}</div></button>`).join('')}</div>
  <div class="cm-filtros">
    <input type="text" id="cm-q" placeholder="Buscar negocio, rubro, mail o nota" value="${esc(CM.f.q)}">
    ${sel('cm-zona', 'Todas las zonas', zonas, CM.f.zona)}${sel('cm-rubro', 'Todos los rubros', rubros, CM.f.rubro)}${sel('cm-pres', 'Toda presencia', o.PRESENCIA, CM.f.pres)}
    <span class="cuenta">${lista.length} de ${d.clientes.length}</span></div>
  <div class="card" style="padding:8px 12px"><div class="cm-envoltura"><table class="cm-tabla">
    <tr><th>Negocio</th><th>Presencia</th><th class="ocultable">Prioridad</th><th class="ocultable">Web objeto</th><th>Contacto</th><th class="ocultable">Mail</th><th>Respuesta</th></tr>
    ${lista.map((c) => `<tr class="cm-fila" data-cm-id="${esc(c.id)}">
      <td><div class="nom">${esc(c.nombre)}</div><div class="sub">${esc(c.rubro)} · ${esc(c.zona)}</div></td>
      <td><span class="pill ${cmPres(c.presencia)}">${esc(c.presencia)}</span></td>
      <td class="ocultable"><span class="prio ${esc(c.prioridad)}">${esc(c.prioridad)}</span></td>
      <td class="ocultable">${esc(c.estadoWeb || 'Pendiente')}</td>
      <td>${esc(c.estadoContacto || 'Sin contactar')}</td>
      <td class="ocultable">${c.email ? (c.fechaEnvio ? `Enviado ${esc(c.fechaEnvio.slice(8, 10))}/${esc(c.fechaEnvio.slice(5, 7))}` : 'Cargado') : '<span style="color:var(--ink-faint)">Falta</span>'}</td>
      <td>${c.respuestaClase ? `<span class="pill ${esc(c.respuestaClase)}">${esc(CM_CLASES[c.respuestaClase] || c.respuestaClase)}</span>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="vacio">Ningún cliente coincide con los filtros.</td></tr>'}
  </table></div></div>`;

  const re = () => vistaClientes(main);
  main.querySelectorAll('[data-cm-contacto]').forEach((b) => b.onclick = () => { CM.f.contacto = CM.f.contacto === b.dataset.cmContacto ? '' : b.dataset.cmContacto; re(); });
  $('#cm-q').oninput = (e) => { CM.f.q = e.target.value; clearTimeout(CM.t); CM.t = setTimeout(() => { re(); const q = $('#cm-q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); };
  $('#cm-zona').onchange = (e) => { CM.f.zona = e.target.value; re(); };
  $('#cm-rubro').onchange = (e) => { CM.f.rubro = e.target.value; re(); };
  $('#cm-pres').onchange = (e) => { CM.f.pres = e.target.value; re(); };
  main.querySelectorAll('[data-cm-id]').forEach((tr) => tr.onclick = () => cmAbrir(tr.dataset.cmId));
  $('#cm-recargar').onclick = () => vistaClientes(main, true);
  $('#cm-nuevo').onclick = cmNuevo;
  $('#cm-revisar').onclick = async (ev) => {
    ev.target.disabled = true;
    try { const r = await api('/clientes/revisar', { method: 'POST' }); toast(r.omitido ? (r.motivo || 'Ya se estaba revisando') : `Revisados ${r.revisados} · respuestas nuevas: ${r.nuevas.length}`); vistaClientes(main, true); }
    catch (e) { toast(e.message, true); ev.target.disabled = false; }
  };
  $('#cm-exportar').onclick = cmExportar;
  $('#cm-importar').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    let contenido;
    try { contenido = await file.arrayBuffer(); } catch { toast('No pude leer el archivo. Cerralo en Excel y probá de nuevo.', true); return; }
    const fd = new FormData(); fd.append('archivo', new Blob([contenido]), file.name);
    toast('Importando…');
    try { const r = await api('/clientes/importar', { method: 'POST', body: fd }); toast(`Importados ${r.leidos}: ${r.creados} nuevos, ${r.actualizados} actualizados`); vistaClientes(main, true); }
    catch (err) { toast(err.message, true); }
  };
}

async function cmExportar() {
  try {
    const res = await fetch('/api/crm/clientes/exportar', { headers: { Authorization: 'Bearer ' + token() } });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo exportar');
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a'); a.href = url; a.download = `clientes-maps-${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) { toast(e.message, true); }
}

function cmNuevo() {
  const o = CM.datos.opciones;
  const m = modal(`<h3>Nuevo cliente</h3>
    <div class="campo"><label>Negocio</label><input type="text" id="n-nombre"></div>
    <div class="fila"><div class="campo"><label>Rubro</label><input type="text" id="n-rubro"></div><div class="campo"><label>Zona</label><input type="text" id="n-zona" placeholder="Campana, Pilar…"></div></div>
    <div class="fila"><div class="campo"><label>Teléfono</label><input type="text" id="n-tel"></div><div class="campo"><label>Presencia</label><select id="n-pres">${o.PRESENCIA.map((p) => `<option>${p}</option>`).join('')}</select></div></div>
    <div class="campo"><label>Web o red (URL)</label><input type="text" id="n-web"></div>
    <div class="acciones"><button class="btn" id="n-cancelar">Cancelar</button><button class="btn primario" id="n-guardar">Crear</button></div>`);
  $('#n-cancelar', m).onclick = cerrar;
  $('#n-guardar', m).onclick = async () => {
    try {
      const c = await api('/clientes', { method: 'POST', body: { nombre: $('#n-nombre', m).value, rubro: $('#n-rubro', m).value, zona: $('#n-zona', m).value, telefono: $('#n-tel', m).value, presencia: $('#n-pres', m).value, webUrl: $('#n-web', m).value } });
      CM.datos.clientes.push(c); cerrar(); render(); cmAbrir(c.id);
    } catch (e) { toast(e.message, true); }
  };
}

function cmReemplazar(c) {
  const i = CM.datos.clientes.findIndex((x) => x.id === c.id);
  if (i >= 0) CM.datos.clientes[i] = c; else CM.datos.clientes.push(c);
}

const CM_ARCHIVOS = [
  ['compu', 'imgCompu', 'Muestra web · compu', '.png,.jpg,.jpeg,.webp'],
  ['celu', 'imgCelu', 'Muestra web · celular', '.png,.jpg,.jpeg,.webp'],
  ['informeWeb', 'informeWeb', 'Auditoría web', '.html,.pdf'],
  ['informeMarca', 'informeMarca', 'Análisis de marca', '.html,.pdf'],
  ['informeNegocio', 'informeNegocio', 'Auditoría de negocio', '.html,.pdf'],
];

function cmAbrir(id) {
  const c = CM.datos.clientes.find((x) => x.id === id); if (!c) return;
  const o = CM.datos.opciones, est = CM.datos.estado;
  const inp = (k, label, extra = '') => `<div class="campo ${extra}"><label>${label}</label><input type="text" data-k="${k}" value="${esc(c[k])}"></div>`;
  const txt = (k, label, alto = 80) => `<div class="campo ancho"><label>${label}</label><textarea data-k="${k}" style="min-height:${alto}px">${esc(c[k])}</textarea></div>`;
  const sel = (k, label, arr) => `<div class="campo"><label>${label}</label><select data-k="${k}">${arr.map((x) => `<option${x === (c[k] || arr[0]) ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></div>`;
  const link = cmLinkPublico(c);
  const tel = String(c.telefono || '').replace(/\D/g, '');

  const m = modal(`<h3>${esc(c.nombre)}</h3>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin:-6px 0 6px">
    <button class="btn primario chico" id="cm-ficha">Copiar ficha completa</button>
    <button class="btn chico" id="cm-pegar-abrir">Pegar resultado del chat</button>
    ${c.mapsUrl ? `<a class="btn chico" href="${esc(c.mapsUrl)}" target="_blank" rel="noopener">Google Maps</a>` : ''}
    ${c.webUrl ? `<a class="btn chico" href="${esc(c.webUrl)}" target="_blank" rel="noopener">Su web</a>` : ''}
  </div>
  <div class="cm-pegar" id="cm-pegar"><textarea id="cm-pegar-txt" placeholder="Pegá acá la respuesta del chat de informes (con el bloque json del final)" style="min-height:120px"></textarea>
    <div class="acciones" style="margin-top:8px"><button class="btn chico" id="cm-pegar-aplicar">Completar campos</button></div></div>

  <div class="det"><h4>Datos del negocio</h4><div class="cm-grid">
    ${inp('nombre', 'Negocio')}${inp('rubro', 'Rubro')}${inp('zona', 'Zona')}${inp('direccion', 'Dirección')}
    ${inp('telefono', 'Teléfono')}${inp('email', 'Mail')}${inp('webUrl', 'Web')}${inp('instagram', 'Instagram')}
    ${sel('presencia', 'Presencia', o.PRESENCIA)}${sel('prioridad', 'Prioridad', o.PRIORIDAD)}${inp('tipo', 'Tipo societario')}${inp('mapsUrl', 'Ficha de Google Maps')}
    ${inp('senal', 'Señales', 'ancho')}</div></div>

  <div class="det"><h4>Seguimiento</h4><div class="cm-grid">
    ${sel('estadoWeb', 'Web objeto', o.ESTADOS_WEB)}${sel('estadoContacto', 'Contacto', o.ESTADOS_CONTACTO)}
    ${sel('diagnostico', 'Diagnóstico Prisma', o.DIAGNOSTICO)}<div class="campo"><label>Último contacto</label><input type="date" data-k="ultimoContacto" value="${esc(c.ultimoContacto)}"></div>
    ${inp('proximoPaso', 'Próximo paso', 'ancho')}${txt('notas', 'Notas', 60)}</div></div>

  <div class="det"><h4>Informes y muestra web</h4><div class="cm-grid">
    ${txt('gancho', 'Gancho contable (interno)', 70)}${txt('resumenWeb', 'Hallazgos de la web')}${txt('resumenMarca', 'Hallazgos de marca', 60)}
    ${txt('resumenNegocio', 'Hallazgos de negocio', 60)}${txt('ganchoMail', 'Gancho para el cliente (va en el mail)', 60)}</div>
    <div class="cm-arch">${CM_ARCHIVOS.map(([tipo, campo, etq, acepta]) => `<div class="a"><b>${etq}</b>
      ${c[campo] ? (campo.startsWith('img') ? `<img src="${cmArchivoUrl(c.id, c[campo])}" alt="${etq}">` : `<span style="font-size:12.5px;color:var(--ink-soft)">${esc(c[campo])}</span>`) : '<span class="vacio">Sin subir</span>'}
      <div class="acc"><label class="btn chico" style="cursor:pointer">${c[campo] ? 'Reemplazar' : 'Subir'}<input type="file" accept="${acepta}" data-subir="${tipo}" hidden></label>
      ${c[campo] ? `<a class="btn chico" href="${cmArchivoUrl(c.id, c[campo])}" target="_blank" rel="noopener">Ver</a><button class="btn chico peligro" data-quitar="${tipo}">Quitar</button>` : ''}</div></div>`).join('')}</div>
    ${link ? `<div style="margin-top:12px;font-size:13px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="color:var(--ink-faint)">Página para el cliente:</span><code style="user-select:all;word-break:break-all">${esc(link)}</code><button class="btn chico" id="cm-link-copiar">Copiar</button><a class="btn chico" href="${esc(link)}" target="_blank" rel="noopener">Abrir</a></div>` : '<div class="vacio" style="margin-top:8px">La página para el cliente se crea cuando subís el primer archivo.</div>'}
  </div>

  <div class="det"><h4>Mail de primer contacto ${c.fechaEnvio ? `<span class="etq">enviado ${esc(new Date(c.fechaEnvio).toLocaleString('es-AR'))}</span>` : ''}</h4>
    <div class="campo"><label>Asunto</label><input type="text" data-k="asuntoMail" value="${esc(c.asuntoMail)}"></div>
    <div class="campo"><label>Texto (la firma, las imágenes de la muestra y el botón al informe se agregan solos)</label><textarea data-k="cuerpoMail" style="min-height:220px">${esc(c.cuerpoMail)}</textarea></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn chico" id="cm-borrador">Armar borrador</button>
      <button class="btn primario chico" id="cm-enviar" ${!est.mail ? 'disabled title="Falta MAIL_API_TOKEN en el servidor"' : ''}>${c.fechaEnvio ? 'Reenviar mail' : 'Enviar mail'}</button>
      ${tel ? `<button class="btn chico" id="cm-wa-copiar">Copiar para WhatsApp</button><a class="btn chico" id="cm-wa" href="#" target="_blank" rel="noopener">Abrir WhatsApp</a>` : ''}
    </div>
    <div class="msg" id="cm-mail-msg"></div>
  </div>

  ${c.respuesta ? `<div class="det"><h4>Respuesta del cliente <span class="pill ${esc(c.respuestaClase)}">${esc(CM_CLASES[c.respuestaClase] || c.respuestaClase)}</span> <span class="etq">${esc(new Date(c.respuestaFecha).toLocaleString('es-AR'))}</span></h4>
    <div class="cm-resp">${esc(c.respuesta)}</div>
    <div style="margin-top:10px;font-size:13px;color:var(--ink-soft)">${c.agendaEnviada ? `Link de agenda enviado el ${esc(new Date(c.agendaEnviada).toLocaleString('es-AR'))}.` : `<button class="btn chico" id="cm-agenda" ${!est.agendaUrl ? 'disabled title="Falta AGENDA_URL"' : ''}>Mandar link para agendar</button>`}</div></div>` : ''}

  <div class="acciones"><button class="btn peligro" id="cm-eliminar">Eliminar</button><button class="btn" id="cm-cerrar">Cerrar</button><button class="btn primario" id="cm-guardar">Guardar cambios</button></div>`, true);

  const campos = () => Object.fromEntries([...m.querySelectorAll('[data-k]')].map((el) => [el.dataset.k, el.value]));
  const cambios = () => Object.fromEntries(Object.entries(campos()).filter(([k, v]) => v !== (c[k] || '')));
  const guardar = async (silencioso) => {
    const ch = cambios(); if (!Object.keys(ch).length) return c;
    const nuevo = await api('/clientes/' + encodeURIComponent(c.id), { method: 'PATCH', body: ch });
    Object.assign(c, nuevo); cmReemplazar(nuevo); if (!silencioso) toast('Guardado en la planilla');
    return nuevo;
  };
  const reabrir = (nuevo) => { if (nuevo) cmReemplazar(nuevo); cmAbrir(id); if (S.vista === 'clientes') vistaClientes($('#main')); };

  $('#cm-cerrar', m).onclick = () => { if (Object.keys(cambios()).length && !confirm('Hay cambios sin guardar. ¿Cerrar igual?')) return; cerrar(); };
  $('#cm-guardar', m).onclick = async () => { try { await guardar(); reabrir(); } catch (e) { toast(e.message, true); } };
  $('#cm-eliminar', m).onclick = async () => {
    if (!confirm(`¿Eliminar a ${c.nombre} de la planilla? No se puede deshacer.`)) return;
    try { await api('/clientes/' + encodeURIComponent(c.id), { method: 'DELETE' }); CM.datos.clientes = CM.datos.clientes.filter((x) => x.id !== c.id); cerrar(); render(); } catch (e) { toast(e.message, true); }
  };
  $('#cm-ficha', m).onclick = async () => { try { await guardar(true); const r = await api(`/clientes/${encodeURIComponent(c.id)}/ficha`); copiar(r.texto); } catch (e) { toast(e.message, true); } };
  $('#cm-pegar-abrir', m).onclick = () => $('#cm-pegar', m).classList.toggle('on');
  $('#cm-pegar-aplicar', m).onclick = () => {
    const t = $('#cm-pegar-txt', m).value;
    const bloque = (t.match(/```json\s*([\s\S]*?)```/) || [])[1] || (t.match(/\{[\s\S]*\}/) || [])[0];
    let j; try { j = JSON.parse(bloque); } catch { toast('No encontré el bloque json en lo que pegaste.', true); return; }
    const mapa = { resumenWeb: 'resumenWeb', resumenMarca: 'resumenMarca', resumenNegocio: 'resumenNegocio', ganchoMail: 'ganchoMail', asunto: 'asuntoMail', cuerpo: 'cuerpoMail' };
    let n = 0;
    for (const [k, campo] of Object.entries(mapa)) { const el = m.querySelector(`[data-k="${campo}"]`); if (el && typeof j[k] === 'string' && j[k].trim()) { el.value = j[k].trim(); n++; } }
    toast(n ? `Completé ${n} campos. Revisalos y tocá Guardar cambios.` : 'El bloque no traía campos conocidos.', !n);
    if (n) $('#cm-pegar', m).classList.remove('on');
  };
  m.querySelectorAll('[data-subir]').forEach((inpEl) => inpEl.onchange = async () => {
    const file = inpEl.files[0]; if (!file) return;
    try {
      await guardar(true);
      const fd = new FormData(); fd.append('archivo', new Blob([await file.arrayBuffer()], { type: file.type }), file.name);
      toast('Subiendo…');
      reabrir(await api(`/clientes/${encodeURIComponent(c.id)}/archivos/${inpEl.dataset.subir}`, { method: 'POST', body: fd }));
    } catch (e) { toast(e.message, true); }
  });
  m.querySelectorAll('[data-quitar]').forEach((b) => b.onclick = async () => {
    try { reabrir(await api(`/clientes/${encodeURIComponent(c.id)}/archivos/${b.dataset.quitar}`, { method: 'DELETE' })); } catch (e) { toast(e.message, true); }
  });
  const lc = $('#cm-link-copiar', m); if (lc) lc.onclick = () => copiar(link);
  $('#cm-borrador', m).onclick = async () => {
    const cuerpo = m.querySelector('[data-k="cuerpoMail"]');
    if (cuerpo.value.trim() && !confirm('Ya hay un texto. ¿Reemplazarlo por el borrador?')) return;
    try { await guardar(true); const r = await api(`/clientes/${encodeURIComponent(c.id)}/borrador`, { method: 'POST' }); m.querySelector('[data-k="asuntoMail"]').value = r.asunto; cuerpo.value = r.cuerpo; toast('Borrador listo. Revisalo antes de enviar.'); } catch (e) { toast(e.message, true); }
  };
  $('#cm-enviar', m).onclick = async (ev) => {
    const msg = $('#cm-mail-msg', m); msg.className = 'msg'; msg.textContent = '';
    const v = campos();
    if (!v.email) { msg.className = 'msg error'; msg.textContent = 'Falta el mail del cliente (en Datos del negocio).'; return; }
    if (!v.asuntoMail.trim() || !v.cuerpoMail.trim()) { msg.className = 'msg error'; msg.textContent = 'Faltan el asunto o el texto.'; return; }
    const extras = [c.imgCompu && 'muestra en compu', c.imgCelu && 'muestra en celular', c.codigoPublico && 'botón al informe'].filter(Boolean).join(', ');
    if (!confirm(`¿Enviar el mail a ${v.email}?${extras ? `\nIncluye: ${extras}.` : '\nNo tiene imágenes ni informe subidos.'}`)) return;
    ev.target.disabled = true; msg.textContent = 'Enviando…';
    try {
      await guardar(true);
      const r = await api(`/clientes/${encodeURIComponent(c.id)}/enviar`, { method: 'POST', body: { asunto: v.asuntoMail, cuerpo: v.cuerpoMail, reenviar: Boolean(c.fechaEnvio) } });
      toast('Mail enviado'); reabrir(r);
    } catch (e) { msg.className = 'msg error'; msg.textContent = e.message; ev.target.disabled = false; }
  };
  const waTexto = () => { const v = campos(); return `${v.cuerpoMail.trim()}${link ? `\n\nInforme y muestra: ${link}` : ''}`; };
  const wc = $('#cm-wa-copiar', m); if (wc) wc.onclick = () => copiar(waTexto());
  const wa = $('#cm-wa', m); if (wa) wa.onclick = () => { wa.href = `https://wa.me/${tel}?text=${encodeURIComponent(waTexto())}`; };
  const ag = $('#cm-agenda', m); if (ag) ag.onclick = async () => {
    if (!confirm(`¿Mandarle a ${c.email} el link para agendar?`)) return;
    try { reabrir(await api(`/clientes/${encodeURIComponent(c.id)}/agenda`, { method: 'POST' })); toast('Link de agenda enviado'); } catch (e) { toast(e.message, true); }
  };
}
