"""Capa de publicación propia, con la misma forma que Post for Me.

Cada red es un "provider" con un único método publish(clip, cfg) → dict.
Cuando más adelante se pague Post for Me, se cambia el provider de cada red
en config.yaml (provider: postforme) y el resto del sistema no se toca.

Estado de cada red SIN pagar nada (noviembre 2026):
  • instagram / facebook  → automático (Graph API de Meta, app en modo desarrollo)
  • tiktok                → borrador en tu bandeja de TikTok: lo publicás con un toque
                            (TikTok solo deja publicar en público a apps auditadas)
  • youtube               → manual hasta que Google audite tu proyecto
                            (las apps sin auditar solo pueden subir videos privados)
"""
import json
import logging
import os
import secrets as pysecrets
import time
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

from . import db

log = logging.getLogger("publisher")
GRAPH = "https://graph.facebook.com"


# ───────────────────────── credenciales (archivo local, chmod 600) ─────────────────────────
class NoConectado(RuntimeError):
    """La red todavía no está conectada: el clip se entrega para subir a mano."""


def _secrets_path() -> Path:
    return Path(os.environ.get("CLIPPER_SECRETS", "/opt/clipper/data/secrets.json"))


def load_secrets() -> dict:
    p = _secrets_path()
    return json.loads(p.read_text()) if p.exists() else {}


def save_secrets(s: dict):
    p = _secrets_path()
    p.write_text(json.dumps(s, indent=2))
    os.chmod(p, 0o600)


# ───────────────────────── Meta: Instagram Reels + Facebook Reels ─────────────────────────
class Meta:
    def __init__(self, cfg):
        self.v = cfg["publishing"].get("graph_version", "v23.0")

    def _acc(self, account):
        m = load_secrets().get("meta", {}).get(account)
        if not m:
            raise NoConectado(f"Meta no está conectado para la cuenta '{account}'. Corré: clipper meta-login {account}")
        return m

    def instagram(self, clip, cfg):
        m = self._acc(clip["account"])
        tok, ig = m["page_token"], m["ig_user_id"]
        size = os.path.getsize(clip["path"])
        r = requests.post(f"{GRAPH}/{self.v}/{ig}/media", timeout=60, data={
            "media_type": "REELS", "upload_type": "resumable", "caption": clip["caption"][:2200],
            "share_to_feed": "true", "access_token": tok})
        r.raise_for_status()
        cont = r.json()
        with open(clip["path"], "rb") as f:
            up = requests.post(cont["uri"], data=f, timeout=600, headers={
                "Authorization": f"OAuth {tok}", "offset": "0", "file_size": str(size)})
        up.raise_for_status()
        for _ in range(60):  # Instagram procesa el video (puede tardar 1-3 min)
            st = requests.get(f"{GRAPH}/{self.v}/{cont['id']}", params={"fields": "status_code,status", "access_token": tok}, timeout=30).json()
            if st.get("status_code") == "FINISHED":
                break
            if st.get("status_code") == "ERROR":
                raise RuntimeError(f"Instagram rechazó el video: {st.get('status')}")
            time.sleep(10)
        pub = requests.post(f"{GRAPH}/{self.v}/{ig}/media_publish", data={"creation_id": cont["id"], "access_token": tok}, timeout=60)
        pub.raise_for_status()
        mid = pub.json()["id"]
        link = requests.get(f"{GRAPH}/{self.v}/{mid}", params={"fields": "permalink", "access_token": tok}, timeout=30).json().get("permalink")
        return {"ok": True, "url": link, "msg": "publicado"}

    def facebook(self, clip, cfg):
        m = self._acc(clip["account"])
        tok, page = m["page_token"], m["page_id"]
        size = os.path.getsize(clip["path"])
        s = requests.post(f"{GRAPH}/{self.v}/{page}/video_reels", data={"upload_phase": "start", "access_token": tok}, timeout=60)
        s.raise_for_status()
        vid = s.json()["video_id"]
        with open(clip["path"], "rb") as f:
            up = requests.post(f"https://rupload.facebook.com/video-upload/{self.v}/{vid}", data=f, timeout=600, headers={
                "Authorization": f"OAuth {tok}", "offset": "0", "file_size": str(size)})
        up.raise_for_status()
        fin = requests.post(f"{GRAPH}/{self.v}/{page}/video_reels", timeout=60, data={
            "upload_phase": "finish", "video_id": vid, "video_state": "PUBLISHED",
            "description": clip["caption"], "access_token": tok})
        fin.raise_for_status()
        return {"ok": True, "url": f"https://www.facebook.com/reel/{vid}", "msg": "publicado"}


def meta_login(account: str, app_id: str, app_secret: str, short_token: str, cfg: dict) -> dict:
    """Canjea un token corto (Graph API Explorer) por un token de página que no vence."""
    v = cfg["publishing"].get("graph_version", "v23.0")
    r = requests.get(f"{GRAPH}/{v}/oauth/access_token", timeout=30, params={
        "grant_type": "fb_exchange_token", "client_id": app_id, "client_secret": app_secret, "fb_exchange_token": short_token})
    r.raise_for_status()
    long_user = r.json()["access_token"]
    pages = requests.get(f"{GRAPH}/{v}/me/accounts", params={
        "fields": "id,name,access_token,instagram_business_account{id,username}", "access_token": long_user}, timeout=30).json()
    if not pages.get("data"):
        raise RuntimeError(f"No encontré páginas de Facebook con ese token: {pages}")
    return pages["data"]


# ───────────────────────── TikTok: borrador en la bandeja (sin auditoría) ─────────────────────────
TT = "https://open.tiktokapis.com"


class TikTok:
    def _token(self, account):
        s = load_secrets()
        t = s.get("tiktok", {}).get(account)
        if not t:
            raise NoConectado(f"TikTok no está conectado para '{account}'. Corré: clipper tiktok-login {account}")
        if t["expires_at"] < time.time() + 300:
            app = s["tiktok_app"]
            r = requests.post(f"{TT}/v2/oauth/token/", timeout=30, data={
                "client_key": app["client_key"], "client_secret": app["client_secret"],
                "grant_type": "refresh_token", "refresh_token": t["refresh_token"]})
            j = r.json()
            if "access_token" not in j:
                raise RuntimeError(f"TikTok: no pude renovar el acceso ({j}). Corré de nuevo: clipper tiktok-login {account}")
            t.update(access_token=j["access_token"], refresh_token=j["refresh_token"], expires_at=time.time() + j["expires_in"])
            s["tiktok"][account] = t
            save_secrets(s)
        return t["access_token"]

    def tiktok(self, clip, cfg):
        tok = self._token(clip["account"])
        size = os.path.getsize(clip["path"])
        mode = cfg["accounts"][clip["account"]].get("tiktok_mode", "inbox")
        if mode == "direct":  # solo sirve en público cuando la app pase la auditoría de TikTok
            url = f"{TT}/v2/post/publish/video/init/"
            body = {"post_info": {"title": clip["caption"][:2200], "privacy_level": "PUBLIC_TO_EVERYONE"},
                    "source_info": {"source": "FILE_UPLOAD", "video_size": size, "chunk_size": size, "total_chunk_count": 1}}
        else:
            url = f"{TT}/v2/post/publish/inbox/video/init/"
            body = {"source_info": {"source": "FILE_UPLOAD", "video_size": size, "chunk_size": size, "total_chunk_count": 1}}
        r = requests.post(url, json=body, timeout=60, headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json; charset=UTF-8"})
        j = r.json()
        code = j.get("error", {}).get("code")
        if code in ("spam_risk_too_many_pending_share", "spam_risk_too_many_posts"):
            raise NoConectado("TikTok tiene 5 borradores sin publicar en las últimas 24 h (límite de TikTok). "
                              "Publicá los borradores desde la app para liberar lugar")
        if code not in (None, "ok"):
            raise RuntimeError(f"TikTok: {j['error']}")
        with open(clip["path"], "rb") as f:
            up = requests.put(j["data"]["upload_url"], data=f, timeout=600, headers={
                "Content-Type": "video/mp4", "Content-Range": f"bytes 0-{size - 1}/{size}", "Content-Length": str(size)})
        up.raise_for_status()
        if mode == "direct":
            return {"ok": True, "url": None, "msg": "publicado"}
        return {"ok": True, "url": None, "manual": True, "borrador": True,
                "msg": "borrador enviado a tu bandeja de TikTok: abrí la app → notificación → pegá el texto y publicá"}


def tiktok_auth_url(client_key: str, redirect_uri: str, state: str) -> str:
    q = {"client_key": client_key, "scope": "user.info.basic,video.upload", "response_type": "code",
         "redirect_uri": redirect_uri, "state": state}
    return "https://www.tiktok.com/v2/auth/authorize/?" + urllib.parse.urlencode(q)


def tiktok_exchange(client_key, client_secret, code, redirect_uri) -> dict:
    r = requests.post(f"{TT}/v2/oauth/token/", timeout=30, data={
        "client_key": client_key, "client_secret": client_secret, "code": code,
        "grant_type": "authorization_code", "redirect_uri": redirect_uri})
    j = r.json()
    if "access_token" not in j:
        raise RuntimeError(f"TikTok no devolvió token: {j}")
    return {"access_token": j["access_token"], "refresh_token": j["refresh_token"],
            "expires_at": time.time() + j["expires_in"], "open_id": j.get("open_id")}


# ───────────────────────── YouTube Shorts ─────────────────────────
class YouTube:
    """API propia: hasta que Google audite el proyecto, los videos quedan PRIVADOS.
    Por eso por defecto youtube_mode = manual (te llega el archivo para subirlo vos)."""

    def _token(self, account):
        s = load_secrets()
        y = s.get("youtube", {}).get(account)
        app = s.get("google_app")
        if not y or not app:
            raise NoConectado(f"YouTube no está conectado para '{account}'. Corré: clipper youtube-login {account}")
        r = requests.post("https://oauth2.googleapis.com/token", timeout=30, data={
            "client_id": app["client_id"], "client_secret": app["client_secret"],
            "refresh_token": y["refresh_token"], "grant_type": "refresh_token"})
        r.raise_for_status()
        return r.json()["access_token"]

    def youtube(self, clip, cfg):
        mode = cfg["accounts"][clip["account"]].get("youtube_mode", "manual")
        if mode != "api":
            return {"ok": True, "manual": True, "url": None, "msg": "subilo a mano como Short (archivo y texto arriba)"}
        tok = self._token(clip["account"])
        meta = {"snippet": {"title": clip["title"][:95], "description": clip["caption"],
                            "categoryId": cfg["publishing"].get("youtube_category_id", "20")},
                "status": {"privacyStatus": "public", "selfDeclaredMadeForKids": False}}
        r = requests.post("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
                          json=meta, timeout=60, headers={"Authorization": f"Bearer {tok}", "X-Upload-Content-Type": "video/mp4"})
        r.raise_for_status()
        with open(clip["path"], "rb") as f:
            up = requests.put(r.headers["Location"], data=f, timeout=900, headers={"Content-Type": "video/mp4"})
        up.raise_for_status()
        vid = up.json()["id"]
        return {"ok": True, "url": f"https://youtube.com/shorts/{vid}", "msg": "subido (privado hasta que Google audite el proyecto)"}


# ───────────────────────── Post for Me (para cuando se pague) ─────────────────────────
class PostForMe:
    API = "https://api.postforme.dev/v1"
    NET = {"tiktok": "tiktok", "youtube": "youtube", "instagram": "instagram", "facebook": "facebook", "x": "x"}

    def _h(self):
        return {"Authorization": f"Bearer {os.environ['POSTFORME_API_KEY']}", "Content-Type": "application/json"}

    def publish(self, clip, cfg, network):
        acc = cfg["accounts"][clip["account"]]
        ids = (acc.get("postforme_account_ids") or {}).get(network)
        if not ids:
            raise RuntimeError(f"Falta postforme_account_ids.{network} en la cuenta {clip['account']}")
        j = requests.post(f"{self.API}/media/create-upload-url", headers=self._h(), json={}, timeout=30).json()
        with open(clip["path"], "rb") as f:
            requests.put(j["upload_url"], data=f, headers={"Content-Type": "video/mp4"}, timeout=600).raise_for_status()
        body = {"caption": clip["caption"], "social_accounts": [ids], "media": [{"url": j["media_url"]}],
                "platform_configurations": {"youtube": {"title": clip["title"][:95], "localizations": {}, "privacy_status": "public"},
                                            "instagram": {"placement": "reels"}, "tiktok": {"privacy_status": "public"}}}
        r = requests.post(f"{self.API}/social-posts", headers=self._h(), json=body, timeout=60)
        if r.status_code >= 400:
            raise RuntimeError(f"Post for Me {r.status_code}: {r.text[:300]}")
        return {"ok": True, "url": None, "msg": f"enviado a Post for Me ({r.json().get('id')})"}


# ───────────────────────── despacho ─────────────────────────
LABEL = {"instagram": "Instagram", "facebook": "Facebook", "tiktok": "TikTok", "youtube": "YouTube Shorts", "x": "X"}


def publish_all(cfg: dict, clip: dict) -> list[dict]:
    """Publica en todas las redes de la cuenta. Devuelve un resultado por red (no corta si una falla)."""
    acc = cfg["accounts"][clip["account"]]
    out = []
    meta, tt, yt, pfm = Meta(cfg), TikTok(), YouTube(), PostForMe()
    for dest in acc.get("destinations", []):
        net, provider = (dest, "native") if isinstance(dest, str) else (dest["network"], dest.get("provider", "native"))
        try:
            if provider == "postforme":
                res = pfm.publish(clip, cfg, net)
            elif net in ("instagram", "facebook"):
                res = getattr(meta, net)(clip, cfg)
            elif net == "tiktok":
                res = tt.tiktok(clip, cfg)
            elif net == "youtube":
                res = yt.youtube(clip, cfg)
            else:
                raise RuntimeError(f"Red no soportada: {net}")
        except NoConectado as e:
            res = {"ok": True, "manual": True, "url": None, "msg": f"subilo a mano ({e})"}
        except Exception as e:
            log.exception("publicando %s en %s", clip["id"], net)
            res = {"ok": False, "msg": str(e)[:300]}
        res["network"] = net
        out.append(res)
    return out


def next_slot(account: str, gap_minutes: int) -> float:
    """Segundos a esperar para respetar la separación entre posts de una cuenta."""
    now = time.time()
    last = db.kv_get(f"last_post:{account}", 0)
    wait = max(0, last + gap_minutes * 60 - now)
    db.kv_set(f"last_post:{account}", now + wait)
    return wait
