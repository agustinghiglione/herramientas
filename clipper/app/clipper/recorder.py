"""Detección de directos y grabación con Streamlink en bloques de 10 minutos."""
import csv
import logging
import shlex
import subprocess
import sys
import time
from pathlib import Path

log = logging.getLogger("recorder")


def check_live(url: str) -> dict | None:
    """Devuelve {'title','category'} si el canal está en vivo, None si no.
    Usa Streamlink, que funciona con Twitch, Kick y YouTube sin claves de API."""
    from streamlink import Streamlink
    from streamlink.exceptions import NoPluginError, PluginError
    s = Streamlink()
    try:
        name, cls, resolved = s.resolve_url(url)
        plugin = cls(s, resolved)
        streams = plugin.streams()
        if not streams:
            return None
        return {"title": plugin.get_title() or "", "category": plugin.get_category() or ""}
    except (NoPluginError, PluginError) as e:
        log.debug("check_live %s: %s", url, e)
        return None
    except Exception as e:
        log.warning("check_live %s: %s", url, e)
        return None


class Recording:
    def __init__(self, streamer, stream_id: int, out_dir: Path, segment_seconds: int, quality: str):
        self.streamer = streamer
        self.stream_id = stream_id
        self.dir = out_dir
        self.dir.mkdir(parents=True, exist_ok=True)
        self.segment_seconds = segment_seconds
        self.quality = quality
        self.proc: subprocess.Popen | None = None
        self.started = 0.0
        self.seen: set[str] = set()
        self.segments: list[tuple[str, float, float]] = []  # (path, wall_start, wall_end)
        self.t_offset: float | None = None

    def start(self):
        self.started = time.time()
        tag = int(self.started)
        self.list_csv = self.dir / f"list_{tag}.csv"
        pattern = self.dir / f"seg_{tag}_%05d.ts"
        url = self.streamer.url
        sl = [str(Path(sys.executable).with_name("streamlink")), "--stdout", "--loglevel", "warning", "--retry-streams", "20", "--retry-max", "3",
              "--hls-live-edge", "3"]
        if self.streamer.platform == "twitch":
            sl += ["--twitch-disable-ads"]
        sl += [url, self.quality]
        ff = ["ffmpeg", "-nostdin", "-v", "error", "-i", "pipe:0", "-map", "0:v:0?", "-map", "0:a:0?", "-c", "copy",
              "-f", "segment", "-segment_time", str(self.segment_seconds), "-reset_timestamps", "1",
              "-segment_list", str(self.list_csv), "-segment_list_type", "csv", str(pattern)]
        cmd = f"{shlex.join(sl)} | {shlex.join(ff)}"
        log.info("Grabando %s → %s", self.streamer.name, self.dir)
        self.proc = subprocess.Popen(["bash", "-o", "pipefail", "-c", cmd], stdout=subprocess.DEVNULL,
                                     stderr=open(self.dir / "rec.log", "ab"))

    @property
    def running(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    def stop(self):
        if self.running:
            self.proc.terminate()
            try:
                self.proc.wait(15)
            except subprocess.TimeoutExpired:
                self.proc.kill()

    def new_segments(self) -> list[tuple[str, float, float]]:
        """Bloques que ffmpeg ya cerró (aparecen en la lista CSV)."""
        out = []
        if not self.list_csv.exists():
            return out
        with open(self.list_csv, newline="") as f:
            for row in csv.reader(f):
                if len(row) < 3:
                    continue
                name, st, en = row[0], float(row[1]), float(row[2])
                path = str(self.dir / name)
                if path in self.seen:
                    continue
                self.seen.add(path)
                if self.t_offset is None:
                    self.t_offset = st  # los PTS del stream no arrancan en 0
                seg = (path, self.started + st - self.t_offset, self.started + en - self.t_offset)
                self.segments.append(seg)
                out.append(seg)
        return out

    def cleanup(self, keep_minutes: int):
        cutoff = time.time() - keep_minutes * 60
        keep = []
        for p, a, b in self.segments:
            if b < cutoff:
                Path(p).unlink(missing_ok=True)
            else:
                keep.append((p, a, b))
        self.segments = keep
        # restos de grabaciones anteriores (por ejemplo, después de reiniciar el servicio)
        mine = {p for p, _, _ in keep}
        for f in list(self.dir.glob("seg_*.ts")) + list(self.dir.glob("list_*.csv")):
            try:
                if str(f) not in mine and f.stat().st_mtime < cutoff:
                    f.unlink(missing_ok=True)
            except FileNotFoundError:
                pass
