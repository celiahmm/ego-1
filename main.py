"""Serveur web temps réel du jeu « EGO-1 »."""

import asyncio
import io
import secrets
import time
from contextlib import asynccontextmanager
from pathlib import Path

import segno
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware

try:
    from .game import Parties
except ImportError:
    from game import Parties

STATIC = Path(__file__).parent / "static"
parties = Parties()
connexions = {}  # code -> {"animateurs": set(ws), "joueurs": {id_joueur: set(ws)}}


def salle(code):
    return connexions.setdefault(code, {"animateurs": set(), "joueurs": {}})


def nb_joueurs(code):
    return sum(1 for sockets in salle(code)["joueurs"].values() if sockets)


async def envoyer(ws, message):
    try:
        await ws.send_json(message)
    except Exception:
        pass


async def diffuser(partie):
    s = salle(partie.code)
    etat = partie.etat(nb_joueurs(partie.code))
    envois = [envoyer(ws, {"type": "etat", "role": "animateur", **etat}) for ws in list(s["animateurs"])]
    for id_joueur, sockets in list(s["joueurs"].items()):
        message = {"type": "etat", "role": "joueur", "mon_vote": partie.votes.get(id_joueur), "mon_profil": partie.profil(id_joueur), **etat}
        envois += [envoyer(ws, message) for ws in list(sockets)]
    await asyncio.gather(*envois)


async def minuteur():
    while True:
        await asyncio.sleep(0.5)
        for partie in list(parties.parties.values()):
            if partie.phase == "vote" and partie.fin_vote and time.time() >= partie.fin_vote:
                partie.cloturer_vote()
                await diffuser(partie)


@asynccontextmanager
async def cycle_de_vie(_app):
    tache = asyncio.create_task(minuteur())
    yield
    tache.cancel()


app = FastAPI(title="EGO-1", lifespan=cycle_de_vie)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/")
def accueil():
    return FileResponse(STATIC / "index.html")


@app.get("/animateur")
def page_animateur():
    return FileResponse(STATIC / "animateur.html")


@app.get("/jouer")
def page_joueur():
    return FileResponse(STATIC / "jouer.html")


@app.get("/healthz")
def sante():
    return {"ok": True, "parties": len(parties.parties)}


@app.post("/api/parties")
def creer_partie():
    return {"code": parties.creer().code}


@app.get("/api/parties/{code}")
def verifier_partie(code: str):
    partie = parties.get(code)
    if not partie:
        raise HTTPException(404, "Partie introuvable")
    return {"code": partie.code, "phase": partie.phase}


@app.get("/qr.svg")
def qr_code(url: str = Query(..., max_length=500)):
    tampon = io.BytesIO()
    segno.make(url, error="m").save(tampon, kind="svg", scale=10, border=2, dark="#0b2b26", light="#ffffff")
    return Response(tampon.getvalue(), media_type="image/svg+xml")


@app.websocket("/ws/{code}")
async def websocket(ws: WebSocket, code: str, role: str = "joueur", id: str = ""):
    partie = parties.get(code)
    await ws.accept()
    if not partie:
        await envoyer(ws, {"type": "erreur", "message": "Partie introuvable. Vérifiez le code."})
        await ws.close()
        return
    s = salle(partie.code)
    animateur = role == "animateur"
    id_joueur = id[:64] or f"anonyme-{secrets.token_hex(4)}"
    if animateur:
        s["animateurs"].add(ws)
    else:
        s["joueurs"].setdefault(id_joueur, set()).add(ws)
    await diffuser(partie)
    try:
        while True:
            message = await ws.receive_json()
            partie.activite = time.time()
            action = message.get("action")
            if animateur:
                if action == "demarrer":
                    duree = message.get("duree")
                    partie.duree_vote = int(duree) if isinstance(duree, int) and 0 <= duree <= 600 else 45
                    partie.ouvrir_profil()
                elif action == "lancer":
                    partie.lancer()
                elif action == "cloturer":
                    partie.cloturer_vote()
                elif action == "forcer":
                    partie.cloturer_vote(choix_force=message.get("choix"))
                elif action == "suivant" and partie.phase == "resultat":
                    partie.situation_suivante()
                elif action == "prolonger" and partie.phase == "vote" and partie.fin_vote:
                    partie.fin_vote += 15
                elif action == "recommencer":
                    partie.reinitialiser()
                else:
                    continue
            elif action == "voter":
                if not partie.voter(id_joueur, message.get("choix")):
                    continue
            elif action == "repondre":
                if not partie.repondre(id_joueur, message.get("choix")):
                    continue
            else:
                continue
            await diffuser(partie)
    except (WebSocketDisconnect, RuntimeError, ValueError):
        pass
    finally:
        if animateur:
            s["animateurs"].discard(ws)
        else:
            s["joueurs"].get(id_joueur, set()).discard(ws)
        await diffuser(partie)
