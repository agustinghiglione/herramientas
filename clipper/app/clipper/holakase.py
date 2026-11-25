"""Plan de contenido de Holakase: videos de jardinería en cámara rápida hechos con Google Flow (clips de 8 s).

Gemini (con la clave de Holakase) propone muchas ideas, se queda con las mejores y escribe, para cada día,
las tomas listas para pegar en Flow. Flow no se maneja por API: los videos los generás vos con esas tomas.
"""
import json
import logging
import os
import time

import requests

log = logging.getLogger("holakase")
API = "https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent"
MODELOS = ["gemini-flash-latest", "gemini-flash-lite-latest"]

PROMPT = """Sos el director de contenido de una cuenta de TikTok llamada Holakase. Formato fijo: un jardinero remodela por completo
un patio o jardín en cámara rápida (time-lapse): limpia, nivela, hace caminos de tierra o piedra, coloca piedras, pone iluminación
y planta. Los videos se generan con Google Flow en tomas de 8 segundos.

Presupuesto: {creditos} créditos por día; cada toma de 8 segundos cuesta {costo} créditos. Entonces cada video lleva {tomas} tomas
(unos {segundos} segundos en TikTok) y se hace 1 video por día.

Primero pensá 25 ideas distintas (tipo de patio, problema inicial, estilo final, momento del día, detalle llamativo). Después elegí
las {dias} con más chances de volverse virales: transformación muy visible entre el principio y el final, un antes impactante
(abandonado, inundado, lleno de yuyos o escombros), un final satisfactorio (luces encendidas de noche, agua, simetría),
variedad entre días y nada repetido.

Para cada día escribí:
- "titulo": nombre corto de la idea.
- "gancho": texto en pantalla de máximo 8 palabras para el primer segundo, en español neutro, sin emojis.
- "tomas": lista de exactamente {tomas} prompts en inglés para Google Flow, uno por toma de 8 segundos, en orden. Cada prompt describe
  la escena completa (mismo patio, misma cámara fija en plano general, mismo jardinero, luz coherente), estilo realista,
  time-lapse acelerado, sin texto en pantalla. La primera toma muestra el estado inicial y el arranque del trabajo; la última,
  el resultado final con un plano lindo (de noche con luces si corresponde).
- "texto_post": descripción para TikTok de 1 o 2 líneas en español neutro que invite a comentar, sin emojis.
- "hashtags": 5 hashtags sin "#", en minúscula.

Respondé SOLO un JSON: {{"dias": [ ... ]}} con {dias} elementos."""


def clave() -> str | None:
    return os.environ.get("GEMINI_API_KEY_HOLAKASE")


def generar_plan(dias: int = 14, creditos: int = 50, costo: int = 10, segundos_toma: int = 8) -> list[dict]:
    key = clave()
    if not key:
        raise RuntimeError("Falta la clave de Gemini de Holakase. En la consola: clipper-gemini holakase")
    tomas = max(1, creditos // costo - 1) if creditos // costo > 4 else max(1, creditos // costo)  # deja margen para repetir una toma
    tomas = min(tomas, 4)
    body = {"contents": [{"parts": [{"text": PROMPT.format(creditos=creditos, costo=costo, tomas=tomas,
                                                            segundos=tomas * segundos_toma, dias=dias)}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.9}}
    ultimo = None
    for modelo in MODELOS:
        for intento in range(2):
            r = requests.post(API.format(m=modelo), headers={"x-goog-api-key": key}, json=body, timeout=240)
            if r.status_code == 429 and "per day" in r.text:
                ultimo = f"{modelo}: cupo diario agotado"
                break
            if r.status_code == 429 or r.status_code >= 500:
                ultimo = f"{modelo}: {r.status_code}"
                time.sleep(15)
                continue
            if r.status_code >= 400:
                raise RuntimeError(f"Gemini {r.status_code}: {r.text[:200]}")
            txt = r.json()["candidates"][0]["content"]["parts"][0]["text"]
            d = json.loads(txt[txt.find("{"): txt.rfind("}") + 1])
            plan = [x for x in d.get("dias", []) if x.get("tomas")][:dias]
            if plan:
                return plan
            ultimo = f"{modelo}: respuesta vacía"
    raise RuntimeError(f"No pude generar el plan ({ultimo})")
