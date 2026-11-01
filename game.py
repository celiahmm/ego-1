"""Logique du jeu « EGO-1 » (indépendante du réseau).

Déroulé : accueil -> profil (test individuel sur chaque téléphone) -> vote -> resultat
-> ... (12 jours, un vote majoritaire par jour) -> fin.
"""

import json
import random
import secrets
import time
from collections import Counter
from pathlib import Path

SCENARIO = json.loads((Path(__file__).parent / "scenario.json").read_text(encoding="utf-8"))
INDICATEURS = list(SCENARIO["indicateurs"])
QUIZ = SCENARIO["quiz"]
JOURS = SCENARIO["jours"]
LETTRES = "ABCD"


def borner(valeur):
    return max(0, min(100, valeur))


def depart():
    return {k: v["depart"] for k, v in SCENARIO["indicateurs"].items()}


def type_ego(score):
    for t in SCENARIO["types"]:
        if score >= t["seuil"]:
            return t["nom"]
    return SCENARIO["types"][-1]["nom"]


class Partie:
    def __init__(self, code):
        self.code = code
        self.cree_le = time.time()
        self.activite = time.time()
        self.duree_vote = 45
        self.reinitialiser()

    def reinitialiser(self):
        self.phase = "accueil"
        self.etape = -1
        self.indicateurs = depart()
        self.depart = depart()
        self.historique = []
        self.votes = {}
        self.profils = {}  # id_joueur -> liste des réponses au test
        self.fin_vote = None
        self.resultat = None

    @property
    def situation(self):
        return JOURS[self.etape] if 0 <= self.etape < len(JOURS) else None

    # ---- Test « Quel type d'égoïste es-tu ? » (individuel) ----
    def ouvrir_profil(self):
        if self.phase == "accueil":
            self.phase = "profil"

    def repondre(self, joueur, choix):
        if self.phase != "profil":
            return False
        reponses = self.profils.setdefault(joueur, [])
        i = len(reponses)
        if i >= len(QUIZ) or not isinstance(choix, int) or not 0 <= choix < len(QUIZ[i]["choix"]):
            return False
        reponses.append(choix)
        return True

    def profil(self, joueur):
        reponses = self.profils.get(joueur, [])
        choix = [QUIZ[i]["choix"][c] for i, c in enumerate(reponses)]
        ego = sum(c["egoisme"] for c in choix)
        fini = len(reponses) == len(QUIZ)
        return {
            "index": len(reponses),
            "total": len(QUIZ),
            "fini": fini,
            "planete": sum(c["planete"] for c in choix),
            "type": type_ego(ego) if fini else None,
        }

    def types_salle(self):
        finis = [p for p in map(self.profil, self.profils) if p["fini"]]
        compte = Counter(p["type"] for p in finis)
        return [{"nom": t["nom"], "couleur": t["couleur"], "n": compte.get(t["nom"], 0)} for t in SCENARIO["types"]]

    def lancer(self):
        """La planète de départ reflète les habitudes de la salle (moyenne des profils terminés)."""
        if self.phase != "profil":
            return
        finis = [p for p in map(self.profil, self.profils) if p["fini"]]
        if finis:
            moyenne = sum(p["planete"] for p in finis) / len(finis)
            self.indicateurs["planete"] = borner(round(SCENARIO["indicateurs"]["planete"]["depart"] + moyenne))
        self.depart = dict(self.indicateurs)
        self.situation_suivante()

    # ---- Les 12 jours ----
    def appliquer(self, effets):
        deltas = {}
        for cle, valeur in effets.items():
            if cle in self.indicateurs:
                avant = self.indicateurs[cle]
                self.indicateurs[cle] = borner(avant + valeur)
                deltas[cle] = self.indicateurs[cle] - avant
        return deltas

    def situation_suivante(self):
        self.etape += 1
        self.votes = {}
        self.resultat = None
        # Comme dans le concept : Ego-1 s'éteint dès que son envie tombe à 0.
        if self.etape >= len(JOURS) or self.indicateurs["envie"] <= 0:
            self.phase = "fin"
            self.fin_vote = None
            return
        self.phase = "vote"
        self.fin_vote = time.time() + self.duree_vote if self.duree_vote else None

    def voter(self, joueur, choix):
        if self.phase == "vote" and isinstance(choix, int) and 0 <= choix < len(self.situation["choix"]):
            self.votes[joueur] = choix
            return True
        return False

    def decompte(self):
        compte = Counter(self.votes.values())
        return [compte.get(i, 0) for i in range(len(self.situation["choix"]))] if self.situation else []

    def cloturer_vote(self, choix_force=None):
        if self.phase != "vote":
            return
        situation = self.situation
        decompte = self.decompte()
        mode = "majorite"
        if choix_force is not None and 0 <= choix_force < len(situation["choix"]):
            gagnant, mode = choix_force, "animateur"
        elif sum(decompte) == 0:
            gagnant, mode = random.randrange(len(situation["choix"])), "aucun_vote"
        else:
            maximum = max(decompte)
            ex_aequo = [i for i, n in enumerate(decompte) if n == maximum]
            gagnant = random.choice(ex_aequo)
            if len(ex_aequo) > 1:
                mode = "egalite"
        choix = situation["choix"][gagnant]
        deltas = self.appliquer(choix["effets"])
        self.resultat = {
            "gagnant": gagnant,
            "mode": mode,
            "decompte": decompte,
            "effets": deltas,
            "commentaire": random.choice(choix["commentaires"]),
        }
        self.historique.append({
            "jour": situation["jour"],
            "titre": situation["titre"],
            "choix": choix["titre"],
            "lettre": LETTRES[gagnant],
            "icone": choix["icone"],
        })
        self.phase = "resultat"
        self.fin_vote = None

    def bilan(self):
        planete, envie = self.indicateurs["planete"], self.indicateurs["envie"]
        if envie <= 0:
            cle = "eteint"
        elif envie < 35:
            cle = "survit"
        elif planete > 75 and envie > 70:
            cle = "lueur"
        else:
            cle = "fatigue"
        return {"fin": SCENARIO["fins"][cle], "types": self.types_salle()}

    def etat(self, nb_joueurs):
        situation = self.situation
        restant = max(0, round(self.fin_vote - time.time())) if self.fin_vote else None
        etat = {
            "code": self.code,
            "robot": SCENARIO["robot"],
            "phase": self.phase,
            "etape": self.etape,
            "nb_etapes": len(JOURS),
            "nb_quiz": len(QUIZ),
            "nb_joueurs": nb_joueurs,
            "nb_votes": len(self.votes),
            "duree_vote": self.duree_vote,
            "restant": restant,
            "indicateurs": self.indicateurs,
            "historique": self.historique,
            "jours": [j["jour"] for j in JOURS],
            "depart": self.depart,
            "profils": {
                "finis": sum(1 for p in map(self.profil, self.profils) if p["fini"]),
                "commences": len(self.profils),
                "types": self.types_salle(),
            },
        }
        if self.phase == "profil":
            etat["quiz"] = [{"q": q["q"], "choix": [c["t"] for c in q["choix"]], "icones": [c.get("icone", "") for c in q["choix"]]} for q in QUIZ]
            etat["reactions_quiz"] = SCENARIO.get("reactions_quiz", {})
        if situation:
            etat["situation"] = situation
            etat["decompte"] = self.decompte()
        if self.resultat:
            etat["resultat"] = self.resultat
        if self.phase == "fin":
            etat["bilan"] = self.bilan()
        return etat


class Parties:
    ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"  # sans I ni O (confusion avec 1 et 0)

    def __init__(self):
        self.parties = {}

    def creer(self):
        self.nettoyer()
        while True:
            code = "".join(secrets.choice(self.ALPHABET) for _ in range(4))
            if code not in self.parties:
                self.parties[code] = Partie(code)
                return self.parties[code]

    def get(self, code):
        return self.parties.get((code or "").upper())

    def nettoyer(self, age_max=6 * 3600):
        limite = time.time() - age_max
        for code in [c for c, p in self.parties.items() if p.activite < limite]:
            del self.parties[code]