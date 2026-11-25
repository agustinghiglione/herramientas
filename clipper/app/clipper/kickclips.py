"""Clips que ya hizo el público en Kick: los más vistos de cada canal (son momentos elegidos por personas)."""
import logging

log = logging.getLogger("kickclips")


def top(channel: str, periodo: str = "day", paginas: int = 3) -> list[dict]:
    from curl_cffi import requests as creq
    crudos, cursor = [], None
    for _ in range(paginas):
        params = {"sort": "view", "time": periodo}
        if cursor:
            params["cursor"] = cursor
        r = creq.get(f"https://kick.com/api/v2/channels/{channel}/clips", params=params, impersonate="chrome", timeout=25)
        r.raise_for_status()
        data = r.json()
        crudos += (data.get("clips") if isinstance(data, dict) else data) or []
        cursor = data.get("nextCursor") if isinstance(data, dict) else None
        if not cursor:
            break
    out = []
    for c in crudos:
        url = c.get("clip_url") or c.get("video_url")
        if not url or c.get("privacy", "public") != "public":
            continue
        out.append({
            "id": c["id"],
            "title": c.get("title") or "",
            "url": url,
            "views": int(c.get("views") or c.get("view_count") or 0),
            "duration": float(c.get("duration") or 0),
            "categoria": ((c.get("category") or {}).get("name") or ""),
            "creador": ((c.get("creator") or {}).get("username") or ""),
            "created_at": c.get("created_at") or "",
        })
    return out
