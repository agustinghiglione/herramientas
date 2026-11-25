import os
from dataclasses import dataclass
from pathlib import Path

import yaml

CONFIG_PATH = Path(os.environ.get("CLIPPER_CONFIG", "/opt/clipper/config.yaml"))


@dataclass(frozen=True)
class Streamer:
    account: str
    name: str
    platform: str
    channel: str
    language: str
    keywords: tuple | None = None

    @property
    def key(self) -> str:
        return f"{self.account}:{self.platform}:{self.channel.lower()}"

    @property
    def url(self) -> str:
        if self.platform == "twitch":
            return f"https://www.twitch.tv/{self.channel}"
        if self.platform == "kick":
            return f"https://kick.com/{self.channel}"
        if self.platform == "youtube":
            ch = self.channel
            if ch.startswith("http"):
                return ch
            if ch.startswith("UC") and len(ch) == 24:
                return f"https://www.youtube.com/channel/{ch}/live"
            if not ch.startswith("@"):
                ch = "@" + ch
            return f"https://www.youtube.com/{ch}/live"
        raise ValueError(f"Plataforma desconocida: {self.platform}")

    @property
    def tag(self) -> str:
        return "".join(c for c in self.name.lower() if c.isalnum())


def load() -> dict:
    with open(CONFIG_PATH, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    cfg["data_dir"] = Path(cfg.get("data_dir", "/opt/clipper/data"))
    for sub in ("segments", "clips", "chat", "tmp"):
        (cfg["data_dir"] / sub).mkdir(parents=True, exist_ok=True)
    return cfg


def streamers(cfg: dict) -> list[Streamer]:
    out = []
    for acc_name, acc in (cfg.get("accounts") or {}).items():
        if not acc.get("enabled", True):
            continue
        for s in acc.get("streamers") or []:
            kw = tuple(k.lower() for k in s["keywords"]) if "keywords" in s else None
            out.append(Streamer(acc_name, s["name"], s["platform"].lower(), str(s["channel"]), acc.get("language", "es"), kw))
    return out


def env(name: str, required: bool = True) -> str | None:
    v = os.environ.get(name)
    if required and not v:
        raise RuntimeError(f"Falta la variable {name} en /opt/clipper/.env")
    return v
