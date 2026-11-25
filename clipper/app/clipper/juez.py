"""Juez de humor con Gemini: mira el clip (video + audio) y le pone nota pensando en el público de la cuenta."""
import base64
import json
import logging
import os
import time

import requests

log = logging.getLogger("juez")
API = "https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent"
MODELOS = [m for m in [os.environ.get("GEMINI_MODEL"), "gemini-flash-latest", "gemini-flash-lite-latest"] if m]
AGOTADO: dict[str, float] = {}   # modelo -> hasta cuándo no usarlo (cupo diario gratis agotado)

PROMPT = """Sos editor de una cuenta de Instagram/TikTok de clips graciosos de streamers ({streamer}).
Público: gente de 15 a 28 años de Argentina, Latinoamérica y España que mira streams en Twitch/Kick y entra a Reels/TikTok a reírse.
Buscan el momento absurdo, la reacción exagerada, el remate inesperado: algo que le mandarían a un amigo.
{contexto}Mirá y escuchá el clip completo (dura {dur:.0f} s). Frases que detectó el subtitulado automático (índice, segundos, texto):
{frases}

Respondé SOLO un JSON con estas claves:
- "nota": entero de 1 a 10. 9-10 = muy probable que se comparta; 7-8 = gracioso y se entiende solo; 4-6 = flojo o necesita contexto; 1-3 = no pasa nada.
- "motivo": una frase corta explicando la nota.
- "gancho": texto de intriga de máximo 9 palabras que aparece en pantalla al principio, mientras se ve el remate. Tiene que dar ganas de ver cómo se llegó a eso (por ejemplo: "Nadie esperaba que terminara así", "Así perdió todo en dos segundos"). En español neutro que se entienda en España y Latinoamérica. No describas el remate con detalle, sin emojis, sin hashtags, sin comillas.
- "frases_juego": lista de índices de las frases de arriba que NO dice el streamer (diálogos del juego, NPCs, radio, música, videos que mira). El streamer habla en español (de España o de Latinoamérica) y el juego suele estar en inglés: toda frase que sea del juego va acá aunque el subtitulado la haya pasado al español. Lista vacía si todas son del streamer.
- "remate_inicio" y "remate_fin": segundos (dentro del clip) del momento cumbre: la reacción, el golpe o la frase que hace gracioso al clip, de 1,5 a 4 segundos. Tiene que quedar dentro de inicio y fin, terminar justo con "fin" o muy cerca, y empezar al menos 4 segundos después de "inicio". El video va a arrancar mostrando ese momento y después contar cómo se llegó.
- "inicio" y "fin": segundos (dentro del clip) donde conviene cortarlo para que arranque justo antes de la acción o la frase que engancha (sin preparación aburrida) y termine apenas después del remate. Si ya está bien, inicio 0 y fin {dur:.0f}. Mínimo 6 segundos de duración.
- "escenas_sensibles": lista de tramos [inicio, fin] en segundos donde EL JUEGO muestra desnudos o semidesnudos, pechos, partes íntimas, actos o insinuaciones sexuales, strip clubs, bailes eróticos o lap dance, o violencia gráfica muy explícita (sangre a chorros, desmembramientos). Tené en cuenta el título del clip: si sugiere algo así, buscalo con cuidado. Sé generoso con los márgenes. Lista vacía si no hay nada de eso.
- "contenido_sexual": true si la gracia del clip depende de ese contenido sexual o de desnudos (sin verlo, el clip no tiene sentido); si no, false.
- "juego": nombre del videojuego que se ve en el clip, identificado por lo que ves (personajes, interfaz, estética), no por la categoría de Kick. Si es Grand Theft Auto VI escribí exactamente "GTA VI".
- "hashtags": 3 hashtags específicos de lo que se ve (juego exacto, modo o situación; por ejemplo gta6, gtarp), sin "#", en minúscula y sin espacios.
Sé exigente: la mayoría de los clips de un stream NO son virales."""


def activo(cuenta: str = "") -> bool:
    return bool(os.environ.get("GEMINI_API_KEY") or os.environ.get(f"GEMINI_API_KEY_{cuenta.upper()}"))


def _duracion(path: str) -> float:
    import subprocess
    try:
        return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                                    capture_output=True, text=True).stdout.strip())
    except Exception:
        return 30.0


def juzgar(path: str, streamer: str, frases: list[dict], contexto: str = "", cuenta: str = "") -> dict:
    # cada cuenta puede usar la clave de su propio AI Studio (GEMINI_API_KEY_PETCLUB, ...); si no, la general
    key = os.environ.get(f"GEMINI_API_KEY_{cuenta.upper()}") or os.environ["GEMINI_API_KEY"]
    dur = _duracion(path)
    video = base64.b64encode(open(path, "rb").read()).decode()
    body = {
        "contents": [{"parts": [
            {"inline_data": {"mime_type": "video/mp4", "data": video}},
            {"text": PROMPT.format(streamer=streamer, dur=dur,
                contexto=(f"Título que le puso al clip el espectador que lo recortó en Kick: {contexto}\n" if contexto else ""), frases="\n".join(f"{f['i']} [{f['t0']:.1f}-{f['t1']:.1f}] {f['texto']}" for f in frases)[:3000] or "(sin frases)")},
        ]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.3},
    }
    ultimo = None
    for modelo in MODELOS:
        if AGOTADO.get((key[-6:], modelo), 0) > time.time():
            ultimo = f"{modelo}: cupo diario agotado"
            continue
        for intento in range(3):
            r = requests.post(API.format(m=modelo), headers={"x-goog-api-key": key}, json=body, timeout=180)
            if r.status_code == 429 and "per day" in r.text:
                AGOTADO[(key[-6:], modelo)] = time.time() + 2 * 3600
                ultimo = f"{modelo}: cupo diario agotado"
                log.info("Gemini %s sin cupo diario gratis; paso al siguiente modelo", modelo)
                break
            if r.status_code == 429 or r.status_code >= 500:
                ultimo = f"{modelo}: {r.status_code}"
                if intento >= 1:  # saturado: no esperar más, probar el modelo siguiente
                    break
                time.sleep(15)
                continue
            if r.status_code == 404:
                ultimo = f"{modelo}: no existe"
                break
            if r.status_code >= 400:
                try:
                    msg = r.json().get("error", {}).get("message", "")
                except Exception:
                    msg = r.text[:200]
                raise RuntimeError(f"Gemini {r.status_code}: {msg}")
            txt = r.json()["candidates"][0]["content"]["parts"][0]["text"]
            d = json.loads(txt[txt.find("{"): txt.rfind("}") + 1])
            d["nota"] = int(d.get("nota", 0))
            d["gancho"] = " ".join(str(d.get("gancho", "")).replace('"', "").split())[:90]
            d["frases_juego"] = [int(x) for x in d.get("frases_juego") or [] if str(x).lstrip("-").isdigit()]
            d["hashtags"] = [str(h).lstrip("#").lower().replace(" ", "") for h in (d.get("hashtags") or [])][:3]
            try:
                i0, i1 = float(d.get("inicio", 0)), float(d.get("fin", dur))
                i0, i1 = max(0.0, i0), min(dur, i1)
                d["corte"] = (i0, i1) if (i1 - i0 >= 6 and (i0 > 0.8 or i1 < dur - 0.8)) else None
            except (TypeError, ValueError):
                d["corte"] = None
            try:
                r0, r1 = float(d.get("remate_inicio")), float(d.get("remate_fin"))
                c0, c1 = d["corte"] if d.get("corte") else (0.0, dur)
                r1 = min(r1, c1)
                d["remate"] = (r0, r1) if (1.2 <= r1 - r0 <= 5 and r0 - c0 >= 4) else None
            except (TypeError, ValueError):
                d["remate"] = None
            sens = []
            for t in d.get("escenas_sensibles") or []:
                try:
                    a, b = float(t[0]), float(t[1])
                    if b > a:
                        sens.append((max(0.0, a), min(dur, b)))
                except (TypeError, ValueError, IndexError):
                    pass
            d["sensibles"] = sens
            d["contenido_sexual"] = d.get("contenido_sexual") in (True, "true", "True", 1)
            d["juego"] = str(d.get("juego") or "").strip()[:60]
            d["modelo"] = modelo
            return d
    raise RuntimeError(f"Gemini no respondió ({ultimo})")
