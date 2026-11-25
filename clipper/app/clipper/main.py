"""CLIPPER — orquestador.

  monitor  → detecta quién salió en vivo (Twitch/Kick/YouTube)
  recorder → graba con Streamlink en bloques de 10 min + lee el chat
  detector → busca picos (audio + chat + emotes) en cada bloque
  render   → corta el clip con 40 s de previa, lo pasa a vertical y le pone subtítulos
  discord  → te lo manda con botones Aprobar / Editar / Descartar
  publisher→ al aprobar, Post for Me lo publica en TikTok, Shorts, Reels y X
"""
import asyncio
from functools import partial
import calendar
import json
import re
import logging
import os
import shutil
import sys
import time
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import discord

from . import config, crm, db, publisher, render
from .chat import ChatBuffer, ChatReader
from . import juez, laugh, kickclips, holakase, web
from .detector import StreamDetector
from .recorder import Recording, check_live

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("clipper")
SENSIBLE_TITULO = re.compile(r"\b(desnud|tetas|teta |pechos|culo|nalga|lap ?dance|strip|strippe|stripper|bailarina|prostitut|puti|"
                             r"sexo|sexual|porno|porn|nude|naked|boob|tits|hentai|onlyfans|xxx|hot ?coffee|tacon)")

PLATFORM_ICON = {"twitch": "🟣", "kick": "🟢", "youtube": "🔴"}
STATUS_TXT = {
    "pending": "⏳ Esperando tu aprobación",
    "publishing": "📤 Publicando…",
    "published": "✅ Publicado",
    "queued": "🗓️ En cola (se publica",
    "partial": "⚠️ Publicado en parte",
    "rejected": "🗑️ Descartado",
    "failed": "⚠️ Falló la publicación",
}


class Live:
    def __init__(self, streamer, rec: Recording, chat: ChatReader, buf: ChatBuffer, det: StreamDetector):
        self.streamer, self.rec, self.chat, self.buf, self.det = streamer, rec, chat, buf, det
        self.pending_peaks: list[tuple[int, float]] = []  # (clip_id, peak_wall) esperando el siguiente bloque


class App:
    def __init__(self):
        self.cfg = config.load()
        db.init(self.cfg["data_dir"] / "clipper.db")
        self.streamers = config.streamers(self.cfg)
        self.live: dict[str, Live] = {}
        self.skipped_titles: dict[str, str] = {}
        self.check_pool = ThreadPoolExecutor(6)
        self.render_pool = ThreadPoolExecutor(1)   # un render a la vez: el VPS tiene 2 CPU
        self.work_pool = ThreadPoolExecutor(2)
        intents = discord.Intents.default()
        intents.message_content = True  # para leer el canal #notas
        self.bot = discord.Client(intents=intents)
        self.bot.event(self.on_ready)
        self.bot.event(self.on_interaction)
        self.bot.event(self.on_message)
        self.ch = {}  # nombre lógico → id de canal
        self._started = False
        self.avisado: dict[str, float] = {}  # último aviso de "en vivo" por streamer

    # ───────────────────────── Discord ─────────────────────────
    async def on_ready(self):
        log.info("Discord conectado como %s", self.bot.user)
        if self._started:
            return
        self._started = True
        await self.preparar_canales()
        n_es = sum(1 for s in self.streamers if s.account == "es")
        if self.cfg.get("origen", "streams") == "kick_clips":
            kc = self.cfg.get("kick_clips", {})
            await self.notify_live(f"Clipper en marcha. Revisando los clips más vistos de Kick de "
                                   f"{sum(1 for s in self.streamers if s.platform == 'kick')} streamers cada {kc.get('cada_minutos', 20)} min.")
        else:
            await self.notify_live(f"🤖 Clipper en marcha. Monitoreando {len(self.streamers)} streamers "
                                   f"({n_es} ES / {len(self.streamers) - n_es} EN) cada {self.cfg['monitor']['poll_seconds']} s.")
        for cid in db.kv_get("refresh_pending", []) or []:
            await self.refresh_message(int(cid), True)
        db.kv_set("refresh_pending", [])
        for c in db.q("SELECT id, scheduled_at FROM clips WHERE status IN ('queued','publishing')"):
            asyncio.create_task(self._guard(self.publish_clip(c['id'], max(0, int(c['scheduled_at'] or 0) - time.time()))))
        if self.cfg.get("origen", "streams") == "kick_clips":
            loops = (self.kick_clips_loop(), self.cleanup_loop(), self.recordatorios_loop(), self.holakase_loop())
        else:
            loops = (self.monitor_loop(), self.segments_loop(), self.cleanup_loop(), self.recordatorios_loop())
        for coro in loops:
            asyncio.create_task(self._guard(coro))
        if not getattr(self, "_web", False):
            self._web = True
            try:
                await web.iniciar(self.cfg, int(self.cfg.get("web", {}).get("puerto", 4010)))
                log.info("Página de borradores: %s", self.link_borradores())
            except Exception as e:
                log.warning("no pude abrir la página de borradores: %s", e)

    async def _guard(self, coro):
        try:
            await coro
        except Exception:
            log.exception("Tarea caída")

    async def channel(self, cid: int):
        if not cid:
            return None
        ch = self.bot.get_channel(int(cid))
        if ch is None:
            try:
                ch = await self.bot.fetch_channel(int(cid))
            except Exception as e:
                log.warning("No encuentro el canal %s: %s", cid, e)
        return ch

    CANALES = {"live": "en-vivo", "es": "clips-generados", "en": "clips-generados-en", "publicados": "clips-publicados",
               "recordatorios": "recordatorios", "notas": "notas"}
    RENOMBRAR = {"clips-es": "clips-generados", "clips-en": "clips-generados-en"}

    async def preparar_canales(self):
        """Crea (si faltan) los canales del bot en el servidor y guarda sus IDs. No hace falta copiar IDs a mano."""
        if not self.bot.guilds:
            log.error("El bot no está en ningún servidor. Invitalo con el link de instalación.")
            return
        g = self.bot.guilds[0]
        cat = discord.utils.get(g.categories, name="CLIPPER")
        if cat is None:
            try:
                cat = await g.create_category("CLIPPER")
            except discord.Forbidden:
                cat = None
        for viejo, nuevo in self.RENOMBRAR.items():
            c = discord.utils.get(g.text_channels, name=viejo)
            if c and not discord.utils.get(g.text_channels, name=nuevo):
                try:
                    await c.edit(name=nuevo)
                except discord.Forbidden:
                    log.warning("No pude renombrar #%s a #%s", viejo, nuevo)
        canales = dict(self.CANALES)
        for acc, a in (self.cfg.get("accounts") or {}).items():
            if a.get("enabled", True) or acc in canales:
                canales.setdefault(acc, f"clips-generados-{acc}")
        if self.cfg.get("holakase", {}).get("activo", True):
            canales["holakase"] = "holakase-plan"
        for key, name in canales.items():
            fijo = self.cfg["discord"].get("live_channel_id") if key == "live" else (
                self.cfg["accounts"].get(key, {}).get("review_channel_id") if key in self.cfg["accounts"] else 0)
            if fijo:
                self.ch[key] = int(fijo)
                continue
            c = discord.utils.get(g.text_channels, name=name)
            if c is None:
                try:
                    c = await g.create_text_channel(name, category=cat)
                except discord.Forbidden:
                    log.error("Sin permiso para crear #%s: crealo a mano o dale 'Gestionar canales' al bot", name)
                    continue
            self.ch[key] = c.id
        if not self.cfg["discord"].get("approver_ids"):
            self.cfg["discord"]["approver_ids"] = [g.owner_id]
        log.info("Canales: %s", self.ch)

    def approvers(self) -> list[int]:
        return [int(x) for x in self.cfg["discord"].get("approver_ids") or []]

    async def notify_live(self, text: str):
        ch = await self.channel(self.ch.get("live"))
        if ch:
            await ch.send(text)

    def clip_embed(self, clip: dict) -> discord.Embed:
        sig = json.loads(clip["signals"] or "{}")
        color = {"pending": 0xF1C40F, "published": 0x2ECC71, "queued": 0x3498DB, "partial": 0xE67E22, "rejected": 0x95A5A6,
                 "failed": 0xE74C3C}.get(clip["status"], 0x9B59B6)
        e = discord.Embed(title=f"{PLATFORM_ICON.get(clip['platform'], '')} {clip['streamer']} — clip #{clip['id']}", color=color)
        e.add_field(name="Título", value=clip["title"] or "—", inline=False)
        e.add_field(name="Texto del post", value=(clip["caption"] or "—")[:1000], inline=False)
        if "vistas" in sig:
            e.add_field(name="Clip de Kick", value=f"{sig['vistas']} vistas · \"{sig.get('titulo_kick', '')}\" · {sig.get('categoria', '')}"
                        + (f" · recortado {sig['corte']}" if sig.get("corte") else "")
                        + (f" · {sig['bucle']}" if sig.get("bucle") else "")
                        + (f" · {sig['tapado']}" if sig.get("tapado") else "")
                        + (f" · {sig['pitidos']} pitidos" if sig.get("pitidos") else ""), inline=False)
        else:
            e.add_field(name="Puntaje", value=f"{clip['score']} (audio {sig.get('audio')}, chat {sig.get('chat')}, emotes {sig.get('emotes')})", inline=False)
        if "nota_ia" in sig or "risa_s" in sig:
            extra = f" · Subtítulos del juego quitados: {sig['frases_juego']}" if sig.get("frases_juego") else ""
            e.add_field(name="Filtro de humor", value=f"Nota IA: {sig.get('nota_ia', '-')}/10 · Risa: {sig.get('risa_s', '-')} s{extra}\n{sig.get('motivo_ia', '')}"[:1000], inline=False)
        if clip["transcript"]:
            e.add_field(name="Qué se dice", value=clip["transcript"][:400], inline=False)
        st = STATUS_TXT.get(clip["status"], clip["status"])
        if clip["status"] == "queued" and clip["scheduled_at"]:
            st += f" a las {time.strftime('%H:%M', time.localtime(int(clip['scheduled_at'])))})"
        e.set_footer(text=st)
        return e

    def clip_view(self, clip: dict, active: bool = True) -> discord.ui.View:
        v = discord.ui.View(timeout=None)
        if active:
            v.add_item(discord.ui.Button(label="Aprobar y publicar", emoji="✅", style=discord.ButtonStyle.success, custom_id=f"clip:approve:{clip['id']}"))
            v.add_item(discord.ui.Button(label="Editar texto", emoji="✏️", style=discord.ButtonStyle.secondary, custom_id=f"clip:edit:{clip['id']}"))
            v.add_item(discord.ui.Button(label="Descartar", emoji="🗑️", style=discord.ButtonStyle.danger, custom_id=f"clip:reject:{clip['id']}"))
        return v

    async def send_clip(self, clip: dict):
        ch = await self.channel(self.ch.get(clip["account"]))
        if not ch:
            log.warning("Cuenta %s sin review_channel_id; clip %s queda sin enviar", clip["account"], clip["id"])
            return
        f = discord.File(clip["preview_path"], filename=f"clip_{clip['id']}.mp4")
        msg = await ch.send(embed=self.clip_embed(clip), file=f, view=self.clip_view(clip))
        db.update_clip(clip["id"], channel_id=ch.id, message_id=msg.id)
        self.contador()
        await self.auto_approve(db.get_clip(clip["id"]))

    async def refresh_message(self, clip_id: int, active: bool):
        clip = db.get_clip(clip_id)
        ch = await self.channel(clip["channel_id"])
        if not ch:
            return
        try:
            msg = await ch.fetch_message(clip["message_id"])
            await msg.edit(embed=self.clip_embed(clip), view=self.clip_view(clip, active))
        except Exception as e:
            log.warning("No pude actualizar el mensaje del clip %s: %s", clip_id, e)

    async def on_interaction(self, it: discord.Interaction):
        cid = (it.data or {}).get("custom_id", "")
        if not cid.startswith(("clip:", "nota:")):
            return
        if cid.startswith("nota:"):
            await self.nota_deshacer(it, cid)
            return
        approvers = self.approvers()
        if approvers and it.user.id not in approvers:
            await it.response.send_message("No tenés permiso para aprobar clips.", ephemeral=True)
            return
        parts = cid.split(":")
        action, clip_id = parts[1], int(parts[2])
        clip = db.get_clip(clip_id)
        if not clip:
            await it.response.send_message("Ese clip ya no existe.", ephemeral=True)
            return

        if it.type == discord.InteractionType.modal_submit:
            vals = {}

            def walk(node):
                if isinstance(node, dict):
                    if "custom_id" in node and "value" in node:
                        vals[node["custom_id"]] = node["value"]
                    for v in node.values():
                        walk(v)
                elif isinstance(node, list):
                    for v in node:
                        walk(v)
            walk(it.data.get("components", []))
            db.update_clip(clip_id, title=vals.get("title", clip["title"])[:95], caption=vals.get("caption", clip["caption"]))
            await it.response.edit_message(embed=self.clip_embed(db.get_clip(clip_id)), view=self.clip_view(db.get_clip(clip_id)))
            return

        if clip["status"] != "pending":
            await it.response.send_message(f"Este clip ya está: {STATUS_TXT.get(clip['status'], clip['status'])}", ephemeral=True)
            return

        if action == "edit":
            modal = discord.ui.Modal(title=f"Editar clip #{clip_id}", custom_id=f"clip:save:{clip_id}")
            modal.add_item(discord.ui.TextInput(label="Título (YouTube/TikTok)", custom_id="title", default=clip["title"], max_length=95))
            modal.add_item(discord.ui.TextInput(label="Texto del post", custom_id="caption", default=clip["caption"],
                                                style=discord.TextStyle.paragraph, max_length=2000))
            await it.response.send_modal(modal)
        elif action == "reject":
            db.update_clip(clip_id, status="rejected")
            await it.response.edit_message(embed=self.clip_embed(db.get_clip(clip_id)), view=self.clip_view(clip, False))
            for p in {clip["path"], clip["preview_path"]}:
                if p:
                    Path(p).unlink(missing_ok=True)
        elif action == "approve":
            self.approve(clip)
            await it.response.edit_message(embed=self.clip_embed(db.get_clip(clip_id)), view=self.clip_view(clip, False))

    def approve(self, clip: dict) -> float:
        """Pone el clip en la cola de publicación (respetando la separación entre posts)."""
        wait = publisher.next_slot(clip["account"], self.cfg["publishing"].get("min_gap_minutes", 20))
        db.update_clip(clip["id"], status="queued" if wait > 60 else "publishing", scheduled_at=str(int(time.time() + wait)))
        asyncio.create_task(self._guard(self.publish_clip(clip["id"], wait)))
        self.contador()
        return wait

    async def auto_approve(self, clip: dict) -> bool:
        """Aprueba solo los clips que Gemini calificó (la nota mínima ya se exige antes; si Gemini falló, queda a mano).
        También aprueba todo mientras esté activo el modo prueba (clipper auto-aprobar N días)."""
        until = float(db.kv_get("auto_approve_until", 0) or 0)
        nota = json.loads(clip.get("signals") or "{}").get("nota_ia")
        por_gemini = isinstance(nota, int) and self.cfg.get("filtro_humor", {}).get("auto_aprobar_gemini", True)
        if time.time() > until and not por_gemini:
            return False
        max_wait = self.cfg["publishing"].get("auto_max_queue_hours", 12) * 3600
        last = float(db.kv_get(f"last_post:{clip['account']}", 0) or 0)
        if last - time.time() > max_wait:
            log.info("auto-aprobación: cola de %s llena, clip %s queda para revisar a mano", clip["account"], clip["id"])
            return False
        self.approve(clip)
        await self.refresh_message(clip["id"], False)
        return True

    async def publish_clip(self, clip_id: int, wait: float = 0):
        if wait > 0:
            await asyncio.sleep(wait)
        if (db.get_clip(clip_id) or {}).get("status") not in ("queued", "publishing"):
            return
        db.update_clip(clip_id, status="publishing")
        await self.refresh_message(clip_id, False)
        clip = db.get_clip(clip_id)
        res = await asyncio.get_running_loop().run_in_executor(self.work_pool, publisher.publish_all, self.cfg, clip)
        ok = [r for r in res if r.get("ok")]
        status = "published" if len(ok) == len(res) else ("partial" if ok else "failed")
        db.update_clip(clip_id, status=status, result=res)
        self.contador()
        if status in ("published", "partial") and self.cfg["publishing"].get("delete_after_publish", True):
            self.borrar_archivos(clip)
        lines = []
        for r in res:
            name = publisher.LABEL.get(r["network"], r["network"])
            if not r.get("ok"):
                lines.append(f"❌ **{name}**: {r['msg']}")
            elif r.get("manual"):
                lines.append(f"📲 **{name}**: {r['msg']}")
            else:
                lines.append(f"✅ **{name}**: {r.get('url') or r['msg']}")
        if any(r.get("manual") for r in res):
            lines.append("Texto para pegar:\n```\n" + clip["caption"] + "\n```")
        ch = await self.channel(clip["channel_id"])
        if ch:
            try:
                msg = await ch.fetch_message(clip["message_id"])
                await msg.reply("\n".join(lines))
            except Exception:
                await ch.send(f"Clip #{clip_id}:\n" + "\n".join(lines))
        await self.refresh_message(clip_id, False)
        await self.anunciar_publicado(clip, res)
        for r in res:
            if r.get("borrador"):
                await self.avisar_borrador(clip)

    GUIA_TIKTOK = (
        "**Cómo publicar un borrador de TikTok (la primera vez, paso a paso)**\n"
        "1. Abrí la app de TikTok en el teléfono y entrá a la cuenta **{cuenta}** (si tenés varias: Perfil → tu nombre arriba → elegí la cuenta).\n"
        "2. Vas a tener una notificación tipo *\"Tu video está listo para editar\"*. Tocala. Si no la ves: Perfil → **Bandeja de entrada** "
        "(el ícono de mensajes) → **Notificaciones del sistema** o la sección de borradores.\n"
        "3. Se abre el editor con el video. No le cambies nada al video; tocá **Siguiente**.\n"
        "4. En la descripción pegá el texto que aparece en #clips-publicados para ese clip (texto + hashtags). Mantené apretado el mensaje en Discord → Copiar.\n"
        "5. Dejá **Quién puede ver: Todos**, comentarios activados, y tocá **Publicar**.\n"
        "6. Hacelo el mismo día: TikTok deja como máximo 5 borradores sin publicar en 24 horas; si se llenan, los siguientes no llegan.\n"
        "Después de esta vez te aviso con un mensaje corto cada vez que llegue uno nuevo."
    )

    def link_borradores(self, cuenta: str = "") -> str:
        base = self.cfg.get("web", {}).get("url", "https://consultoraprisma.digital/borradores/")
        return f"{base}?k={web.clave()}" + (f"&c={cuenta}" if cuenta else "")

    async def avisar_borrador(self, clip: dict):
        """Cuando una cuenta junta 4 borradores sin publicar, avisa en #recordatorios con el link a la página."""
        db.kv_set(f"tt_enviado:{clip['id']}", time.time())
        acc = clip["account"]
        n = len(web.pendientes(acc, web.VENTANA_LIMITE))
        aviso = int(self.cfg.get("web", {}).get("avisar_con", 4))
        if n < aviso:
            db.kv_set(f"tt_avisado:{acc}", 0)
            return
        if db.kv_get(f"tt_avisado:{acc}"):
            return
        ch = await self.channel(self.ch.get("recordatorios"))
        if not ch:
            return
        db.kv_set(f"tt_avisado:{acc}", time.time())
        cuenta = self.cfg["accounts"].get(acc, {}).get("nombre_tiktok", acc)
        try:
            await ch.send(f"@here **{cuenta}** tiene {n} borradores de TikTok sin publicar (el límite es 5). "
                          f"Publicalos desde acá, con el video y la descripción para copiar:\n{self.link_borradores(acc)}")
        except Exception as e:
            log.warning("no pude avisar los borradores: %s", e)

    async def anunciar_publicado(self, clip: dict, res: list):
        """Deja en #clips-publicados una línea por clip subido, con el link de cada plataforma."""
        subidos = [r for r in res if r.get("ok")]
        ch = await self.channel(self.ch.get("publicados"))
        if not ch or not subidos:
            return
        e = discord.Embed(title=f"{clip['streamer']} — clip #{clip['id']}", color=0x2ECC71,
                          description=(clip.get("caption") or "").split("\n")[0][:200])
        for r in subidos:
            nombre = publisher.LABEL.get(r["network"], r["network"])
            e.add_field(name=nombre, value=("borrador en la app" if r.get("manual") and r["network"] == "tiktok"
                                            else "subir a mano" if r.get("manual") else (r.get("url") or "subido")), inline=True)
        e.set_footer(text=f"Cuenta {clip.get('account', '')}")
        try:
            await ch.send(embed=e)
        except Exception as ex:
            log.warning("no pude avisar en #clips-publicados: %s", ex)

    def borrar_archivos(self, clip: dict):
        """Borra del servidor el video final, la vista previa y la transcripción del clip.
        Queda solo una fila mínima (fecha y estado) para el contador del CRM.
        Si hace falta subirlo a mano, el video sigue adjunto en el mensaje de Discord."""
        for p in {clip.get("path"), clip.get("preview_path")}:
            if p:
                Path(p).unlink(missing_ok=True)
        db.update_clip(clip["id"], path=None, preview_path=None, transcript=None)
        log.info("Clip %s publicado: archivos borrados del servidor", clip["id"])

    # ───────────────────────── CRM: contador, notas y recordatorios ─────────────────────────
    def contador(self):
        """Manda al CRM cuántos clips se crearon / aprobaron / publicaron hoy."""
        if not crm.activo():
            return
        hoy = datetime.now(crm.TZ)
        t0 = hoy.replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
        rows = db.q("SELECT status FROM clips WHERE created >= ? AND status != 'render_failed' AND status != 'rendering'", (t0,))
        aprob = [r for r in rows if r["status"] in ("queued", "publishing", "published", "partial", "failed")]
        publ = [r for r in rows if r["status"] in ("published", "partial")]
        asyncio.get_running_loop().run_in_executor(self.work_pool, crm.contador_clips, hoy.strftime("%Y-%m-%d"), len(rows), len(aprob), len(publ))

    async def on_message(self, m: discord.Message):
        if m.author.bot or m.channel.id != self.ch.get("notas") or not m.content.strip():
            return
        if self.approvers() and m.author.id not in self.approvers():
            return
        if not crm.activo():
            await m.reply("⚠️ Falta conectar el CRM (PUENTE_CLAVE). Corré `clipper setup` en el VPS.")
            return
        loop = asyncio.get_running_loop()
        try:
            n = await loop.run_in_executor(self.work_pool, crm.interpretar_nota, m.content)
            ev = await loop.run_in_executor(self.work_pool, crm.crear_evento, n["fecha"], n["hora"], n["titulo"], m.content)
        except Exception as e:
            await m.reply(f"⚠️ No pude agendarlo: {e}")
            return
        d = datetime.strptime(n["fecha"], "%Y-%m-%d")
        dia = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"][d.weekday()]
        v = discord.ui.View(timeout=None)
        v.add_item(discord.ui.Button(label="Deshacer", emoji="↩️", style=discord.ButtonStyle.secondary, custom_id=f"nota:deshacer:{ev['id']}"))
        await m.reply(f"📅 Agendado en tu panel: **{n['titulo']}** — {dia} {d:%d/%m}{' a las ' + n['hora'] if n['hora'] else ' (sin hora)'}", view=v)

    async def nota_deshacer(self, it: discord.Interaction, cid: str):
        if self.approvers() and it.user.id not in self.approvers():
            await it.response.send_message("No tenés permiso.", ephemeral=True)
            return
        await asyncio.get_running_loop().run_in_executor(self.work_pool, crm.borrar_evento, cid.split(":", 2)[2])
        await it.response.edit_message(content="↩️ Deshecho: lo saqué del calendario.", view=None)

    async def recordatorios_loop(self):
        """Cada minuto mira la agenda del CRM y avisa en #recordatorios: resumen a las 08:00 y cada cosa a su hora."""
        loop = asyncio.get_running_loop()
        hora_resumen = self.cfg.get("recordatorios", {}).get("resumen", "08:00")
        anticipo = int(self.cfg.get("recordatorios", {}).get("minutos_antes", 10))
        while True:
            await asyncio.sleep(60)
            if not crm.activo() or not self.ch.get("recordatorios"):
                continue
            try:
                ahora = datetime.now(crm.TZ)
                hoy = ahora.strftime("%Y-%m-%d")
                dia = (await loop.run_in_executor(self.work_pool, crm.agenda, hoy))[0]
                ch = await self.channel(self.ch["recordatorios"])
                hhmm = ahora.strftime("%H:%M")
                if hhmm >= hora_resumen and not db.kv_get(f"resumen:{hoy}"):
                    db.kv_set(f"resumen:{hoy}", True)
                    tareas = [t for t in dia["tareas"] if not t.get("hecha")]
                    lineas = [f"☀️ **Tu día — {ahora:%d/%m}**"]
                    lineas += [f"• {t.get('hora') or '—'} · {t['titulo']}" for t in tareas] or ["• Sin objetivos pendientes."]
                    if dia["eventos"]:
                        lineas.append("**Agenda**")
                        lineas += [f"• {e.get('hora') or '—'} · {e['titulo']}" for e in dia["eventos"]]
                    if dia["contenidos"]:
                        lineas.append("**Para publicar**")
                        lineas += [f"• {c.get('formato')} · {c.get('idea_ganadora', '')[:80]}" for c in dia["contenidos"]]
                    await ch.send("\n".join(lineas))
                limite = (ahora + timedelta(minutes=anticipo)).strftime("%H:%M")
                items = [("tarea", t) for t in dia["tareas"] if not t.get("hecha")] + [("evento", e) for e in dia["eventos"]]
                for tipo, x in items:
                    h = x.get("hora")
                    clave = f"rec:{x['id']}:{hoy}"
                    if h and hhmm <= h <= limite and not db.kv_get(clave):
                        db.kv_set(clave, True)
                        await ch.send(f"⏰ **{h}** · {x['titulo']}" + (f"\n{x.get('detalle') or x.get('notas') or ''}" if (x.get('detalle') or x.get('notas')) and tipo == "tarea" else ""))
            except Exception as e:
                log.warning("recordatorios: %s", e)

    # ───────────────────────── Monitor ─────────────────────────
    def _keyword_ok(self, s, info: dict) -> bool:
        kws = list(s.keywords) if s.keywords is not None else [k.lower() for k in self.cfg["monitor"].get("require_keywords") or []]
        if not kws:
            return True
        txt = f"{info.get('title', '')} {info.get('category', '')}".lower()
        return any(k in txt for k in kws)

    async def monitor_loop(self):
        loop = asyncio.get_running_loop()
        mon = self.cfg["monitor"]
        while True:
            # 1) grabaciones que terminaron
            for key, lv in list(self.live.items()):
                if not lv.rec.running:
                    await self.finish(key, lv)
            # 2) quién está en vivo
            idle = [s for s in self.streamers if s.key not in self.live]
            results = await asyncio.gather(*[loop.run_in_executor(self.check_pool, check_live, s.url) for s in idle])
            for s, info in zip(idle, results):
                if not info:
                    self.skipped_titles.pop(s.key, None)
                    continue
                if not self._keyword_ok(s, info):
                    if self.skipped_titles.get(s.key) != info["title"]:
                        log.info("%s en vivo pero no coincide con las palabras clave: %s / %s", s.name, info["category"], info["title"])
                        self.skipped_titles[s.key] = info["title"]
                    continue
                if len(self.live) >= mon["max_concurrent_recordings"]:
                    log.warning("Límite de grabaciones simultáneas; %s queda en espera", s.name)
                    continue
                await self.start(s, info)
            await asyncio.sleep(mon["poll_seconds"])

    async def start(self, s, info):
        sid = db.q("INSERT INTO streams(skey,account,streamer,platform,title,started) VALUES(?,?,?,?,?,?)",
                   (s.key, s.account, s.name, s.platform, info["title"], time.time()))
        rec = Recording(s, sid, self.cfg["data_dir"] / "segments" / s.key.replace(":", "_"),
                        self.cfg["recording"]["segment_seconds"], self.cfg["monitor"]["quality"])
        rec.start()
        buf = ChatBuffer()
        chat = ChatReader(s.platform, s.channel, s.url, buf)
        chat.start(asyncio.get_running_loop())
        det = StreamDetector(self.cfg)
        det.lag = float(db.kv_get(f"chat_lag:{s.key}", det.lag) or det.lag)
        self.live[s.key] = Live(s, rec, chat, buf, det)
        if time.time() - self.avisado.get(s.key, 0) < 3 * 3600:
            return
        self.avisado[s.key] = time.time()
        await self.notify_live(f"{PLATFORM_ICON.get(s.platform, '')} **{s.name}** salió en vivo ({s.account.upper()}) — "
                               f"_{info['title'][:120]}_ · {info['category']}\n⏺️ Empezando a grabar el stream. {s.url}")

    async def finish(self, key: str, lv: Live):
        await self.process_segments(lv, final=True)
        lv.chat.stop()
        db.q("UPDATE streams SET ended=? WHERE id=?", (time.time(), lv.rec.stream_id))
        self.live.pop(key, None)
        log.info("%s terminó / se cortó la grabación", lv.streamer.name)
        if time.time() - lv.rec.started > 600:
            await self.notify_live(f"⏹️ **{lv.streamer.name}** terminó (o se cortó la grabación).")
        else:
            log.warning("La grabación de %s se cortó enseguida; ver %s/rec.log", lv.streamer.name, lv.rec.dir)
        await asyncio.sleep(1)
        shutil.rmtree(lv.rec.dir, ignore_errors=True)

    # ───────────────────────── Bloques → clips ─────────────────────────
    async def segments_loop(self):
        while True:
            for lv in list(self.live.values()):
                try:
                    await self.process_segments(lv)
                except Exception:
                    log.exception("procesando bloques de %s", lv.streamer.name)
            await asyncio.sleep(15)

    async def process_segments(self, lv: Live, final: bool = False):
        loop = asyncio.get_running_loop()
        d = self.cfg["detection"]
        for seg in lv.rec.new_segments():
            path, w0, w1 = seg
            msgs = lv.buf.window(w0 - 30, w1 + 30)
            peaks, _ = await loop.run_in_executor(self.work_pool, lv.det.score_segment, path, w0, msgs, lv.buf.alive)
            if lv.det.lag_info:
                db.kv_set(f"chat_lag:{lv.streamer.key}", lv.det.lag)
                db.kv_set(f"chat_lag_info:{lv.streamer.key}", lv.det.lag_info)
                log.info("Retraso del chat de %s: %.1f s (%s)", lv.streamer.name, lv.det.lag, lv.det.lag_info)
            for wall, score, sig in peaks:
                clip_id = db.q("INSERT INTO clips(stream_id,account,streamer,platform,tag,peak_wall,score,signals,status,created) "
                               "VALUES(?,?,?,?,?,?,?,?,?,?)", (lv.rec.stream_id, lv.streamer.account, lv.streamer.name,
                                                               lv.streamer.platform, lv.streamer.tag, wall, score, json.dumps(sig), "rendering", time.time()))
                log.info("Pico en %s: score %s %s → clip %s", lv.streamer.name, score, sig, clip_id)
                lv.pending_peaks.append((clip_id, wall))
        # renderizar los picos que ya tienen cubierto el "después"
        last_end = lv.rec.segments[-1][2] if lv.rec.segments else 0
        ready = [p for p in lv.pending_peaks if final or p[1] + d["post_seconds"] <= last_end]
        for p in ready:
            lv.pending_peaks.remove(p)
            asyncio.create_task(self._guard(self.make_clip(lv.streamer, p[0], partial(render.preparar, self.cfg, lv.streamer, list(lv.rec.segments), p[1]))))
        lv.rec.cleanup(self.cfg["recording"]["keep_segments_minutes"])

    async def make_clip(self, streamer, clip_id: int, prep, kick: bool = False, contexto: str = ""):
        """Corta → transcribe → filtros (habla, risa, juez Gemini) → recién ahí render final → Discord.
        Los clips descartados no gastan el render final."""
        loop = asyncio.get_running_loop()
        f = self.cfg.get("filtro_humor", {})
        sig = json.loads((db.get_clip(clip_id) or {}).get("signals") or "{}")
        ctx = None

        def rechazar(motivo):
            log.info("Clip %s descartado: %s", clip_id, motivo)
            if ctx:
                render.descartar(ctx)
            db.update_clip(clip_id, status="rejected", path=None, preview_path=None, signals=json.dumps(sig), result={"motivo": motivo})

        try:
            ctx = await loop.run_in_executor(self.render_pool, prep)
            n_words = len((ctx.get("transcript") or "").split())
            if n_words < (self.cfg.get("kick_clips", {}).get("min_words", 4) if kick else self.cfg["detection"].get("min_words", 15)):
                return rechazar(f"casi no se habla ({n_words} palabras)")
            ctx["proxy"] = await loop.run_in_executor(self.render_pool, render.proxy, self.cfg, ctx)
        except Exception as e:
            log.exception("preparando clip %s", clip_id)
            if ctx:
                render.descartar(ctx)
            db.update_clip(clip_id, status="render_failed", result={"error": str(e)})
            return

        if f.get("risa", True) and laugh.disponible():
            try:
                r = await loop.run_in_executor(self.work_pool, laugh.risas, ctx["proxy"])
                sig["risa_s"] = r["segundos"]
                if not kick and r["segundos"] < f.get("min_risa_segundos", 0.4) and float(sig.get("chat", 0)) < f.get("chat_sin_risa", 6):
                    return rechazar(f"sin risa ({r['segundos']} s)")
            except Exception as e:
                log.warning("detector de risa falló en clip %s: %s", clip_id, e)

        quitar, gancho, tags = [], None, []
        if f.get("gemini", True) and juez.activo(streamer.account):
            try:
                j = await loop.run_in_executor(self.work_pool, juez.juzgar, ctx["proxy"], streamer.name, render.frases(ctx["words"]), contexto, streamer.account)
                sig["nota_ia"] = j["nota"]
                sig["motivo_ia"] = j.get("motivo", "")[:200]
                if j["nota"] < f.get("nota_minima", 7):
                    return rechazar(f"nota IA {j['nota']}: {j.get('motivo', '')}")
                juego = (j.get("juego") or "").lower()
                if self.cfg.get("kick", {}).get("solo_gta6", True) and juego and not re.search(r"gta ?(vi|6)|grand theft auto (vi|6)", juego):
                    return rechazar(f"no es GTA VI (Gemini ve: {j.get('juego')})")
                if not j.get("sensibles") and re.search(r"desnud|sexual|semidesnud|nude|porno|topless", render._norm_frase(j.get("motivo", ""))):
                    return rechazar("Gemini menciona desnudo o contenido sexual en el motivo")
                if j.get("contenido_sexual"):
                    return rechazar("la gracia depende de contenido sexual o desnudos (riesgo de penalización)")
                if j.get("sensibles"):
                    ctx["sensibles"] = j["sensibles"]
                quitar, gancho, tags = j.get("frases_juego") or [], j.get("gancho") or None, j.get("hashtags") or []
                if quitar:
                    sig["frases_juego"] = len(quitar)
                if j.get("remate"):
                    ctx["remate"] = j["remate"]
                if j.get("corte"):
                    ctx["corte"] = j["corte"]
                    sig["corte"] = f"{j['corte'][0]:.0f}-{j['corte'][1]:.0f} s"
            except Exception as e:
                log.warning("juez Gemini falló en clip %s (pasa igual): %s", clip_id, e)
                sig["nota_ia"] = "error"

        # título que sugiere contenido sexual y nadie marcó la escena: se tapa el clip entero con la cámara
        if not ctx.get("sensibles") and SENSIBLE_TITULO.search(render._norm_frase(contexto)):
            if (ctx.get("layout") or {}).get("kind") != "split":
                return rechazar("el título sugiere contenido sexual y no hay cámara del streamer para taparlo")
            ctx["sensibles"] = [(0.0, 10_000.0)]
        try:
            out = await loop.run_in_executor(self.render_pool, render.finalizar, self.cfg, streamer, ctx, quitar, gancho, tags)
            if ctx.get("cubierto_s"):
                sig["tapado"] = f"cámara a pantalla completa {ctx['cubierto_s']} s (escena sensible)"
            if ctx.get("pitidos"):
                sig["pitidos"] = ctx["pitidos"]
            if ctx.get("bucle"):
                sig["bucle"] = f"arranca con el remate ({ctx['bucle']} s)"
        except Exception as e:
            log.exception("render clip %s", clip_id)
            render.descartar(ctx)
            db.update_clip(clip_id, status="render_failed", result={"error": str(e)})
            return
        out["signals"] = json.dumps(sig)
        db.update_clip(clip_id, status="pending", **out)
        await self.send_clip(db.get_clip(clip_id))

    # ───────────────────────── Holakase: plan de contenido ─────────────────────────
    async def holakase_loop(self):
        """Sábado por medio a las 09:00 genera el plan de las 2 semanas siguientes y lo pasa al calendario."""
        hk = self.cfg.get("holakase", {})
        if not hk.get("activo", True):
            return
        loop = asyncio.get_running_loop()
        await asyncio.sleep(30)
        if crm.activo() and not db.kv_get("holakase_agenda"):
            try:
                await loop.run_in_executor(self.work_pool, self._agendar_planificacion)
                db.kv_set("holakase_agenda", True)
            except Exception as e:
                log.warning("holakase: no pude agendar los sábados: %s", e)
        while True:
            try:
                ahora = datetime.now(crm.TZ)
                primero = datetime.strptime(hk.get("primer_sabado", "2026-11-28"), "%Y-%m-%d").date()
                dias = (ahora.date() - primero).days
                if db.kv_get("holakase_forzar"):
                    db.kv_set("holakase_forzar", False)
                    await self.plan_holakase()
                elif (dias >= 0 and dias % 14 == 0 and ahora.strftime("%H:%M") >= hk.get("hora_plan", "09:00")
                        and not db.kv_get(f"holakase_plan:{ahora:%Y-%m-%d}")):
                    db.kv_set(f"holakase_plan:{ahora:%Y-%m-%d}", True)
                    await self.plan_holakase()
            except Exception as e:
                log.warning("holakase: %s", e)
            await asyncio.sleep(300)

    def _agendar_planificacion(self):
        hk = self.cfg.get("holakase", {})
        d = datetime.strptime(hk.get("primer_sabado", "2026-11-28"), "%Y-%m-%d")
        for i in range(hk.get("semanas_agenda", 26) // 2):
            crm.crear_evento((d + timedelta(days=14 * i)).strftime("%Y-%m-%d"), hk.get("hora_plan", "09:00"),
                             "Holakase: revisar el plan de contenido de las próximas 2 semanas",
                             "El bot lo genera solo y lo deja en #holakase-plan y en el calendario. Revisalo y ajustá lo que no te guste.")

    async def plan_holakase(self, desde: datetime | None = None):
        hk = self.cfg.get("holakase", {})
        loop = asyncio.get_running_loop()
        ch = await self.channel(self.ch.get("holakase"))
        try:
            plan = await loop.run_in_executor(self.work_pool, holakase.generar_plan, 14, hk.get("creditos_dia", 50),
                                              hk.get("costo_toma", 10))
        except Exception as e:
            if ch:
                await ch.send(f"No pude generar el plan de Holakase: {e}")
            return
        inicio = (desde or datetime.now(crm.TZ)) + timedelta(days=1)
        if ch:
            await ch.send(f"**Plan de Holakase — {inicio:%d/%m} al {inicio + timedelta(days=13):%d/%m}** (1 video por día, "
                          f"{len(plan[0]['tomas'])} tomas de 8 s en Flow)")
        for i, d in enumerate(plan):
            fecha = (inicio + timedelta(days=i)).strftime("%Y-%m-%d")
            tomas = "\n".join(f"Toma {k + 1}: {t}" for k, t in enumerate(d["tomas"]))
            texto = (f"**{fecha} · {d.get('titulo', '')}**\nGancho en pantalla: {d.get('gancho', '')}\n{tomas}\n"
                     f"Texto del post: {d.get('texto_post', '')}\n" + " ".join("#" + h.lstrip("#") for h in d.get("hashtags", [])))
            if ch:
                for k in range(0, len(texto), 1900):
                    await ch.send(texto[k:k + 1900])
            if crm.activo():
                try:
                    await loop.run_in_executor(self.work_pool, crm.crear_evento, fecha, hk.get("hora_video", "10:00"),
                                               f"Holakase: crear video — {d.get('titulo', '')}", texto.replace("**", "")[:1800])
                except Exception as e:
                    log.warning("holakase: evento %s: %s", fecha, e)

    # ───────────────────────── Clips del público en Kick ─────────────────────────
    async def kick_clips_loop(self):
        loop = asyncio.get_running_loop()
        while True:
            kc = self.cfg.get("kick_clips", {})
            cats = [c.lower() for c in kc.get("categorias") or []]
            for s in [s for s in self.streamers if s.platform == "kick"]:
                try:
                    clips = await loop.run_in_executor(self.check_pool, kickclips.top, s.channel, kc.get("periodo", "day"))
                except Exception as e:
                    log.warning("clips de Kick de %s: %s", s.name, e)
                    continue
                nuevos = 0
                for c in clips:
                    if nuevos >= kc.get("max_por_streamer", 2):
                        break
                    if c["views"] < kc.get("min_vistas", 30):
                        break  # vienen ordenados por vistas
                    if not kc.get("min_segundos", 6) <= c["duration"] <= kc.get("max_segundos", 75):
                        continue
                    if cats and not any(k in c["categoria"].lower() for k in cats):
                        continue
                    if db.kv_get(f"kick_clip:{c['id']}"):
                        continue
                    db.kv_set(f"kick_clip:{c['id']}", int(time.time()))
                    sig = {"vistas": c["views"], "kick": c["id"], "titulo_kick": c["title"][:100], "categoria": c["categoria"]}
                    clip_id = db.q("INSERT INTO clips(stream_id,account,streamer,platform,tag,peak_wall,score,signals,status,created) "
                                   "VALUES(?,?,?,?,?,?,?,?,?,?)", (0, s.account, s.name, "kick", s.tag, time.time(), c["views"],
                                                                   json.dumps(sig, ensure_ascii=False), "rendering", time.time()))
                    log.info("Clip de Kick de %s (%s vistas): %s → clip %s", s.name, c["views"], c["title"], clip_id)
                    nuevos += 1
                    await self._guard(self.make_clip(s, clip_id, partial(render.preparar_archivo, self.cfg, s, c["url"]),
                                                     kick=True, contexto=c["title"]))
            await asyncio.sleep(kc.get("cada_minutos", 20) * 60)

    # ───────────────────────── Resultados y limpieza ─────────────────────────
    async def cleanup_loop(self):
        while True:
            # bloques crudos huérfanos (de streams que ya no se graban o de antes de un reinicio)
            keep_s = self.cfg["recording"]["keep_segments_minutes"] * 60 + 900
            live_dirs = {str(lv.rec.dir) for lv in self.live.values()}
            for d in (self.cfg["data_dir"] / "segments").glob("*"):
                if not d.is_dir():
                    continue
                for f in d.iterdir():
                    try:
                        if f.stat().st_mtime < time.time() - keep_s and (str(d) not in live_dirs or f.suffix in (".ts", ".csv")):
                            f.unlink(missing_ok=True)
                    except (FileNotFoundError, IsADirectoryError):
                        pass
                try:
                    if str(d) not in live_dirs and not any(d.iterdir()) and d.stat().st_mtime < time.time() - keep_s:
                        d.rmdir()
                except OSError:
                    pass
            # clips que quedaron a medio renderizar por un reinicio
            for c in db.q("SELECT id FROM clips WHERE status='rendering' AND created < ?", (time.time() - 3600,)):
                db.update_clip(c["id"], status="render_failed")
            cutoff = time.time() - 2 * 86400
            # clips sin revisar por más de 2 días: vencen y se borran
            db.q("UPDATE clips SET status='rejected' WHERE status='pending' AND created < ?", (cutoff,))
            for c in db.q("SELECT * FROM clips WHERE created < ? AND status IN ('published','rejected','failed','partial','render_failed')", (cutoff,)):
                # los borradores de TikTok sin publicar se guardan 4 días para la página de borradores
                if (db.kv_get(f"tt_enviado:{c['id']}") and not db.kv_get(f"tt_hecho:{c['id']}")
                        and c["created"] > time.time() - web.VENTANA_PAGINA):
                    continue
                for p in {c["path"], c["preview_path"]}:
                    if p:
                        Path(p).unlink(missing_ok=True)
            for p in (self.cfg["data_dir"] / "tmp").glob("*"):
                if p.stat().st_mtime < time.time() - 6 * 3600:
                    p.unlink(missing_ok=True)
            await asyncio.sleep(1800)

    def run(self):
        self.bot.run(config.env("DISCORD_BOT_TOKEN"), log_handler=None)


# ───────────────────────── CLI ─────────────────────────
def _ask(prompt, secret=False):
    import getpass
    return (getpass.getpass(prompt) if secret else input(prompt)).strip()


def cli():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "run"
    arg = sys.argv[2] if len(sys.argv) > 2 else "es"
    if cmd == "run":
        App().run()
    elif cmd == "holakase-plan":
        db.init(config.load()["data_dir"] / "clipper.db")
        db.kv_set("holakase_forzar", True)
        print("Listo: en menos de 5 minutos el bot genera el plan de Holakase y lo deja en #holakase-plan y en el calendario.")
    elif cmd == "check":
        cfg = config.load()
        for s in config.streamers(cfg):
            info = check_live(s.url)
            print(f"[{s.account}] {s.name:<12} {s.platform:<8} {'EN VIVO: ' + info['category'] + ' / ' + info['title'][:60] if info else 'offline'}")
    elif cmd == "meta-login":
        cfg = config.load()
        print("Graph API Explorer → tu app → permisos: pages_show_list, pages_read_engagement, pages_manage_posts,\n"
              "instagram_basic, instagram_content_publish, business_management → Generate Access Token.")
        app_id = _ask("App ID de Meta: ")
        app_secret = _ask("App Secret de Meta: ", True)
        short = _ask("Token de usuario (Graph API Explorer): ", True)
        pages = publisher.meta_login(arg, app_id, app_secret, short, cfg)
        for i, p in enumerate(pages):
            ig = p.get("instagram_business_account") or {}
            print(f"  [{i}] Página: {p['name']}  ·  Instagram: @{ig.get('username', '— sin Instagram vinculado')}")
        p = pages[int(_ask("Número de la página a usar: ") or 0)]
        ig = p.get("instagram_business_account") or {}
        s = publisher.load_secrets()
        s.setdefault("meta", {})[arg] = {"page_id": p["id"], "page_name": p["name"], "page_token": p["access_token"],
                                         "ig_user_id": ig.get("id"), "ig_username": ig.get("username")}
        publisher.save_secrets(s)
        print(f"✅ Meta conectado para '{arg}': Facebook {p['name']} / Instagram @{ig.get('username')}")
    elif cmd == "tiktok-login":
        s = publisher.load_secrets()
        app = s.get("tiktok_app") or {}
        if not app:
            app = {"client_key": _ask("Client key de tu app de TikTok: "), "client_secret": _ask("Client secret: ", True),
                   "redirect_uri": _ask("Redirect URI registrada (ej. https://consultoraprisma.digital/): ")}
            s["tiktok_app"] = app
            publisher.save_secrets(s)
        state = os.urandom(8).hex()
        print("\n1) Abrí este link con la cuenta de TikTok donde se van a publicar los clips y aceptá:\n")
        print(publisher.tiktok_auth_url(app["client_key"], app["redirect_uri"], state))
        url = _ask("\n2) Pegá acá la dirección completa a la que te llevó TikTok: ")
        q = dict(__import__("urllib.parse").parse.parse_qsl(__import__("urllib.parse").parse.urlparse(url).query))
        tok = publisher.tiktok_exchange(app["client_key"], app["client_secret"], q["code"], app["redirect_uri"])
        s = publisher.load_secrets()
        s.setdefault("tiktok", {})[arg] = tok
        publisher.save_secrets(s)
        print(f"✅ TikTok conectado para '{arg}'")
    elif cmd == "youtube-login":
        import urllib.parse as up
        s = publisher.load_secrets()
        app = s.get("google_app") or {"client_id": _ask("Client ID (OAuth, app de escritorio): "), "client_secret": _ask("Client secret: ", True)}
        s["google_app"] = app
        publisher.save_secrets(s)
        redirect = "http://localhost:8765/"
        print("\n1) Abrí este link con la cuenta del canal y aceptá:\n")
        print("https://accounts.google.com/o/oauth2/v2/auth?" + up.urlencode({"client_id": app["client_id"], "redirect_uri": redirect,
              "response_type": "code", "scope": "https://www.googleapis.com/auth/youtube.upload", "access_type": "offline", "prompt": "consent"}))
        url = _ask("\n2) La página va a dar error (es normal). Pegá la dirección completa de esa página: ")
        code = dict(up.parse_qsl(up.urlparse(url).query))["code"]
        import requests as rq
        j = rq.post("https://oauth2.googleapis.com/token", data={"client_id": app["client_id"], "client_secret": app["client_secret"],
                    "code": code, "grant_type": "authorization_code", "redirect_uri": redirect}, timeout=30).json()
        s = publisher.load_secrets()
        s.setdefault("youtube", {})[arg] = {"refresh_token": j["refresh_token"]}
        publisher.save_secrets(s)
        print(f"✅ YouTube conectado para '{arg}'")
    elif cmd == "auto-aprobar":
        db.init(config.load()["data_dir"] / "clipper.db")
        dias = float(sys.argv[2]) if len(sys.argv) > 2 else 7
        db.kv_set("auto_approve_until", time.time() + dias * 86400 if dias > 0 else 0)
        print(f"✅ Auto-aprobación {'activa por %g días' % dias if dias > 0 else 'apagada'}")
    elif cmd == "devolver-cola":
        cfg = config.load()
        db.init(cfg["data_dir"] / "clipper.db")
        ids = [r["id"] for r in db.q("SELECT id FROM clips WHERE status='queued'")]
        for i in ids:
            db.update_clip(i, status="pending", scheduled_at=None)
        for acc in cfg["accounts"]:
            db.kv_set(f"last_post:{acc}", 0)
        db.kv_set("refresh_pending", ids)
        print(f"↩️  {len(ids)} clips volvieron a 'pendiente' (reiniciá: clipper restart)")
    elif cmd == "retrasos":
        db.init(config.load()["data_dir"] / "clipper.db")
        for r in db.q("SELECT k, v FROM kv WHERE k LIKE 'chat_lag:%' ORDER BY k"):
            info = db.kv_get(r["k"].replace("chat_lag:", "chat_lag_info:"), {})
            print(f"{r['k'][9:]:<40} {float(db.kv_get(r['k'])):>5.1f} s   {info}")
    elif cmd == "status-redes":
        s = publisher.load_secrets()
        for k in ("meta", "tiktok", "youtube"):
            print(f"{k:<8}", ", ".join(s.get(k, {}).keys()) or "— sin conectar")
    else:
        print("uso: clipper [run|check|meta-login es|tiktok-login es|youtube-login es|status-redes|auto-aprobar DIAS|retrasos]")


if __name__ == "__main__":
    cli()
