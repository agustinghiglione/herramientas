// ================= Guía de Flow (consulta rápida para el estudio) =================
// Contenido estático: cómo funcionaba Google Flow al 6/11/2026. Si Flow cambia, se actualiza acá.
const FLOW_VIGENCIA = '6 de noviembre de 2026';

const FLOW_MODOS = [
  {
    letra: 'A', titulo: 'Frames (foto → video)', recomendado: true,
    texto: 'Usás esta misma foto como primer cuadro. Es lo más consistente, porque fondo, ropa, luz y encuadre quedan idénticos en todos los clips. Pero si querés la voz de Clara, sigue valiendo lo que vimos: la voz solo funciona con Omni Flash en modo Ingredients. Antes de producir, confirmá en pantalla que se puede elegir la voz con un primer cuadro.',
    cuando: 'Reels de Clara hablando a cámara, con el mismo encuadre de siempre.',
  },
  {
    letra: 'B', titulo: 'Ingredients (@Clara + fondo)', recomendado: false,
    texto: 'Flow arma la escena, con más libertad de pose pero más riesgo de que cambien el escritorio o las letras. Para eso hace falta el fondo vacío desde este mismo punto de vista. Lo generás editando tu foto con Nano Banana (0 créditos).',
    cuando: 'Cuando necesitás otra pose o un movimiento que no sale desde la foto. Ingredientes: @Clara + FondoCam.',
  },
];

const FLOW_MODELOS = [
  ['Omni 1.1 Flash · 360p · 8 s', '6', 'Probar un formato nuevo (borrador).'],
  ['Omni 1.1 Flash · 720p · 8 s', '12', 'El de todos los días para los clips de Clara. x1 siempre.'],
  ['Omni 1.1 Flash · 720p · 10 s', '15', 'Solo si la frase no entra en 8 s.'],
  ['Veo 3.1 Lite', '10', 'Planos sin voz de Clara (alternativa).'],
  ['Veo 3.1 Fast', '20', 'No usar: caro para Instagram.'],
  ['Veo 3.1 Quality', '100', 'No usar.'],
  ['Nano Banana (imágenes)', '0', 'Fondos, variantes de pose, apoyos con zoom en la edición.'],
];

const FLOW_GLOSARIO = [
  ['Omni Flash', 'El modelo de video que usamos. Es el único que acepta la voz de Clara (en modo Ingredients). 720p, 8 s, x1 = 12 créditos.'],
  ['Veo', 'La otra familia de modelos de video de Flow (Lite, Fast, Quality). Más caros y sin la voz del personaje. No los usamos para Clara.'],
  ['Nano Banana', 'El modelo de imágenes. Cuesta 0 créditos. Sirve para editar fotos: sacar a Clara del fondo, cambiar la pose, crear apoyos.'],
  ['Frames', 'Modo donde le das la imagen de inicio (y opcionalmente la de fin) y Flow la anima. Máxima consistencia de fondo y ropa.'],
  ['Ingredients', 'Modo donde le das elementos sueltos (personaje + fondo) y Flow compone la escena. Más libertad, más riesgo de cambios.'],
  ['Personaje (@Clara)', 'Se crea con 1 o 2 fotos de referencia, una voz y una descripción. Se llama en el prompt escribiendo @Clara.'],
  ['Voz', 'Solo funciona con Omni Flash en modo Ingredients. Si en Frames no aparece para elegir, usá Ingredients con @Clara + FondoCam.'],
  ['FondoCam', 'La oficina vacía desde el punto de vista del celular apoyado en el escritorio. Es el fondo para el modo Ingredients.'],
  ['ClaraCam01', 'La foto de Clara elegida (POV escritorio, blazer azul). Primer cuadro en modo Frames y base de las variantes de pose.'],
  ['x1 / x2', 'Cuántas versiones genera. x2 duplica el costo. En video siempre x1; las variantes se piden en imágenes (gratis).'],
  ['360p / 720p', '360p es borrador (6 créditos). Regenerar en 720p da otra toma, no agranda el borrador.'],
  ['Créditos', 'Plan Plus: 50 por día (no se acumulan) + 200 por mes. Un reel de Clara entra en los 50 del día (≤ 48).'],
  ['Omni edit', 'Editar un clip ya generado. Puede costar más que regenerar (se habla de 40). Mirá el costo en pantalla antes de aceptar.'],
  ['Escenas', 'Donde se recortan y unen los clips. Si falla el final de un clip, recortalo ahí en vez de regenerar.'],
];

const FLOW_PROMPTS = [
  ['Fondo vacío (FondoCam)', 'Editá esta imagen: sacá a la mujer por completo. Mantené exactamente igual todo lo demás: el encuadre, la altura de cámara, el escritorio, el olivo, la lámpara dorada, la ventana, la luz cálida y las letras "CONSULTORA PRISMA" de la pared, que ahora se ven completas. Silla de oficina vacía detrás del escritorio. Sin personas.'],
  ['Variante de pose (desde ClaraCam01)', 'Editá esta imagen: la misma mujer, misma ropa, mismo fondo y misma luz. Solo cambiá la pose: [describí la pose, por ejemplo: manos juntas sobre el escritorio, inclinada apenas hacia la cámara]. No cambies el encuadre ni ningún objeto.'],
  ['Base para cada clip (modo Frames)', 'Plano fijo de celular apoyado sobre el escritorio, igual a la imagen de referencia. @Clara habla a cámara con tono cálido y tranquilo, gestos chicos de las manos sobre el escritorio. Sin cambios de encuadre, sin cortes, sin música. Dice exactamente: "…"'],
];

function vistaFlow(main) {
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  main.innerHTML = `
  <div class="barra"><h1>Guía de Flow</h1><span class="sub">Así funciona la plataforma al ${FLOW_VIGENCIA}. Flow cambia seguido: si algo no coincide, manda lo que ves en pantalla.</span></div>

  <div class="card" style="margin-bottom:18px">
    <h2>Consulta rápida</h2>
    <input id="flow-buscar" placeholder="Escribí qué querés recordar: voz, Omni, Nano Banana, frames, créditos…" style="width:100%;padding:11px 14px;border-radius:10px;border:1px solid var(--border);background:var(--card-2)">
    <div id="flow-resultados" style="margin-top:14px;display:grid;gap:10px"></div>
  </div>

  <div class="card" style="margin-bottom:18px">
    <h2>¿Frames o Ingredients?</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">
      ${FLOW_MODOS.map((m) => `<div style="background:var(--card-2);border:1px solid ${m.recomendado ? 'var(--primary)' : 'var(--border)'};border-radius:14px;padding:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-weight:700;background:${m.recomendado ? 'var(--primary)' : 'var(--border)'};color:${m.recomendado ? '#0c1520' : 'var(--ink)'}">${m.letra}</span><b style="font-size:15px">${esc(m.titulo)}</b>${m.recomendado ? '<span style="margin-left:auto;font-size:11px;color:var(--primary);letter-spacing:.08em;text-transform:uppercase">Por defecto</span>' : ''}</div>
        <p style="margin:0 0 10px;line-height:1.55;color:var(--ink-soft)">${esc(m.texto)}</p>
        <p style="margin:0;font-size:13px"><b>Cuándo:</b> ${esc(m.cuando)}</p></div>`).join('')}
    </div>
  </div>

  <div class="card" style="margin-bottom:18px">
    <h2>¿Qué modelo elijo? <span class="contador">créditos por clip</span></h2>
    <table class="lista"><tr><th>Modelo</th><th>Créditos</th><th>Para qué</th></tr>
      ${FLOW_MODELOS.map(([m, c, p]) => `<tr><td>${esc(m)}</td><td style="text-align:center;font-weight:700">${c}</td><td>${esc(p)}</td></tr>`).join('')}</table>
  </div>

  <div class="card">
    <h2>Pedidos listos para copiar</h2>
    <div style="display:grid;gap:12px">${FLOW_PROMPTS.map(([t, p], i) => `<div class="det"><h4>${esc(t)}<button class="btn chico" data-flow-copiar="${i}">Copiar</button></h4><div class="txt mono">${esc(p)}</div></div>`).join('')}</div>
  </div>`;

  const out = $('#flow-resultados');
  const pintar = (q) => {
    const n = norm(q.trim());
    if (!n) { out.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px">${FLOW_GLOSARIO.map(([t]) => `<button class="btn chico" data-flow-term="${esc(t)}">${esc(t)}</button>`).join('')}</div>`; out.querySelectorAll('[data-flow-term]').forEach((b) => b.onclick = () => { $('#flow-buscar').value = b.dataset.flowTerm; pintar(b.dataset.flowTerm); }); return; }
    const lista = FLOW_GLOSARIO.filter(([t, d]) => norm(t + ' ' + d).includes(n));
    out.innerHTML = lista.length ? lista.map(([t, d]) => `<div style="background:var(--card-2);border-radius:12px;padding:12px 14px"><b>${esc(t)}</b><div style="color:var(--ink-soft);margin-top:4px;line-height:1.5">${esc(d)}</div></div>`).join('')
      : '<div class="vacio">No encontré nada con esa palabra. Probá con "voz", "créditos" o "fondo".</div>';
  };
  $('#flow-buscar').oninput = (e) => pintar(e.target.value);
  pintar('');
  main.querySelectorAll('[data-flow-copiar]').forEach((b) => b.onclick = () => copiar(FLOW_PROMPTS[+b.dataset.flowCopiar][1]));
}
