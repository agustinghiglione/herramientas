"""Página de borradores de TikTok: https://<dominio>/borradores/?k=<clave>

Muestra, por cuenta, los clips que se mandaron como borrador a TikTok y todavía no marcaste como publicados:
el video, la descripción con un botón para copiarla y un botón "Ya lo publiqué".
"""
import html
import json
import os
import time
from pathlib import Path

from aiohttp import web

from . import db

VENTANA_LIMITE = 24 * 3600      # TikTok: máx. 5 borradores sin publicar en 24 h
VENTANA_PAGINA = 4 * 24 * 3600  # la página muestra los de los últimos 4 días


def clave() -> str:
    k = db.kv_get("web_clave")
    if not k:
        k = os.urandom(12).hex()
        db.kv_set("web_clave", k)
    return k


def _enviado(clip: dict) -> float | None:
    """Hora en que el clip llegó como borrador a TikTok (None si no fue borrador)."""
    t = db.kv_get(f"tt_enviado:{clip['id']}")
    if t:
        return float(t)
    try:
        res = json.loads(clip.get("result") or "[]")
    except Exception:
        return None
    if any(r.get("network") == "tiktok" and (r.get("borrador") or str(r.get("msg", "")).startswith("borrador enviado"))
           for r in res):
        return float(clip.get("updated") or 0)
    return None


def pendientes(cuenta: str | None = None, ventana: float = VENTANA_PAGINA) -> list[dict]:
    desde = time.time() - ventana
    sql = "SELECT * FROM clips WHERE updated >= ? AND result LIKE '%borrador%'"
    args = [desde - 3600]
    if cuenta:
        sql += " AND account = ?"
        args.append(cuenta)
    out = []
    for c in db.q(sql + " ORDER BY id", args):
        c = dict(c)
        t = _enviado(c)
        if t and t >= desde and not db.kv_get(f"tt_hecho:{c['id']}"):
            c["enviado"] = t
            out.append(c)
    return out


CSS = """
body{font-family:-apple-system,system-ui,sans-serif;margin:0;background:#111;color:#eee}
header{padding:16px;background:#1d1d1d;position:sticky;top:0;z-index:2}
h1{font-size:20px;margin:0}
.sub{color:#aaa;font-size:14px;margin-top:4px}
.tabs a{display:inline-block;margin:10px 8px 0 0;padding:6px 12px;border-radius:16px;background:#333;color:#eee;text-decoration:none;font-size:14px}
.tabs a.on{background:#fe2c55}
.card{background:#1d1d1d;margin:14px;border-radius:14px;padding:14px}
.card h2{font-size:16px;margin:0 0 8px}
video{width:100%;max-height:70vh;border-radius:10px;background:#000}
textarea{width:100%;box-sizing:border-box;min-height:110px;margin-top:10px;background:#000;color:#eee;border:1px solid #333;border-radius:8px;padding:8px;font-size:15px}
.btns{display:flex;gap:8px;margin-top:10px}
button,.dl{flex:1;padding:14px;border:0;border-radius:10px;font-size:16px;font-weight:600;text-align:center;text-decoration:none}
.copiar{background:#fe2c55;color:#fff}.hecho{background:#2ecc71;color:#000}.dl{background:#333;color:#eee;flex:0 0 auto}
details{margin:14px;color:#ccc;font-size:15px;line-height:1.5}
.vacio{padding:40px 16px;text-align:center;color:#aaa}
"""

JS = """
function copiar(id,btn){const t=document.getElementById('t'+id);
 const ok=()=>{btn.textContent='Copiado';setTimeout(()=>btn.textContent='Copiar descripción',1500)};
 if(navigator.clipboard){navigator.clipboard.writeText(t.value).then(ok,()=>{t.select();document.execCommand('copy');ok()})}
 else{t.select();document.execCommand('copy');ok()}}
async function hecho(id,btn){btn.disabled=true;btn.textContent='...';
 const r=await fetch('hecho/'+id+location.search,{method:'POST'});
 if(r.ok){document.getElementById('c'+id).remove()}else{btn.disabled=false;btn.textContent='Ya lo publiqué'}}
"""

GUIA = """<details><summary><b>Cómo publicar un borrador</b></summary><ol>
<li>Abrí TikTok en el teléfono, en la cuenta que dice arriba.</li>
<li>Tocá la notificación <i>"Tu video está listo para editar"</i>. Si no la ves: Bandeja de entrada → Notificaciones del sistema.</li>
<li>No le cambies nada al video y tocá <b>Siguiente</b>.</li>
<li>Acá tocá <b>Copiar descripción</b> y pegala en TikTok.</li>
<li>Dejá <b>Quién puede ver: Todos</b> y publicá.</li>
<li>Volvé acá y tocá <b>Ya lo publiqué</b> para que el contador se libere.</li>
</ol>TikTok deja como máximo 5 borradores sin publicar en 24 horas. Te aviso cuando haya 4.</details>"""


def crear_app(cfg: dict) -> web.Application:
    cuentas = {k: a.get("nombre_tiktok", k) for k, a in cfg["accounts"].items()
               if a.get("enabled", True) and "tiktok" in a.get("destinations", [])}

    def autorizado(req):
        if req.query.get("k") != clave():
            raise web.HTTPForbidden(text="Link inválido")

    async def pagina(req):
        autorizado(req)
        k = req.query["k"]
        actual = req.query.get("c") or next(iter(cuentas), "")
        items = pendientes(actual)
        en24 = sum(1 for c in items if c["enviado"] >= time.time() - VENTANA_LIMITE)
        tabs = "".join(f'<a class="{"on" if c == actual else ""}" href="?k={k}&c={c}">{html.escape(n)} '
                       f'({len(pendientes(c))})</a>' for c, n in cuentas.items())
        cards = ""
        for c in items:
            hace = int((time.time() - c["enviado"]) / 3600)
            cards += (f'<div class="card" id="c{c["id"]}"><h2>{html.escape(c["streamer"])} · clip #{c["id"]} '
                      f'<span class="sub">(llegó hace {hace} h)</span></h2>'
                      f'<video controls playsinline preload="metadata" src="video/{c["id"]}?k={k}"></video>'
                      f'<textarea id="t{c["id"]}" readonly>{html.escape(c.get("caption") or "")}</textarea>'
                      f'<div class="btns"><button class="copiar" onclick="copiar({c["id"]},this)">Copiar descripción</button>'
                      f'<a class="dl" href="video/{c["id"]}?k={k}&d=1">Bajar</a></div>'
                      f'<div class="btns"><button class="hecho" onclick="hecho({c["id"]},this)">Ya lo publiqué</button></div></div>')
        if not cards:
            cards = '<div class="vacio">No hay borradores pendientes en esta cuenta.</div>'
        body = (f'<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" '
                f'content="width=device-width,initial-scale=1"><title>Borradores TikTok</title><style>{CSS}</style>'
                f'<script>{JS}</script></head><body><header><h1>Borradores de TikTok</h1>'
                f'<div class="sub">{html.escape(cuentas.get(actual, actual))}: {en24} de 5 en las últimas 24 h</div>'
                f'<div class="tabs">{tabs}</div></header>{GUIA}{cards}</body></html>')
        return web.Response(text=body, content_type="text/html")

    async def video(req):
        autorizado(req)
        c = db.get_clip(int(req.match_info["id"]))
        if not c or not c.get("path") or not Path(c["path"]).exists():
            raise web.HTTPNotFound(text="El video ya no está en el servidor")
        r = web.FileResponse(c["path"])
        if req.query.get("d"):
            r.headers["Content-Disposition"] = f'attachment; filename="clip-{c["id"]}.mp4"'
        return r

    async def hecho(req):
        autorizado(req)
        cid = int(req.match_info["id"])
        db.kv_set(f"tt_hecho:{cid}", time.time())
        c = db.get_clip(cid)
        if c and len(pendientes(c["account"], VENTANA_LIMITE)) < 4:
            db.kv_set(f"tt_avisado:{c['account']}", 0)   # vuelve a avisar cuando se junten 4 otra vez
        return web.json_response({"ok": True})

    app = web.Application()
    app.add_routes([web.get("/borradores/", pagina), web.get("/borradores", pagina),
                    web.get("/borradores/video/{id}", video), web.post("/borradores/hecho/{id}", hecho)])
    return app


async def iniciar(cfg: dict, puerto: int = 4010):
    runner = web.AppRunner(crear_app(cfg))
    await runner.setup()
    await web.TCPSite(runner, "127.0.0.1", puerto).start()
