"""Captura del chat en vivo (Twitch IRC anónimo, Kick vía Pusher, YouTube vía chat-downloader).

Cada mensaje se guarda como (timestamp_unix, texto). El detector usa la
velocidad del chat y los emotes como señal de "momento clipeable".
"""
import asyncio
import json
import logging
import random
import ssl
import threading
import time
from collections import deque

log = logging.getLogger("chat")

KICK_PUSHER = "wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false"


class ChatBuffer:
    def __init__(self, keep_seconds: int = 3600):
        self.msgs: deque[tuple[float, str]] = deque()
        self.keep = keep_seconds
        self.lock = threading.Lock()
        self.alive = False  # True cuando la conexión al chat funciona

    def add(self, text: str, ts: float | None = None):
        ts = ts or time.time()
        with self.lock:
            self.msgs.append((ts, text))
            cutoff = ts - self.keep
            while self.msgs and self.msgs[0][0] < cutoff:
                self.msgs.popleft()

    def window(self, t0: float, t1: float) -> list[tuple[float, str]]:
        with self.lock:
            return [m for m in self.msgs if t0 <= m[0] < t1]


class ChatReader:
    """Lee el chat de un canal mientras dure la grabación."""

    def __init__(self, platform: str, channel: str, url: str, buf: ChatBuffer):
        self.platform, self.channel, self.url, self.buf = platform, channel, url, buf
        self._stop = threading.Event()
        self._task: asyncio.Task | None = None
        self._thread: threading.Thread | None = None

    def start(self, loop: asyncio.AbstractEventLoop):
        if self.platform == "twitch":
            self._task = loop.create_task(self._twitch())
        elif self.platform == "kick":
            self._task = loop.create_task(self._kick())
        elif self.platform == "youtube":
            self._thread = threading.Thread(target=self._youtube, daemon=True)
            self._thread.start()

    def stop(self):
        self._stop.set()
        if self._task:
            self._task.cancel()

    # ── Twitch: IRC anónimo, no requiere credenciales ──
    async def _twitch(self):
        chan = self.channel.lower().lstrip("#")
        while not self._stop.is_set():
            try:
                reader, writer = await asyncio.open_connection("irc.chat.twitch.tv", 6697, ssl=ssl.create_default_context())
                nick = f"justinfan{random.randint(10000, 99999)}"
                writer.write(f"NICK {nick}\r\nJOIN #{chan}\r\n".encode())
                await writer.drain()
                self.buf.alive = True
                while not self._stop.is_set():
                    line = (await reader.readline()).decode("utf-8", "ignore")
                    if not line:
                        break
                    if line.startswith("PING"):
                        writer.write(b"PONG :tmi.twitch.tv\r\n")
                        await writer.drain()
                    elif " PRIVMSG " in line:
                        self.buf.add(line.split(" :", 1)[-1].strip())
            except asyncio.CancelledError:
                return
            except Exception as e:
                log.warning("twitch chat %s: %s", chan, e)
            self.buf.alive = False
            await asyncio.sleep(5)

    # ── Kick: websocket público de Pusher ──
    async def _kick(self):
        import websockets
        try:
            chatroom_id = await asyncio.to_thread(self._kick_chatroom_id)
        except Exception as e:
            log.warning("kick: no pude obtener chatroom de %s (%s); sigo solo con audio", self.channel, e)
            return
        while not self._stop.is_set():
            try:
                async with websockets.connect(KICK_PUSHER, open_timeout=15) as ws:
                    await ws.send(json.dumps({"event": "pusher:subscribe", "data": {"auth": "", "channel": f"chatrooms.{chatroom_id}.v2"}}))
                    self.buf.alive = True
                    async for raw in ws:
                        msg = json.loads(raw)
                        ev = msg.get("event", "")
                        if ev == "pusher:ping":
                            await ws.send(json.dumps({"event": "pusher:pong", "data": {}}))
                        elif "ChatMessage" in ev:
                            data = json.loads(msg.get("data") or "{}")
                            self.buf.add(str(data.get("content", "")))
            except asyncio.CancelledError:
                return
            except Exception as e:
                log.warning("kick chat %s: %s", self.channel, e)
            self.buf.alive = False
            await asyncio.sleep(5)

    def _kick_chatroom_id(self) -> int:
        from curl_cffi import requests as creq
        r = creq.get(f"https://kick.com/api/v2/channels/{self.channel}", impersonate="chrome", timeout=20)
        r.raise_for_status()
        return int(r.json()["chatroom"]["id"])

    # ── YouTube: chat-downloader (bloqueante, va en un hilo) ──
    def _youtube(self):
        from chat_downloader import ChatDownloader
        while not self._stop.is_set():
            try:
                chat = ChatDownloader().get_chat(self.url, message_types=["text_message", "paid_message"])
                self.buf.alive = True
                for m in chat:
                    if self._stop.is_set():
                        return
                    self.buf.add(str(m.get("message", "")))
            except Exception as e:
                log.warning("youtube chat %s: %s", self.channel, e)
            self.buf.alive = False
            self._stop.wait(15)
