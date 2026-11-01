const params = new URLSearchParams(location.search);
const code = (params.get("code") || "").toUpperCase();
if (!code) location.href = "/";

const urlJoueur = `${location.origin}/jouer?code=${code}`;
const backend = (window.EGO1_CONFIG?.backendUrl || location.origin).replace(/\/$/, "");
const urlQr = `${backend}/qr.svg?url=${encodeURIComponent(urlJoueur)}`;
const $ = (id) => document.getElementById(id);
$("code").textContent = code;
document.querySelector("#mini-qr img").src = urlQr;
document.querySelector("#mini-qr span").textContent = code;

let etat = null;
let cleAffichee = null;
let finMinuteur = null;

const connexion = connecter(code, "animateur", "animateur", (message) => {
  if (message.type === "erreur") {
    $("scene").innerHTML = `<div class="fiche"><h2>${echapper(message.message)}</h2><a href="/">Retour à l'accueil</a></div>`;
    return;
  }
  etat = message;
  afficher();
});
const envoyer = (action, extra = {}) => connexion.envoyer({ action, ...extra });

$("plein-ecran").onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
};
document.addEventListener("fullscreenchange", () => {
  const actif = Boolean(document.fullscreenElement);
  document.body.classList.toggle("mode-projection", actif);
  $("plein-ecran").textContent = actif ? "Quitter le plein écran" : "Plein écran";
  $("plein-ecran").setAttribute("aria-pressed", String(actif));
});
$("mode-manuel").onchange = () => { cleAffichee = null; afficher(); };

function afficher() {
  if (!etat) return;
  $("nb-joueurs").textContent = etat.nb_joueurs;
  $("parcours").innerHTML = parcoursHtml(etat);
  $("ecran").classList.toggle("fin", etat.phase === "fin");
  $("mini-qr").classList.toggle("cache", etat.phase === "accueil" || etat.phase === "fin");
  finMinuteur = etat.restant != null ? Date.now() + etat.restant * 1000 : null;
  afficherRobot();

  const cle = `${etat.phase}-${etat.etape}`;
  if (cle !== cleAffichee) {
    cleAffichee = cle;
    const vues = { accueil: vueAccueil, profil: vueProfil, vote: vueVote, resultat: vueResultat, fin: vueFin };
    $("scene").innerHTML = vues[etat.phase]();
    brancherBoutons();
    if (etat.phase === "resultat") setTimeout(animerResultat, 500);
    if (etat.phase === "fin") animerJetons();
  }
  majDynamique();
}

let cleRobot = null;
let valeursPrecedentes = null;

// Colonne de gauche : Ego-1 (son humeur suit son envie) et ses deux jauges.
function afficherRobot() {
  const cle = JSON.stringify([etat.phase, etat.etape, etat.indicateurs]);
  if (cle === cleRobot) return;
  cleRobot = cle;
  const effets = etat.phase === "resultat" && etat.resultat ? etat.resultat.effets : {};
  $("gauche").innerHTML = `<div class="fiche robot-fiche">${robotSVG(humeurDe(etat.indicateurs.envie))}</div>
    <div class="fiche pistes">${pistesHtml(etat.indicateurs, { deltas: effets, depuis: valeursPrecedentes })}</div>`;
  valeursPrecedentes = { ...etat.indicateurs };
  animerJetons();
}

function vueAccueil() {
  return `<div class="fiche lobby">
      <div class="qr"><img src="${urlQr}" alt="QR code pour rejoindre"></div>
      <div>
        <span class="ruban">Scannez pour rejoindre la partie</span>
        <div class="code">${code}</div>
        <div class="url">${echapper(urlJoueur)}</div>
        <div style="margin:4px 0 12px">ou allez sur <b>${echapper(location.host)}</b> et entrez le code. Pas de compte, pas d'infos personnelles.</div>
        <div class="nb"><span id="nb-lobby">${etat.nb_joueurs}</span> citoyen(ne)s connecté(e)s</div>
      </div>
    </div>
    <div class="fiche" style="margin-top:22px">
      <p class="texte" style="margin-top:0"><b>${echapper(etat.robot.nom)}</b>, ${echapper(etat.robot.slogan.toLowerCase())}. ${echapper(etat.robot.presentation)} Chacun passe d'abord le test « Quel type d'égoïste es-tu ? » sur son téléphone, puis la salle décide à la majorité de chacun des ${etat.nb_etapes} jours d'Ego-1.</p>
      <div class="barre-actions">
        <label><b>Temps de vote</b>
          <select id="duree"><option value="20">20 s</option><option value="30">30 s</option><option value="45" selected>45 s</option><option value="60">60 s</option><option value="0">illimité</option></select>
        </label>
        <button id="demarrer">Lancer le test</button>
      </div>
    </div>`;
}

function vueProfil() {
  return `<div class="fiche">
      <span class="ruban">Quel type d'égoïste es-tu ?</span>
      <h2 style="font-size:2.4rem;margin:8px 0">Répondez au test sur votre téléphone</h2>
      <p class="texte">${etat.nb_quiz} questions, chacun son rythme. Votre profil fixe l'état de la planète au départ : plus la salle est « confortable », plus Ego-1 démarre mal.</p>
      <div class="nb titre" style="font-size:2rem"><span id="nb-finis">0</span> test(s) terminé(s) · <span id="nb-commences">0</span> commencé(s)</div>
      <div id="types-salle" style="margin-top:12px"></div>
      <div class="barre-actions"><button id="lancer">Réveiller Ego-1 : jour 1</button></div>
    </div>`;
}

function evenement() {
  const s = etat.situation;
  return `<article class="evenement"><div class="bandeau"><span>${echapper(s.label)}</span><span>${etat.etape + 1} / ${etat.nb_etapes}</span></div>
    <div class="corps"><h2>${echapper(s.titre)}</h2></div></article>`;
}

function cartes(manuel) {
  const n = etat.situation.choix.length;
  return `<div class="main-cartes" style="grid-template-columns:repeat(${n},1fr)">${etat.situation.choix.map((c, i) => `
    <div class="carte c${i}" id="choix-${i}">
      <div class="haut"><span class="lettre">${LETTRES[i]}</span>${illustration(c)}</div>
      <h3>${echapper(c.titre)}</h3>
      <div class="votes" id="votes-${i}"></div>
      ${manuel ? `<button class="forcer" data-choix="${i}">Choisir</button>` : ""}
    </div>`).join("")}</div>`;
}

function vueVote() {
  return `${evenement()}${cartes($("mode-manuel").checked)}
    <div class="pied">
      <div class="sablier" id="minuteur"></div>
      <span><b id="nb-votes">0</b> vote(s) sur <span id="nb-joueurs-vote">0</span></span>
      <button id="cloturer">Révéler la décision</button>
      <button class="secondaire" id="prolonger">+15 s</button>
    </div>`;
}

function vueResultat() {
  const r = etat.resultat;
  const c = etat.situation.choix[r.gagnant];
  const messages = {
    egalite: "Égalité ! La décision a été tirée au sort parmi les choix ex æquo.",
    aucun_vote: "Personne n'a voté… le choix a été tiré au sort.",
    animateur: "Décision prise à main levée.",
    majorite: "",
  };
  const derniere = etat.etape + 1 >= etat.nb_etapes || etat.indicateurs.envie <= 0;
  return `${evenement()}${cartes(false)}
    <div class="decision">
      <p class="bandeau-info">${messages[r.mode]}</p>
      <div class="titre-decision"><span class="lettre l${r.gagnant}">${LETTRES[r.gagnant]}</span>La salle a choisi : ${echapper(c.titre)}</div>
      <div style="margin-top:8px">${chipsEffets(r.effets)}</div>
      <div class="consequence"><span class="titre">Ego-1 réagit…</span>« ${echapper(r.commentaire)} »</div>
      <div class="barre-actions"><button id="suivant">${derniere ? "Voir la fin d'Ego-1" : "Jour suivant"}</button></div>
    </div>`;
}

function animerResultat() {
  const r = etat.resultat;
  const total = r.decompte.reduce((a, b) => a + b, 0);
  r.decompte.forEach((n, i) => {
    const el = $(`choix-${i}`);
    if (!el) return;
    const p = total ? Math.round((100 * n) / total) : 0;
    const jetons = Array.from({ length: Math.min(n, 40) }, (_, k) => `<i style="animation-delay:${k * 0.05}s"></i>`).join("");
    $(`votes-${i}`).innerHTML = `${jetons}<span class="pourcent">${total ? `${p} %` : ""}</span>`;
    el.classList.add(i === r.gagnant ? "gagnant" : "perdant");
    if (i === r.gagnant) el.insertAdjacentHTML("beforeend", '<span class="tampon">Choix de la salle</span>');
  });
}

function vueFin() {
  const b = etat.bilan;
  const histo = etat.historique.map((h) => `<li><span class="an">J${h.jour}</span><span class="mini-lettre l${LETTRES.indexOf(h.lettre)}">${h.lettre}</span><span>${h.icone} ${echapper(h.choix)}</span></li>`).join("");
  return `<div class="fin-tete"><h2>${echapper(b.fin.titre)}</h2></div>
    <div class="fin-grille">
      <div class="fiche robot-fiche robot-fin">${robotSVG(b.fin.humeur)}</div>
      <div class="fiche scenario-final">
        <span class="ruban">Le dernier mot d'Ego-1</span>
        <p class="texte" style="font-size:1.35rem;margin:10px 0">${echapper(b.fin.texte)}</p>
        <h3 style="margin-top:14px">Les égoïstes de la salle</h3>${typesHtml(b.types)}
      </div>
      <div class="fiche pistes comparer"><h3>Planète et envie d'Ego-1 : départ / fin</h3>
        ${pistesHtml(etat.indicateurs, { avant: etat.depart, depuis: etat.depart, comparer: true })}</div>
      <div class="fiche"><h3>Vos décisions</h3><ul class="histo">${histo}</ul>
        <button class="secondaire" id="recommencer">Rejouer avec les mêmes joueurs</button></div>
    </div>`;
}

function brancherBoutons() {
  const lier = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  lier("demarrer", () => envoyer("demarrer", { duree: Number($("duree").value) }));
  lier("lancer", () => envoyer("lancer"));
  lier("cloturer", () => envoyer("cloturer"));
  lier("prolonger", () => envoyer("prolonger"));
  lier("suivant", () => envoyer("suivant"));
  lier("recommencer", () => confirm("Recommencer depuis le test avec les mêmes joueurs ?") && envoyer("recommencer"));
  document.querySelectorAll(".forcer").forEach((b) => (b.onclick = () => envoyer("forcer", { choix: Number(b.dataset.choix) })));
}

function majDynamique() {
  if ($("nb-lobby")) $("nb-lobby").textContent = etat.nb_joueurs;
  if ($("nb-votes")) $("nb-votes").textContent = etat.nb_votes;
  if ($("nb-joueurs-vote")) $("nb-joueurs-vote").textContent = etat.nb_joueurs;
  if ($("nb-finis")) {
    $("nb-finis").textContent = etat.profils.finis;
    $("nb-commences").textContent = etat.profils.commences;
    $("types-salle").innerHTML = typesHtml(etat.profils.types);
  }
}

setInterval(() => {
  const el = $("minuteur");
  if (!el) return;
  if (finMinuteur == null) { el.textContent = "∞"; return; }
  const s = Math.max(0, Math.ceil((finMinuteur - Date.now()) / 1000));
  el.textContent = s;
  el.classList.toggle("urgent", s <= 10);
}, 250);
