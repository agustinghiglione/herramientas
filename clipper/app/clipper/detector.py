"""Detección de momentos clipeables ("sentiment analysis" del video).

Señales, segundo a segundo:
  • audio  – picos de volumen (gritos, risas fuertes) respecto de la base del streamer
  • chat   – aceleración de mensajes por segundo respecto de los últimos minutos
  • emotes – risas (KEKW, jaja, 😂, 💀…) y hype (POG, W, "clip"…) en el chat
Se combinan en un puntaje; los picos por encima del umbral son clips.
"""
import re
import subprocess
from collections import deque

import numpy as np

SR = 16000


def audio_db_per_second(path: str) -> np.ndarray:
    """Volumen (dBFS) por segundo del audio de un archivo."""
    cmd = ["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=False).stdout
    a = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    n = len(a) // SR
    if n == 0:
        return np.zeros(0)
    a = a[: n * SR].reshape(n, SR)
    rms = np.sqrt((a ** 2).mean(axis=1) + 1e-10)
    return 20 * np.log10(rms + 1e-10)


def robust_z(x: np.ndarray, ref: np.ndarray) -> np.ndarray:
    if len(ref) < 30:
        ref = x
    med = np.median(ref)
    mad = np.median(np.abs(ref - med)) * 1.4826 + 1e-6
    return (x - med) / mad


def smooth(x: np.ndarray, w: int = 5) -> np.ndarray:
    if len(x) < w:
        return x
    return np.convolve(x, np.ones(w) / w, mode="same")


class StreamDetector:
    """Guarda la historia de un stream (para tener una 'base') y puntúa cada bloque."""

    def __init__(self, cfg: dict):
        self.cfg = cfg["detection"]
        self.audio_hist: deque[float] = deque(maxlen=1800)   # últimos 30 min
        self.chat_hist: deque[float] = deque(maxlen=1800)
        self.last_peak_wall = 0.0
        # calibración del retraso del chat: segundo (reloj real) → volumen / mensajes
        self.lag = float(self.cfg["chat_delay_seconds"])
        self.lag_info = {}
        self.sec_audio: dict[int, float] = {}
        self.sec_chat: dict[int, int] = {}
        laugh = self.cfg["emotes"]["laugh"]
        hype = self.cfg["emotes"]["hype"]
        self.re_laugh = self._mk(laugh)
        self.re_hype = self._mk(hype)
        self.re_jaja = re.compile(r"\b(ja){2,}|\b(ha){2,}|\b(je){2,}|\bxd+\b", re.I)

    @staticmethod
    def _mk(words):
        parts = []
        for w in words:
            if re.match(r"^\w+$", w):
                parts.append(rf"\b{re.escape(w)}\b")
            else:
                parts.append(re.escape(w))
        return re.compile("|".join(parts), re.I) if parts else re.compile(r"(?!x)x")

    def _trim(self, now_sec: int, keep: int = 3600):
        for d in (self.sec_audio, self.sec_chat):
            for k in [k for k in d if k < now_sec - keep]:
                del d[k]

    def estimate_lag(self, max_lag: int = 25, min_seconds: int = 900):
        """Busca cuántos segundos después de un pico de volumen se acelera el chat (correlación cruzada).
        Necesita ~15 min de stream con chat. Devuelve el retraso estimado o None."""
        secs = sorted(self.sec_audio)
        if len(secs) < min_seconds or len(self.sec_chat) < min_seconds:
            return None
        t0, t1 = secs[0], secs[-1]
        a = np.array([self.sec_audio.get(t, np.nan) for t in range(t0, t1 + 1)])
        a = np.nan_to_num(a, nan=np.nanmedian(a))
        a = smooth(np.clip(robust_z(a, a), 0, 8), 3)
        ch = np.array([self.sec_chat.get(t, np.nan) for t in range(t0, t1 + max_lag + 1)], dtype=float)
        if np.isnan(ch).mean() > 0.5:
            return None
        ch = smooth(np.nan_to_num(ch, nan=0.0), 3)
        corr = []
        for L in range(0, max_lag + 1):
            x, y = a, ch[L:L + len(a)]
            m = min(len(x), len(y))
            x, y = x[:m], y[:m]
            if x.std() < 1e-6 or y.std() < 1e-6:
                corr.append(0.0)
                continue
            corr.append(float(np.corrcoef(x, y)[0, 1]))
        corr = np.array(corr)
        best = int(np.argmax(corr))
        strength = float(corr[best] - np.median(corr))
        self.lag_info = {"best": best, "corr": round(float(corr[best]), 3), "strength": round(strength, 3)}
        if corr[best] < 0.05 or strength < 0.02:
            return None  # señal floja: se mantiene el valor anterior
        self.lag = round(0.6 * self.lag + 0.4 * best, 1)
        return self.lag

    def score_segment(self, seg_path: str, seg_wall_start: float, chat_msgs: list[tuple[float, str]], chat_alive: bool):
        """Devuelve (lista de picos [(wall_ts, score, signals)], duración en s)."""
        c = self.cfg
        db = audio_db_per_second(seg_path)
        n = len(db)
        if n < 20:
            return [], n
        z_audio = np.clip(robust_z(db, np.array(self.audio_hist)), 0, 8)
        self.audio_hist.extend(db.tolist())

        # guarda la historia por segundo y re-estima el retraso del chat de ESTE streamer
        s0 = int(seg_wall_start)
        for k, v in enumerate(db):
            self.sec_audio[s0 + k] = float(v)
        cnt: dict[int, int] = {}
        for ts, _ in chat_msgs:
            cnt[int(ts)] = cnt.get(int(ts), 0) + 1
        lo, hi = (int(chat_msgs[0][0]), int(chat_msgs[-1][0])) if chat_msgs else (0, -1)
        for sec in range(lo, hi + 1):
            self.sec_chat[sec] = cnt.get(sec, 0)
        self._trim(s0 + n)
        if chat_alive:
            self.estimate_lag()

        # Chat: mensajes y emotes por segundo, corridos por el retraso del chat
        delay = self.lag
        counts = np.zeros(n)
        emo = np.zeros(n)
        for ts, text in chat_msgs:
            i = int(ts - delay - seg_wall_start)
            if 0 <= i < n:
                counts[i] += 1
                e = len(self.re_laugh.findall(text)) + (1 if self.re_jaja.search(text) else 0)
                e += 0.7 * len(self.re_hype.findall(text))
                emo[i] += min(e, 3)
        counts5 = smooth(counts, 5) * 5
        emo5 = smooth(emo, 5) * 5
        has_chat = chat_alive and counts.sum() > n * 0.05
        if has_chat:
            ref = np.array(self.chat_hist) if len(self.chat_hist) >= 60 else counts5
            mean = max(float(np.mean(ref)), 0.5)
            z_chat = np.clip((counts5 - mean) / np.sqrt(mean + 1), 0, 8)
            z_emo = np.clip(emo5 / (np.sqrt(mean) + 1), 0, 8)
        else:
            z_chat = np.zeros(n)
            z_emo = np.zeros(n)
        self.chat_hist.extend(counts5.tolist())

        w = c["weights"]
        if has_chat:
            score = w["audio"] * smooth(z_audio, 3) * 0.6 + w["chat"] * z_chat * 0.6 + w["emotes"] * z_emo * 0.6
        else:
            score = w["audio"] * smooth(z_audio, 3)  # solo audio: necesita picos más claros
        score = smooth(score, 5)

        thr = c["threshold"] * (1.0 if has_chat else 1.25)
        peaks = []
        order = np.argsort(-score)
        gap = c["min_gap_seconds"]
        for i in order:
            if score[i] < thr or len(peaks) >= c["max_clips_per_segment"]:
                break
            wall = seg_wall_start + float(i)
            if any(abs(wall - p[0]) < gap for p in peaks) or wall - self.last_peak_wall < gap:
                continue
            sig = {
                "audio": round(float(z_audio[i]), 2),
                "chat": round(float(z_chat[i]), 2),
                "emotes": round(float(z_emo[i]), 2),
                "chat_on": bool(has_chat),
            }
            peaks.append((wall, round(float(score[i]), 2), sig))
        if peaks:
            self.last_peak_wall = max(p[0] for p in peaks)
        return sorted(peaks), n
