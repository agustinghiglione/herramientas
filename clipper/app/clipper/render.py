"""Corte del clip, formato vertical 9:16, subtítulos automáticos y texto del post."""
import json
import logging
import os
import subprocess
import uuid
from pathlib import Path

import requests

log = logging.getLogger("render")
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
_whisper = {}


def _run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg falló: {r.stderr[-800:]}")
    return r


def cut_source(segments: list[tuple[str, float, float]], t0: float, t1: float, out: Path) -> Path:
    """segments: [(path, wall_start, wall_end)] ordenados. Corta [t0, t1] (tiempo real)."""
    use = [s for s in segments if s[2] > t0 and s[1] < t1]
    if not use:
        raise RuntimeError("No hay bloques que cubran el clip")
    t0 = max(t0, use[0][1])
    lst = out.with_suffix(".txt")
    lst.write_text("".join(f"file '{p}'\n" for p, _, _ in use))
    ss = t0 - use[0][1]
    dur = min(t1, use[-1][2]) - t0
    _run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
          "-ss", f"{ss:.2f}", "-t", f"{dur:.2f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
          "-c:a", "aac", "-b:a", "160k", str(out)])
    lst.unlink(missing_ok=True)
    return out


def transcribe(path: Path, language: str, model_name: str):
    from faster_whisper import WhisperModel
    if model_name not in _whisper:
        _whisper[model_name] = WhisperModel(model_name, device="cpu", compute_type="int8")
    model = _whisper[model_name]
    segs, _ = model.transcribe(str(path), language=language, word_timestamps=True, vad_filter=True)
    segs = list(segs)
    fuera = _frases_otro_idioma(model, path, segs, language) if language != "en" else set()
    if fuera:
        log.info("subtítulos: %d de %d frases en inglés (audio del juego) quitadas", len(fuera), len(segs))
    words, text = [], []
    for k, s in enumerate(segs):
        if k in fuera:
            continue
        text.append(s.text.strip())
        for w in s.words or []:
            words.append((w.start, w.end, w.word.strip(), k))
    return " ".join(text).strip(), words


_EN = set("the you and is are was what i'm it's that this to of in on for with my your we they he she don't can't just get got go oh yeah okay come let's here there right now look shit fuck man please gonna wanna".split())
_ES = set("el la los las que de y es no me te lo un una qué pero por con se mi tu está esto eso ya yo vos tío boludo hermano mira ahí aquí acá dale vamos joder wey pues bueno nada todo".split())


def _parece_ingles(texto: str) -> bool:
    t = [w.strip(".,!?¿¡\"'").lower() for w in texto.split()]
    en, es = sum(w in _EN for w in t), sum(w in _ES for w in t)
    return en >= 2 and en > es


def _frases_otro_idioma(model, path, segs, idioma: str) -> set:
    """Frases que no están en el idioma del streamer (en la práctica: diálogos del juego en inglés).
    Mira el audio de cada frase con el detector de idioma de Whisper; si falla, usa las palabras."""
    fuera = set()
    try:
        from faster_whisper.audio import decode_audio
        audio = decode_audio(str(path), sampling_rate=16000)
    except Exception:
        audio = None
    for k, s in enumerate(segs):
        prob_en = prob_es = None
        if audio is not None and s.end - s.start >= 0.8:
            try:
                _, _, todas = model.detect_language(audio=audio[int(s.start * 16000):int(s.end * 16000)])
                d = dict(todas or [])
                prob_en, prob_es = d.get("en", 0.0), d.get(idioma, 0.0)
            except Exception:
                pass
        if prob_en is not None:
            if prob_en > 0.5 and prob_en > prob_es:
                fuera.add(k)
        elif _parece_ingles(s.text):
            fuera.add(k)
    return fuera


import re
import unicodedata

# Malas palabras: en los subtítulos quedan con la primera letra y asteriscos ("P***").
# Las "fuertes" (insultos discriminatorios y sexuales explícitos) además llevan pitido en el audio.
FUERTES = re.compile(r"^(hijueputa|hijeputa|hijodeputa|puta\w*|puto\w*|marica\w*|maricon\w*|verga\w*|polla\w*|pija\w*|foll\w+|"
                     r"chinga\w*|malparid\w*|gonorrea\w*|mamagu?evo\w*|retrasad\w*|mongolic\w*|nigg\w*|fagg?ot\w*|fuck\w*|"
                     r"conchetu\w*|culia[od]\w*|cojud\w*)$")
SUAVES = re.compile(r"^(mierda\w*|joder|jodid\w*|jodan|carajo\w*|cabron\w*|culo|culos|culito|pinche\w*|pendej\w*|gilipolla\w*|"
                    r"cono|shit\w*|bitch\w*|concha|pajer\w*|ojete|orto)$")


def _norm(w: str) -> str:
    w = unicodedata.normalize("NFD", w.lower())
    return "".join(c for c in w if c.isalnum() and unicodedata.category(c) != "Mn")


def mala_palabra(w: str) -> str | None:
    """'fuerte', 'suave' o None."""
    n = _norm(w)
    if not n:
        return None
    if FUERTES.match(n):
        return "fuerte"
    if SUAVES.match(n):
        return "suave"
    return None


def _norm_frase(t: str) -> str:
    t = unicodedata.normalize("NFD", (t or "").lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


def censurar(texto: str) -> str:
    """Censura cada mala palabra de un texto dejando la primera letra: 'puta madre' -> 'p*** madre'."""
    def tapa(m):
        w = m.group(0)
        if not mala_palabra(w):
            return w
        letras = [i for i, c in enumerate(w) if c.isalnum()]
        return "".join(c if (i == letras[0] or not c.isalnum()) else "*" for i, c in enumerate(w))
    return re.sub(r"[\w\u00C0-\u017F]+", tapa, texto)


def _ventanas(tramos, margen=0.0, dur=None):
    """Une tramos [a, b] que se pisan y les suma un margen."""
    out = []
    for a, b in sorted((max(0.0, a - margen), b + margen if dur is None else min(dur, b + margen)) for a, b in tramos if b > a):
        if out and a <= out[-1][1]:
            out[-1] = (out[-1][0], max(out[-1][1], b))
        else:
            out.append((a, b))
    return out


def _enable(tramos) -> str:
    return "+".join(f"between(t,{a:.2f},{b:.2f})" for a, b in tramos)


def _ass_time(t):
    h, rem = divmod(max(t, 0), 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def build_ass(words, path: Path, W: int, H: int, top_y: float | None = None, gancho: tuple[str, float] | None = None):
    """top_y: si viene (fracción de H), los subtítulos se anclan arriba en esa altura (formato cámara+juego).
    gancho: (texto, segundos) cartel de intriga arriba durante el arranque del clip."""
    align, mv = (8, int(H * top_y)) if top_y is not None else (2, int(H * 0.27))
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,DejaVu Sans,{int(78*W/1080)},&H00FFFFFF,&H0000FFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,{max(3,int(6*W/1080))},2,{align},{int(60*W/1080)},{int(60*W/1080)},{mv},1
Style: Hook,DejaVu Sans,{int(62*W/1080)},&H00000000,&H00000000,&H00FFFFFF,&H00FFFFFF,-1,0,0,0,100,100,0,0,3,{max(8,int(16*W/1080))},0,8,{int(70*W/1080)},{int(70*W/1080)},{int(H*0.09)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    chunk = []
    for w in words:
        chunk.append(w)
        if len(chunk) == 3 or w[2].endswith((".", "!", "?", ",")):
            lines.append(chunk)
            chunk = []
    if chunk:
        lines.append(chunk)
    ev = []
    for ch in lines:
        txt = censurar(" ".join(x[2] for x in ch)).upper().replace("{", "").replace("}", "")
        ev.append(f"Dialogue: 0,{_ass_time(ch[0][0])},{_ass_time(ch[-1][1] + 0.05)},Cap,,0,0,0,,{txt}")
    if gancho and gancho[0].strip():
        txt = gancho[0].strip().replace("{", "").replace("}", "")
        ev.insert(0, f"Dialogue: 1,{_ass_time(0)},{_ass_time(max(gancho[1], 1.5))},Hook,,0,0,0,,{txt}")
    path.write_text(head + "\n".join(ev) + "\n", encoding="utf-8")


def _esc(t: str) -> str:
    return t.replace("\\", "\\\\").replace(":", "\\:").replace("'", "’").replace("%", "\\%")


SPLIT_TOP = 0.40          # alto de la cámara en el formato cámara arriba / juego abajo
MODEL_YUNET = Path(os.environ.get("CLIPPER_MODELS", "/opt/clipper/models")) / "face_detection_yunet_2023mar.onnx"


def _probe(src: Path):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                   "stream=width,height:format=duration", "-of", "json", str(src)],
                                  capture_output=True, text=True).stdout)
    return int(j["streams"][0]["width"]), int(j["streams"][0]["height"]), float(j["format"]["duration"])


def _faces(img, det):
    import cv2
    if hasattr(det, "detectMultiScale"):
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        return [tuple(map(float, f)) for f in det.detectMultiScale(g, 1.1, 6, minSize=(24, 24))]
    det.setInputSize((img.shape[1], img.shape[0]))
    _, f = det.detect(img)
    return [] if f is None else [tuple(map(float, x[:4])) for x in f]


def detect_layout(src: Path, samples: int = 14) -> dict | None:
    """Busca la cara del streamer en varios fotogramas.
    - cámara chica fija en una esquina  -> {"kind": "split", "cam": (x, y, w, h)}   (px del video original)
    - el streamer ocupa la pantalla      -> {"kind": "face", "cx": x}
    - no hay cara estable                -> None  (formato con fondo desenfocado)"""
    try:
        import cv2
        import numpy as np
    except ImportError:
        return None
    try:
        W0, H0, dur = _probe(src)
        sw = 960
        sh = int(H0 * sw / W0) // 2 * 2
        raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(src), "-vf",
                              f"fps={samples / max(dur, 1):.4f},scale={sw}:{sh}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                             capture_output=True).stdout
        frames = np.frombuffer(raw, np.uint8)[: (len(raw) // (sw * sh * 3)) * sw * sh * 3].reshape(-1, sh, sw, 3)
        if not len(frames):
            return None
        if MODEL_YUNET.exists():
            det = cv2.FaceDetectorYN.create(str(MODEL_YUNET), "", (sw, sh), 0.8, 0.3, 50)
        else:
            if not hasattr(cv2, "CascadeClassifier"):
                return None
            det = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        dets = [(i, f) for i, img in enumerate(frames) for f in _faces(np.ascontiguousarray(img), det)]
        # agrupa caras que aparecen siempre en el mismo lugar (la cámara no se mueve; las caras del juego sí)
        groups = []
        for i, (x, y, w, h) in dets:
            cx, cy = x + w / 2, y + h / 2
            for g in groups:
                if abs(g["cx"] - cx) < max(w, g["w"]) * 0.7 and abs(g["cy"] - cy) < max(h, g["h"]) * 0.7:
                    g["items"].append((x, y, w, h)); g["frames"].add(i)
                    break
            else:
                groups.append({"cx": cx, "cy": cy, "w": w, "h": h, "items": [(x, y, w, h)], "frames": {i}})
        groups = [g for g in groups if len(g["frames"]) >= max(3, len(frames) * 0.4)]
        if not groups:
            return None
        g = max(groups, key=lambda g: (len(g["frames"]), g["w"]))
        x, y, w, h = (float(np.median([it[k] for it in g["items"]])) for k in range(4))
        k = W0 / sw
        x, y, w, h = x * k, y * k, w * k, h * k
        if w / W0 >= 0.09:
            return {"kind": "face", "cx": x + w / 2}
        return {"kind": "split", "cam": (x, y, w, h)}
    except Exception as e:
        log.warning("detección de cámara falló: %s", e)
        return None


def _even(v):
    return max(2, int(v) // 2 * 2)


MAX_CAM_UP = 1.5          # la cámara nunca se agranda más que esto (si no, se ve borrosa)


def _cam_crop(face, W0, H0, aspect, out_w=1080):
    """Recorte alrededor de la cara con la proporción del panel de arriba.
    Si la cámara es chica, se toma un recorte más amplio (con algo del juego alrededor) en vez de estirarla."""
    x, y, w, h = face
    cw = min(max(w * 6.0, out_w / MAX_CAM_UP), W0 * 0.62)
    ch = cw / aspect
    if ch > H0 * 0.75:
        ch = H0 * 0.75; cw = ch * aspect
    cx, cy = x + w / 2, y + h / 2 + ch * 0.12
    x0 = min(max(cx - cw / 2, 0), W0 - cw)
    y0 = min(max(cy - ch / 2, 0), H0 - ch)
    return _even(cw), _even(ch), _even(x0), _even(y0)


def vertical(src: Path, out: Path, top_text: str, ass: Path | None, W=1080, H=1920, crf=21, maxrate=None, scale=1.0, zoom=1.25,
             layout: dict | None = None, cubrir=(), pitidos=()):
    """cubrir: tramos [a, b] con escenas sensibles del juego: ahí se ve la cámara del streamer a pantalla completa
    (o, si no hay cámara, el juego muy desenfocado). pitidos: tramos donde se tapa el audio con un pitido."""
    """top_text: marca de agua chica (ej. @westcol), gris y semitransparente arriba al centro."""
    w, h = _even(W * scale), _even(H * scale)
    kind = (layout or {}).get("kind")
    if kind in ("split", "face"):
        W0, H0, _ = _probe(src)
    if kind == "split":
        th = _even(h * SPLIT_TOP)
        bh = h - th
        cw, ch, cx, cy = _cam_crop(layout["cam"], W0, H0, w / th, W)
        gw = _even(min(W0, H0 * w / bh))
        vf = (f"[0:v]split=2[c][g];"
              f"[c]crop={cw}:{ch}:{cx}:{cy},scale={w}:{th}:flags=lanczos,setsar=1[top];"
              f"[g]crop={gw}:{H0}:{(W0 - gw) // 2}:0,scale={w}:{bh}:flags=lanczos,setsar=1[bot];"
              f"[top][bot]vstack=inputs=2[v0]")
        if cubrir:
            fw, fh, fx, fy = _cam_crop(layout["cam"], W0, H0, w / h, W)
            vf = vf.replace("[0:v]split=2[c][g]", "[0:v]split=3[c][g][f]", 1)
            vf += (f";[f]crop={fw}:{fh}:{fx}:{fy},scale={w}:{h}:flags=lanczos,setsar=1[full];"
                   f"[v0][full]overlay=0:0:enable='{_enable(cubrir)}'[v1]")
        else:
            vf += ";[v0]null[v1]"
    elif kind == "face":
        cw = _even(min(W0, H0 * w / h))
        x0 = _even(min(max(layout["cx"] - cw / 2, 0), W0 - cw))
        vf = f"[0:v]crop={cw}:{H0}:{x0}:0,scale={w}:{h}:flags=lanczos,setsar=1[v1]"
    else:
        fg_w = _even(w * zoom)
        vf = (f"[0:v]split=2[a][b];"
              f"[a]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},boxblur=25:2,eq=brightness=-0.12[bg];"
              f"[b]scale={fg_w}:-2,crop={w}:ih[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2-{int(h*0.04)}[v1]")
        if cubrir:   # sin cámara del streamer: el juego se desenfoca del todo en esos tramos
            vf = vf[:-4] + f"[v1b];[v1b]boxblur=40:4:enable='{_enable(cubrir)}'[v1]"
    if top_text:
        vf += (f";[v1]drawtext=fontfile={FONT}:text='{_esc(top_text)}':fontsize={max(10, int(30 * scale * W / 1080))}:"
               f"fontcolor=0xDDDDDD@0.45:x=(w-text_w)/2:y={int(h * 0.025)}[v1w]")
        last = "[v1w]"
    else:
        last = "[v1]"
    vf += f";{last}null"
    if ass:
        vf += f",subtitles='{ass}'"
    vf += "[v]"
    amap = "0:a?"
    if pitidos:
        en = _enable(pitidos)
        vf += (f";[0:a]volume=0:enable='{en}'[am];sine=frequency=1000:sample_rate=48000,volume=0.2,"
               f"volume=0:enable='not({en})'[bp];[am][bp]amix=inputs=2:duration=first:normalize=0[a]")
        amap = "[a]"
    cmd = ["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(src), "-filter_complex", vf, "-map", "[v]", "-map", amap,
           "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart",
           "-c:a", "aac", "-b:a", "128k"]
    if maxrate:
        cmd += ["-crf", str(crf), "-maxrate", maxrate, "-bufsize", "2M"]
    else:
        cmd += ["-crf", str(crf)]
    _run(cmd + [str(out)])
    return out


def _mejor_frase(transcript: str) -> str:
    """Elige la frase más 'graciosa' para el gancho: prioriza exclamaciones/preguntas cortas."""
    import re
    frases = [f.strip(" ,") for f in re.split(r"(?<=[.!?¿¡])\s+", transcript) if f.strip()]
    def puntos(f):
        n = len(f.split())
        return (2 if re.search(r"[!?]", f) else 0) + (1 if 4 <= n <= 14 else 0) - (1 if n > 20 else 0)
    if not frases:
        return ""
    f = max(frases, key=puntos)
    return (f[:80] + "…") if len(f) > 80 else f


def make_text(streamer, transcript: str, template: str, language: str, acc_cfg: dict | None = None, hook_override: str | None = None,
              hashtags_extra=()):
    """Hook + caption + título. Usa Claude si hay ANTHROPIC_API_KEY; si no, plantilla."""
    acc_cfg = acc_cfg or {}
    hook = hook_override or ""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key and transcript and not hook:
        try:
            lang = "español rioplatense neutro" if language == "es" else "English"
            prompt = (f"Clip corto de {streamer.name} jugando GTA 6. Transcripción: «{transcript[:1500]}».\n"
                      f"Escribí en {lang} un gancho de máximo 8 palabras para el título del video, "
                      f"sin hashtags, sin comillas, que genere curiosidad sin mentir. Respondé solo el gancho.")
            r = requests.post("https://api.anthropic.com/v1/messages", timeout=40, headers={
                "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={"model": os.environ.get("CLIPPER_LLM_MODEL", "claude-haiku-5-5"), "max_tokens": 60,
                      "messages": [{"role": "user", "content": prompt}]})
            r.raise_for_status()
            hook = r.json()["content"][0]["text"].strip().strip('"«»')
        except Exception as e:
            log.warning("LLM caption falló: %s", e)
    if not hook and transcript:
        hook = _mejor_frase(transcript)
    import random
    def limpio(t):
        return "#" + "".join(ch for ch in str(t).lower().lstrip("#") if ch.isalnum() or ch == "_")
    pool = acc_cfg.get("hashtags_pool") or ["humor", "risas", "streamers", "clips", "parati", "viral"]
    juego = list(hashtags_extra) or random.sample(acc_cfg.get("hashtags_juego") or ["gta6", "gta", "gtarp"], min(2, len(acc_cfg.get("hashtags_juego") or [1, 2, 3])))
    lista = [streamer.tag, f"{streamer.tag}clips"] + list(acc_cfg.get("hashtags_fijos") or []) + juego + random.sample(pool, min(acc_cfg.get("hashtags_humor_n", 2), len(pool)))
    vistos, tags = set(), []
    for t in lista:
        t = limpio(t)
        if len(t) > 1 and t not in vistos:
            vistos.add(t); tags.append(t)
    tags = " ".join(tags[:8])
    cta = random.choice(acc_cfg.get("ctas") or [""])
    caption = template.format(name=streamer.name, hook=hook, tag=streamer.tag, hashtags=tags, cta=cta)
    caption = "\n".join(" ".join(l.split()) for l in caption.replace("\\n", "\n").split("\n")).strip()
    title = f"{streamer.name}: {hook}" if hook else (f"{streamer.name} en GTA 6" if language == "es" else f"{streamer.name} plays GTA 6")
    return hook, caption, title[:95]


def frases(words) -> list[dict]:
    """Agrupa las palabras por frase de Whisper: [{'i', 't0', 't1', 'texto'}]"""
    out = {}
    for w in words:
        k = w[3] if len(w) > 3 else 0
        f = out.setdefault(k, {"i": k, "t0": w[0], "t1": w[1], "texto": []})
        f["t1"] = w[1]
        f["texto"].append(w[2])
    return [dict(f, texto=" ".join(f["texto"])) for f in out.values()]


def preparar(cfg, streamer, segments, peak_wall: float) -> dict:
    """Corta el pedazo del stream, lo transcribe y detecta el formato. No renderiza todavía."""
    d = cfg["detection"]
    r = cfg["render"]
    uid = uuid.uuid4().hex[:12]
    raw = cfg["data_dir"] / "tmp" / f"{uid}_raw.mp4"
    cut_source(segments, peak_wall - d["pre_seconds"], peak_wall + d["post_seconds"], raw)
    transcript, words = "", []
    try:
        transcript, words = transcribe(raw, streamer.language, r.get("whisper_model", "base"))
    except Exception as e:
        log.warning("whisper falló: %s", e)
    layout = detect_layout(raw) if r.get("layout", "auto") == "auto" else None
    log.info("formato %s: %s", uid, (layout or {}).get("kind", "fondo desenfocado"))
    return {"uid": uid, "raw": str(raw), "transcript": transcript, "words": words, "layout": layout}


def preparar_archivo(cfg, streamer, url: str) -> dict:
    """Igual que preparar(), pero a partir de un clip ya hecho (por ejemplo un clip de Kick en .m3u8)."""
    r = cfg["render"]
    uid = uuid.uuid4().hex[:12]
    raw = cfg["data_dir"] / "tmp" / f"{uid}_raw.mp4"
    try:  # copiar sin recodificar (rápido); si el stream no se deja, recodificar
        _run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", url, "-c", "copy", "-bsf:a", "aac_adtstoasc", str(raw)])
    except Exception:
        _run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", url, "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
              "-c:a", "aac", "-b:a", "160k", str(raw)])
    transcript, words = "", []
    try:
        transcript, words = transcribe(raw, streamer.language, r.get("whisper_model", "base"))
    except Exception as e:
        log.warning("whisper falló: %s", e)
    layout = detect_layout(raw) if r.get("layout", "auto") == "auto" else None
    log.info("formato %s: %s", uid, (layout or {}).get("kind", "fondo desenfocado"))
    return {"uid": uid, "raw": str(raw), "transcript": transcript, "words": words, "layout": layout}


def _duracion(path) -> float:
    return float(json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
                                           capture_output=True, text=True).stdout)["format"]["duration"])


def recortar(cfg, ctx: dict, t0: float, t1: float):
    """Recorta el clip a [t0, t1] (segundos dentro del clip) y corre los subtítulos."""
    raw = Path(ctx["raw"])
    out = raw.with_name(raw.stem + "_cut.mp4")
    _run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{t0:.2f}", "-i", str(raw), "-t", f"{t1 - t0:.2f}",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "aac", "-b:a", "160k", str(out)])
    raw.unlink(missing_ok=True)
    ctx["raw"] = str(out)
    ctx["words"] = [(max(0.0, w[0] - t0), min(t1 - t0, w[1] - t0), *w[2:]) for w in ctx["words"] if w[1] > t0 and w[0] < t1]
    ctx["sensibles"] = [(max(0.0, a - t0), min(t1 - t0, b - t0)) for a, b in ctx.get("sensibles") or [] if b > t0 and a < t1]
    ctx["transcript"] = " ".join(w[2] for w in ctx["words"]) or ctx["transcript"]


def bucle(cfg, ctx: dict, ri: float, rf: float) -> float:
    """Clip en bucle: arranca con el remate [ri, rf], después muestra desde el principio hasta el remate.
    Como termina en el mismo momento con el que empieza, al repetirse queda un ciclo. Devuelve los segundos del adelanto."""
    raw = Path(ctx["raw"])
    out = raw.with_name(raw.stem + "_loop.mp4")
    fc = (f"[0:v]trim={ri:.2f}:{rf:.2f},setpts=PTS-STARTPTS[v1];[0:a]atrim={ri:.2f}:{rf:.2f},asetpts=PTS-STARTPTS[a1];"
          f"[0:v]trim=0:{rf:.2f},setpts=PTS-STARTPTS[v2];[0:a]atrim=0:{rf:.2f},asetpts=PTS-STARTPTS[a2];"
          "[v1][a1][v2][a2]concat=n=2:v=1:a=1[v][a]")
    _run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(raw), "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "aac", "-b:a", "160k", str(out)])
    raw.unlink(missing_ok=True)
    ctx["raw"] = str(out)
    T = rf - ri
    adelanto = [(max(0.0, w[0] - ri), min(T, w[1] - ri), *w[2:]) for w in ctx["words"] if w[1] > ri and w[0] < rf]
    cuerpo = [(w[0] + T, min(rf, w[1]) + T, *w[2:]) for w in ctx["words"] if w[0] < rf]
    ctx["words"] = adelanto + cuerpo
    sens = ctx.get("sensibles") or []
    ctx["sensibles"] = ([(max(0.0, a - ri), min(T, b - ri)) for a, b in sens if b > ri and a < rf]
                        + [(a + T, min(rf, b) + T) for a, b in sens if a < rf])
    return T


def proxy(cfg, ctx: dict) -> str:
    """Versión liviana (360p, sin subtítulos) para el detector de risa y el juez: rápida de generar y de subir."""
    out = cfg["data_dir"] / "tmp" / f"{ctx['uid']}_proxy.mp4"
    _run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", ctx["raw"], "-vf", "scale=-2:360", "-r", "15",
          "-c:v", "libx264", "-preset", "ultrafast", "-crf", "32", "-c:a", "aac", "-b:a", "64k", "-ac", "1", str(out)])
    return str(out)


def descartar(ctx: dict):
    for k in ("raw", "proxy"):
        if ctx.get(k):
            Path(ctx[k]).unlink(missing_ok=True)


def finalizar(cfg, streamer, ctx: dict, quitar_frases=(), hook_override: str | None = None, hashtags_extra=()) -> dict:
    """Render final 9:16 con subtítulos (sin las frases que eran audio del juego) y textos del post."""
    r = cfg["render"]
    clips_dir = cfg["data_dir"] / "clips"
    quitar = set(quitar_frases or ())
    if ctx.get("corte"):
        try:
            recortar(cfg, ctx, *ctx["corte"])
        except Exception as e:
            log.warning("no pude recortar %s: %s", ctx["uid"], e)
    t_gancho = 2.5
    if not ctx.get("remate") and r.get("bucle_siempre", True):
        # sin remate marcado por la IA: los clips del público suelen terminar en el momento clave
        try:
            d0 = _duracion(ctx["raw"])
            c0, c1 = ctx["corte"] if ctx.get("corte") else (0.0, d0)
            if c1 - c0 >= 10:
                ctx["remate"] = (c1 - 3.0, c1)
        except Exception:
            pass
    if ctx.get("remate"):
        try:
            off = ctx["corte"][0] if ctx.get("corte") else 0.0
            ri, rf = ctx["remate"][0] - off, ctx["remate"][1] - off
            dur = _duracion(ctx["raw"])
            rf = min(rf, dur)
            if 1.2 <= rf - ri <= 5 and ri >= 4:
                t_gancho = bucle(cfg, ctx, max(0.0, ri), rf)
                ctx["bucle"] = round(t_gancho, 1)
        except Exception as e:
            log.warning("no pude armar el bucle de %s: %s", ctx["uid"], e)
    uid, raw, layout = ctx["uid"], Path(ctx["raw"]), ctx["layout"]
    words = [w for w in ctx["words"] if (w[3] if len(w) > 3 else 0) not in quitar]
    ass = None
    if r.get("burn_subtitles", True) and (words or hook_override):
        ass = cfg["data_dir"] / "tmp" / f"{uid}.ass"
        build_ass(words, ass, r["width"], r["height"], SPLIT_TOP + 0.05 if (layout or {}).get("kind") == "split" else None,
                  gancho=(hook_override, t_gancho) if hook_override and r.get("gancho_en_video", True) else None)
    dur_final = _duracion(raw)
    cubrir = _ventanas(ctx.get("sensibles") or [], 0.6, dur_final)
    modo = r.get("pitido", "fuertes")   # "fuertes", "todas" o "no"
    pitidos = _ventanas([(w[0], w[1]) for w in words if (m := mala_palabra(w[2])) and (modo == "todas" or (modo == "fuertes" and m == "fuerte"))],
                        0.05, dur_final) if modo != "no" else []
    ctx["cubierto_s"] = round(sum(b - a for a, b in cubrir), 1)
    ctx["pitidos"] = len(pitidos)
    final = clips_dir / f"{uid}.mp4"
    vertical(raw, final, f"@{streamer.channel}", ass, r["width"], r["height"], zoom=r.get("fg_zoom", 1.25), maxrate=r.get("max_bitrate"), layout=layout,
             cubrir=cubrir, pitidos=pitidos)
    preview = final
    if final.stat().st_size > r.get("discord_max_mb", 9.5) * 1024 * 1024:
        preview = clips_dir / f"{uid}_preview.mp4"
        dur = float(json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(raw)],
                                              capture_output=True, text=True).stdout)["format"]["duration"])
        kbps = int((r.get("discord_max_mb", 9.5) * 8 * 1024 * 0.85) / max(dur, 1)) - 96
        vertical(raw, preview, f"@{streamer.channel}", ass, r["width"], r["height"], maxrate=f"{max(kbps, 300)}k", scale=0.5, zoom=r.get("fg_zoom", 1.25), layout=layout,
                 cubrir=cubrir, pitidos=pitidos)
    descartar(ctx)
    if ass:
        ass.unlink(missing_ok=True)
    transcript = " ".join(w[2] for w in words) if quitar else ctx["transcript"]
    acc = cfg["accounts"][streamer.account]
    hook, caption, title = make_text(streamer, transcript, acc.get("caption_template", "{hook} {hashtags}"), streamer.language, acc,
                                     hook_override=hook_override, hashtags_extra=hashtags_extra)
    return {"path": str(final), "preview_path": str(preview), "transcript": transcript, "hook": censurar(hook or ""),
            "caption": censurar(caption or ""), "title": censurar(title or "")}


def render_clip(cfg, streamer, segments, peak_wall: float):
    return finalizar(cfg, streamer, preparar(cfg, streamer, segments, peak_wall))
