// ================= Armado del reel (vista visual paso a paso) =================
// Lee el campo "armado_reel" (JSON) de la pieza. Si no está, arma una versión básica
// a partir de contenido_a_crear y pedido_para_ia.

const ESTUDIO_PLANTILLAS = [
  { id: 'AMBIENTE', nombre: 'FondoCam', imagen: 'fondocam', que_es: 'La oficina vacía desde el celular apoyado en el escritorio, con el cartel CONSULTORA PRISMA completo.', uso: 'Ambiente para el modo B (Ingredients) y para fotos nuevas de Clara.', estado: 'Lista en el estudio' },
  { id: 'POV1', nombre: 'ClaraCam01', imagen: 'claracam01', que_es: 'Clara frontal en plano medio, brazos sobre el escritorio.', uso: 'Primer y último cuadro de los clips con POV1 (modo A · Frames).', estado: 'Lista en el estudio' },
  { id: 'POV2', nombre: 'ClaraCam02', imagen: 'claracam02', que_es: 'Clara en primer plano, cabeza apenas girada (misma ropa y luz).', uso: 'Primer y último cuadro de los clips con POV2 (modo A · Frames).', estado: 'Lista en el estudio' },
];

const ARM_CSS = `
.arm-cinta{display:flex;gap:6px;overflow-x:auto;padding:4px 0 10px}
.arm-paso{flex:none;min-width:92px;border-radius:12px;padding:10px 12px;cursor:pointer;border:1px solid var(--border);background:var(--card-2);text-align:left}
.arm-paso b{display:block;font-size:16px}.arm-paso span{display:block;font-size:11px;color:var(--ink-soft);margin-top:2px}
.arm-paso.clip{border-top:4px solid var(--reel)}.arm-paso.imagen{border-top:4px solid var(--carrusel)}
.arm-paso.hecho{opacity:.55}.arm-flecha{flex:none;align-self:center;color:var(--ink-faint)}
.arm-plant{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.arm-plant .pl{background:var(--card-2);border:1px solid var(--border);border-radius:14px;overflow:hidden}
.arm-plant img{width:100%;aspect-ratio:9/12;object-fit:cover;display:block}
.arm-plant .pl div{padding:10px 12px;font-size:12px;color:var(--ink-soft);line-height:1.45}
.arm-plant .pl b{color:var(--ink);font-size:13px}
.arm-tag{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:3px 8px;border-radius:999px;background:var(--primary-glow);color:var(--primary)}
.arm-el{background:var(--card-2);border:1px solid var(--border);border-radius:16px;padding:16px;margin-top:12px}
.arm-el h4{margin:0;display:flex;align-items:center;gap:10px;font-size:15px}
.arm-pasos{margin:12px 0 0;padding:0;list-style:none;counter-reset:p}
.arm-pasos li{counter-increment:p;position:relative;padding:8px 0 8px 34px;border-top:1px solid var(--border-soft);line-height:1.5}
.arm-pasos li:before{content:counter(p);position:absolute;left:0;top:8px;width:22px;height:22px;border-radius:50%;background:var(--border);display:grid;place-items:center;font-size:11px;font-weight:700}
.arm-pre{white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:12px;background:var(--bg);border:1px solid var(--border-soft);border-radius:10px;padding:10px;margin-top:6px}
.arm-mini{display:flex;gap:10px;align-items:center}.arm-mini img{width:42px;height:56px;object-fit:cover;border-radius:8px}
`;

function armadoDesdeTexto(c) {
  const cont = c.contenido_a_crear || '', ped = c.pedido_para_ia || '';
  const els = [];
  cont.split('\n').forEach((l) => {
    const m = l.match(/^\s*(C\d|B\d)\s*·\s*(.*)$/);
    if (!m || els.some((e) => e.id === m[1])) return;
    const id = m[1], resto = m[2];
    const dice = (resto.match(/"([^"]+)"/) || [])[1] || '';
    const pov = /cam0?2/i.test(resto) ? 'POV2' : /cam0?1/i.test(resto) ? 'POV1' : '';
    if (id[0] === 'C') {
      const bloque = (ped.split(/\n\s*\n/).find((p) => new RegExp(`Clip ${id}\\b`).test(p)) || '').trim();
      els.push({ id, tipo: 'clip', rol: resto.split('·')[0].trim(), duracion: '8 s', estado: /HECHO/i.test(resto) ? 'Hecho' : 'Pendiente', pov, modo: 'A · Frames', modelo: 'Omni Flash 720p · 8 s · x1', dice, prompt: bloque || 'Ver "Pedido para la IA".' });
    } else {
      const nb = (ped.match(new RegExp(`Nano Banana \\(${id}\\):\\s*"([^"]+)"`)) || [])[1] || '';
      els.push({ id, tipo: 'imagen', rol: 'Apoyo', duracion: '2,5 s', estado: 'Pendiente', herramienta: 'Flow · Imagen · Nano Banana · 0 créditos', prompt: nb || resto, animacion: 'Editor Prisma → modo "Imagen B": zoom lento de 2,5 s.' });
    }
  });
  return { titulo: c.idea_ganadora, elementos: els, plantillas: ESTUDIO_PLANTILLAS, basico: true };
}

function leerArmado(c) {
  try { if (c.armado_reel) { const a = JSON.parse(c.armado_reel); if (a && a.elementos) return a; } } catch {}
  return armadoDesdeTexto(c);
}

function abrirArmado(c) {
  if (!document.getElementById('arm-css')) { const s = document.createElement('style'); s.id = 'arm-css'; s.textContent = ARM_CSS; document.head.appendChild(s); }
  const a = leerArmado(c);
  const plant = a.plantillas && a.plantillas.length ? a.plantillas : ESTUDIO_PLANTILLAS;
  const porId = Object.fromEntries(plant.map((p) => [p.id, p]));
  const els = a.elementos || [];
  const creditos = els.filter((e) => e.tipo === 'clip' && !/hecho/i.test(e.estado || '')).reduce((s, e) => s + (+e.creditos || 12), 0);
  const copiables = [];
  const bot = (txt, etiqueta) => { copiables.push(txt); return `<button class="btn chico" data-arm-copiar="${copiables.length - 1}">${etiqueta}</button>`; };

  const cinta = els.map((e, i) => `${i ? '<span class="arm-flecha">→</span>' : ''}<button class="arm-paso ${e.tipo} ${/hecho/i.test(e.estado || '') ? 'hecho' : ''}" data-arm-ir="${esc(e.id)}"><b>${esc(e.id)}</b><span>${esc(e.rol || '')}</span><span>${esc(e.duracion || '')}${e.pov ? ' · ' + esc(e.pov) : ''}</span></button>`).join('');

  const plantillas = plant.map((p) => `<div class="pl"><img src="/estudio/${esc(p.imagen)}.jpg" alt=""><div><span class="arm-tag">${esc(p.id)}</span><br><b>${esc(p.nombre)}</b><br>${esc(p.que_es)}<br><i>${esc(p.uso)}</i></div></div>`).join('');

  const tarjeta = (e) => {
    const hecho = /hecho/i.test(e.estado || '');
    if (e.tipo === 'imagen') {
      return `<div class="arm-el" id="arm-${esc(e.id)}"><h4><span class="arm-tag" style="background:rgba(232,211,174,.15);color:var(--carrusel)">Imagen</span>${esc(e.id)} · ${esc(e.rol || 'Apoyo')} · ${esc(e.duracion || '')}<span style="margin-left:auto;font-size:12px;color:var(--ink-faint)">${esc(e.estado || '')}</span></h4>
      <ol class="arm-pasos">
        <li>En el estudio de Flow: <b>${esc(e.herramienta || 'Imagen · Nano Banana · 0 créditos')}</b>. Sin personaje ni plantilla de Clara. ${bot(e.prompt, 'Copiar pedido')}<div class="arm-pre">${esc(e.prompt)}</div></li>
        <li>Guardala en la colección del reel con el nombre <b>${esc(e.id)}</b>.</li>
        <li>Animala: ${esc(e.animacion || 'Editor Prisma → modo "Imagen B": zoom lento.')}</li>
        ${e.efectos ? `<li>Efectos: ${esc(e.efectos)}</li>` : ''}
      </ol></div>`;
    }
    const p = porId[e.pov] || {};
    return `<div class="arm-el" id="arm-${esc(e.id)}"><h4><span class="arm-tag">Clip</span>${esc(e.id)} · ${esc(e.rol || '')} · ${esc(e.duracion || '8 s')}<span style="margin-left:auto;font-size:12px;color:${hecho ? 'var(--ok)' : 'var(--ink-faint)'}">${esc(e.estado || '')}</span></h4>
      <div class="arm-mini" style="margin-top:12px">${p.imagen ? `<img src="/estudio/${esc(p.imagen)}.jpg" alt="">` : ''}<div style="font-size:13px;line-height:1.5"><b>${esc(e.pov || '')} · ${esc(p.nombre || '')}</b><br>Modo (framework): <b>${esc(e.modo || 'A · Frames')}</b><br>Modelo: <b>${esc(e.modelo || 'Omni Flash 720p · 8 s · x1')}</b>${e.creditos ? ` · ${esc(e.creditos)} créditos` : ''}</div></div>
      ${hecho ? '<p style="margin:12px 0 0;color:var(--ok)">Ya está hecho: solo pasalo por el Editor Prisma con su ficha.</p>' : ''}
      <ol class="arm-pasos">
        ${hecho ? '' : `<li>En el estudio de Flow, abrí el modo <b>${esc((e.modo || 'A · Frames').split('(')[0].trim())}</b>, elegí el personaje <b>@Clara</b> (con su voz) y poné <b>${esc(p.nombre || e.pov || '')}</b> como primer y último cuadro.</li>
        <li>Pegá el pedido. Antes de generar, confirmá en pantalla el modelo, la duración, la voz y los créditos. ${bot(e.prompt, 'Copiar pedido')}<div class="arm-pre">${esc(e.prompt)}</div></li>`}
        ${e.dice ? `<li>Clara dice: <i>"${esc(e.dice)}"</i></li>` : ''}
        ${e.ficha ? `<li>Editor Prisma: cargá el clip y pegá la ficha. ${bot(e.ficha, 'Copiar ficha')}<div class="arm-pre">${esc(e.ficha)}</div></li>` : ''}
        ${e.efectos ? `<li>Efectos: ${esc(e.efectos)}</li>` : ''}
        <li>Exportá <b>${esc(e.id.toLowerCase())}.mp4</b>.</li>
      </ol></div>`;
  };

  const m = modal(`
    <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:var(--reel)">Armado del reel · ${largo(c.fecha)}</div>
    <h3 style="margin-top:6px">${esc(a.titulo || c.idea_ganadora)}</h3>
    <p style="margin:-6px 0 14px;color:var(--ink-soft)">${a.duracion_total ? esc(a.duracion_total) + ' · ' : ''}${els.length} elementos · faltan ${creditos} créditos${a.palabra_clave ? ' · palabra clave <b>' + esc(a.palabra_clave) + '</b>' : ''}${a.basico ? ' · <span class="alerta">versión básica: el plan no trae armado detallado</span>' : ''}</p>
    <div class="det"><h4>1 · Orden del reel final</h4><div class="arm-cinta">${cinta}</div></div>
    <div class="det"><h4>2 · Plantillas del estudio (se usan en cada clip)</h4><div class="arm-plant">${plantillas}</div></div>
    <div class="det"><h4>3 · Cómo se hace cada elemento</h4>${els.map(tarjeta).join('')}</div>
    <div class="det"><h4>4 · Montaje final</h4><div class="txt">${esc(a.montaje || 'En Instagram: Crear → Reel → elegí los MP4 en el orden de arriba y sumá una música instrumental muy baja.')}</div></div>
    <div class="acciones"><button class="btn" id="arm-volver">Volver a la pieza</button><button class="btn" id="arm-cerrar">Cerrar</button></div>`, true);
  m.querySelectorAll('[data-arm-copiar]').forEach((b) => b.onclick = () => copiar(copiables[+b.dataset.armCopiar]));
  m.querySelectorAll('[data-arm-ir]').forEach((b) => b.onclick = () => m.querySelector('#arm-' + b.dataset.armIr)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  m.querySelector('#arm-cerrar').onclick = cerrar;
  m.querySelector('#arm-volver').onclick = () => abrirPieza(c.id);
}
