"""Detector de risa (modelo de jrgillick/laughter-detection, Interspeech 2021) corriendo en el VPS.
Devuelve cuántos segundos de risa hay en el audio de un clip."""
import logging
import os
import sys
import threading
from pathlib import Path

import numpy as np

log = logging.getLogger("risa")
REPO = Path(os.environ.get("CLIPPER_LAUGH_REPO", "/opt/clipper/laughter-detection"))
CKPT = REPO / "checkpoints" / "in_use" / "resnet_with_augmentation" / "best.pth.tar"
_model = None
_lock = threading.Lock()


def disponible() -> bool:
    return CKPT.exists()


def _cargar():
    global _model
    with _lock:
        if _model is None:
            import torch
            torch.set_num_threads(2)
            sys.path.insert(0, str(REPO))
            import models  # del repo: solo usa torch
            m = models.ResNetBigger(dropout_rate=0.0, linear_layer_size=128, filter_sizes=[128, 64, 32, 32])
            ck = torch.load(str(CKPT), map_location="cpu", weights_only=False)
            m.load_state_dict(ck["state_dict"])
            m.eval()
            _model = m
    return _model


def risas(path: str, threshold: float = 0.5, min_length: float = 0.2, paso: int = 6) -> dict:
    """{'segundos': total de risa, 'cantidad': risas detectadas, 'max': probabilidad máxima}"""
    import librosa
    import torch
    from scipy import signal
    model = _cargar()
    import subprocess
    sr = 8000
    raw = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True).stdout
    y = np.frombuffer(raw, dtype=np.float32).copy()
    if len(y) < sr * 2:
        return {"segundos": 0.0, "cantidad": 0, "max": 0.0}
    dur = len(y) / sr
    S = librosa.amplitude_to_db(librosa.feature.melspectrogram(y=y, sr=sr, hop_length=186).T, ref=np.max)
    n = 44
    if len(S) <= n + 10:
        return {"segundos": 0.0, "cantidad": 0, "max": 0.0}
    win = np.stack([S[i:i + n] for i in range(0, len(S) - n, paso)])[:, None, :, :]  # 1 de cada `paso` ventanas: ~7 lecturas/s
    probs = []
    with torch.no_grad():
        for i in range(0, len(win), 256):
            p = model(torch.from_numpy(win[i:i + 256]).float()).squeeze(-1).numpy()
            probs.extend(np.atleast_1d(p).tolist())
    probs = np.array(probs)
    B, A = signal.butter(2, min(0.01 * paso, 0.5), output="ba")
    probs = signal.filtfilt(B, A, probs) if len(probs) > 12 else probs
    fps = len(probs) / dur
    inst, cur = [], []
    for i, p in enumerate(probs):
        if p > threshold:
            cur.append(i)
        elif cur:
            inst.append(cur); cur = []
    if cur:
        inst.append(cur)
    spans = [(c[0] / fps, c[-1] / fps) for c in inst]
    spans = [s for s in spans if s[1] - s[0] > min_length]
    return {"segundos": round(sum(b - a for a, b in spans), 2), "cantidad": len(spans), "max": round(float(probs.max()), 3)}
