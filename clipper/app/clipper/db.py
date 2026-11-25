import json
import sqlite3
import threading
import time
from pathlib import Path

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skey TEXT, account TEXT, streamer TEXT, platform TEXT, title TEXT,
  started REAL, ended REAL
);
CREATE TABLE IF NOT EXISTS clips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_id INTEGER, account TEXT, streamer TEXT, platform TEXT, tag TEXT,
  peak_wall REAL, score REAL, signals TEXT,
  path TEXT, preview_path TEXT, transcript TEXT, hook TEXT, caption TEXT, title TEXT,
  status TEXT DEFAULT 'rendering',
  channel_id INTEGER, message_id INTEGER,
  pfm_post_id TEXT, scheduled_at TEXT, result TEXT,
  created REAL, updated REAL
);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
"""


def init(path: Path):
    global _conn
    _conn = sqlite3.connect(str(path), check_same_thread=False)
    _conn.row_factory = sqlite3.Row
    _conn.executescript(SCHEMA)
    _conn.commit()


def q(sql: str, args=(), one=False):
    with _lock:
        cur = _conn.execute(sql, args)
        _conn.commit()
        rows = cur.fetchall()
        if sql.lstrip().upper().startswith("INSERT"):
            return cur.lastrowid
    if one:
        return dict(rows[0]) if rows else None
    return [dict(r) for r in rows]


def update_clip(clip_id: int, **fields):
    fields["updated"] = time.time()
    for k, v in list(fields.items()):
        if isinstance(v, (dict, list)):
            fields[k] = json.dumps(v, ensure_ascii=False)
    cols = ", ".join(f"{k}=?" for k in fields)
    q(f"UPDATE clips SET {cols} WHERE id=?", (*fields.values(), clip_id))


def get_clip(clip_id: int) -> dict | None:
    return q("SELECT * FROM clips WHERE id=?", (clip_id,), one=True)


def kv_get(k: str, default=None):
    r = q("SELECT v FROM kv WHERE k=?", (k,), one=True)
    return json.loads(r["v"]) if r else default


def kv_set(k: str, v):
    q("INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", (k, json.dumps(v)))
