"""Conexión con "Mi panel" (CRM de herramientas.consultoraprisma.digital), que corre en el mismo VPS."""
import json
import logging
import os
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import requests

log = logging.getLogger("crm")
TZ = ZoneInfo("America/Argentina/Buenos_Aires")


def _url(path):
    return os.environ.get("PUENTE_URL", "http://127.0.0.1:4002/api/puente") + path


def _h():
    return {"x-puente-clave": os.environ.get("PUENTE_CLAVE", ""), "content-type": "application/json"}


def activo() -> bool:
    return bool(os.environ.get("PUENTE_CLAVE"))


def agenda(desde: str, hasta: str | None = None) -> list[dict]:
    r = requests.get(_url("/agenda"), params={"desde": desde, "hasta": hasta or desde}, headers=_h(), timeout=15)
    r.raise_for_status()
    return r.json()["dias"]


def crear_evento(fecha: str, hora: str, titulo: str, notas: str = "") -> dict:
    r = requests.post(_url("/eventos"), headers=_h(), timeout=15, json={"fecha": fecha, "hora": hora, "titulo": titulo, "notas": notas})
    r.raise_for_status()
    return r.json()


def borrar_evento(eid: str):
    requests.delete(_url(f"/eventos/{eid}"), headers=_h(), timeout=15)


def contador_clips(fecha: str, creados: int, aprobados: int, publicados: int):
    try:
        requests.post(_url("/clips"), headers=_h(), timeout=10,
                      json={"fecha": fecha, "creados": creados, "aprobados": aprobados, "publicados": publicados})
    except Exception as e:
        log.warning("no pude actualizar el contador del CRM: %s", e)


# ───────────────────────── interpretar una nota ─────────────────────────
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def interpretar_nota(texto: str) -> dict:
    """Devuelve {fecha: AAAA-MM-DD, hora: HH:MM|'', titulo}. Usa Claude si hay API key; si no, dateparser."""
    ahora = datetime.now(TZ)
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        try:
            prompt = (f"Hoy es {DIAS[ahora.weekday()]} {ahora:%Y-%m-%d %H:%M} (Argentina). Convertí esta nota en un evento de agenda.\n"
                      f"Nota: «{texto}»\n"
                      "Respondé SOLO un JSON: {\"fecha\":\"AAAA-MM-DD\",\"hora\":\"HH:MM o vacío\",\"titulo\":\"título corto sin la fecha\"}. "
                      "Si no dice fecha, usá hoy. Si dice 'a la tarde' sin hora, dejá la hora vacía.")
            r = requests.post("https://api.anthropic.com/v1/messages", timeout=30, headers={
                "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={"model": os.environ.get("CLIPPER_LLM_MODEL", "claude-haiku-5-5"), "max_tokens": 150,
                      "messages": [{"role": "user", "content": prompt}]})
            r.raise_for_status()
            raw = r.json()["content"][0]["text"]
            j = json.loads(raw[raw.index("{"): raw.rindex("}") + 1])
            if re.match(r"^\d{4}-\d{2}-\d{2}$", j.get("fecha", "")):
                h = j.get("hora") or ""
                return {"fecha": j["fecha"], "hora": h if re.match(r"^\d{2}:\d{2}$", h) else "", "titulo": (j.get("titulo") or texto)[:200]}
        except Exception as e:
            log.warning("Claude no pudo interpretar la nota (%s); uso dateparser", e)
    return _interpretar_local(texto, ahora)


MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
_DIA_RE = {"lunes": 0, "martes": 1, "miercoles": 2, "miércoles": 2, "jueves": 3, "viernes": 4, "sabado": 5, "sábado": 5, "domingo": 6}


def _interpretar_local(texto: str, ahora: datetime) -> dict:
    """Parser propio para notas en castellano: hoy / mañana / pasado mañana / el viernes /
    25/11 / 25 de noviembre + a las 10 / 15:30 / 18hs / 6 de la tarde."""
    t = " " + texto.strip() + " "
    hoy = ahora.date()
    fecha = None

    def quitar(m):
        nonlocal t
        t = t[:m.start()] + " " + t[m.end():]

    m = re.search(r"\b(para\s+)?pasado\s+mañana\b", t, re.I)
    if m:
        fecha = hoy + timedelta(days=2); quitar(m)
    if not fecha and (m := re.search(r"\b(para\s+)?mañana\b(?!\s+a\s+la\s+mañana)", t, re.I)):
        fecha = hoy + timedelta(days=1); quitar(m)
    if not fecha and (m := re.search(r"\b(para\s+)?hoy\b", t, re.I)):
        fecha = hoy; quitar(m)
    if not fecha and (m := re.search(r"\b(?:el\s+|para\s+el\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b", t)):
        d, mo, y = int(m.group(1)), int(m.group(2)), m.group(3)
        y = int(y) + (2000 if y and len(y) == 2 else 0) if y else hoy.year
        try:
            f = datetime(y, mo, d).date()
            fecha = f if (m.group(3) or f >= hoy) else f.replace(year=f.year + 1)
            quitar(m)
        except ValueError:
            pass
    if not fecha and (m := re.search(r"\b(?:el\s+|para\s+el\s+)?(\d{1,2})\s+de\s+(" + "|".join(MESES) + r")\b", t, re.I)):
        try:
            f = datetime(hoy.year, MESES.index(m.group(2).lower()) + 1, int(m.group(1))).date()
            fecha = f if f >= hoy else f.replace(year=f.year + 1)
            quitar(m)
        except ValueError:
            pass
    if not fecha and (m := re.search(r"\b(?:el\s+|este\s+|para\s+el\s+|próximo\s+|proximo\s+)?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b", t, re.I)):
        wd = _DIA_RE[m.group(1).lower()]
        delta = (wd - hoy.weekday()) % 7 or 7
        fecha = hoy + timedelta(days=delta); quitar(m)

    hora = ""
    m = (re.search(r"\b(?:a\s+las?\s+)?(\d{1,2}):(\d{2})\s*(?:hs|h)?\b", t, re.I)
         or re.search(r"\b(?:a\s+las?\s+)(\d{1,2})()(?:\s*(?:hs|h))?\b", t, re.I)
         or re.search(r"\b(\d{1,2})()\s*(?:hs|h)\b", t, re.I)
         or re.search(r"\b(\d{1,2})()\s*(am|pm)\b", t, re.I))
    if m:
        h, mi = int(m.group(1)), int(m.group(2) or 0)
        resto = t[m.end():m.end() + 25].lower()
        if ("pm" in m.group(0).lower() or re.match(r"\s*(de la tarde|de la noche|pm)", resto)) and h < 12:
            h += 12
        if h < 24 and mi < 60:
            hora = f"{h:02d}:{mi:02d}"
            quitar(m)
            t = re.sub(r"\b(de la (mañana|tarde|noche))\b", " ", t, count=1, flags=re.I)
    titulo = re.sub(r"\s+", " ", t).strip(" ,.-:")
    titulo = re.sub(r"^(el|la|a|para|que)\s+", "", titulo, flags=re.I)
    titulo = re.sub(r"\s+(el|a|para|que)$", "", titulo, flags=re.I).strip() or texto.strip()
    return {"fecha": (fecha or hoy).strftime("%Y-%m-%d"), "hora": hora, "titulo": titulo[:1].upper() + titulo[1:200]}
