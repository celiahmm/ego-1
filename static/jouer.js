const params = new URLSearchParams(location.search);
const code = (params.get("code") || "").toUpperCase();
if (!code) location.href = "/";
const $ = (id) => document.getElementById(id);

// Identifiant anonyme et aléatoire, gardé sur ce téléphone pour retrouver son vote après une coupure.
let idJoueur = localStorage.getItem("ego1-id");
if (!idJoueur) {
  idJoueur = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
  localStorage.setItem("ego1-id", idJoueur);
}

let etat = null;
let cleAffichee = null;
let valeursPrecedentes = null;
let verrou = false; // évite qu'un double appui réponde à la question suivante

const connexion = connecter(code, "joueur", idJoueur, (message) => {
  if (message.type === "erreur") {
    $("vue").innerHTML = `<div class="attente"><h2>${echapper(message.message)}</h2><a href="/">Retour</a></div>`;
    return;
  }
  const nouvelleCle = cleDe(message);
  if (etat && nouvelleCle !== cleAffichee) valeursPrecedentes = { ...etat.indicateurs };
  etat = message;
  afficher();
}, (connecte) => $("statut").classList.toggle("cache", connecte));

// Pendant le test, chaque réponse change l'écran : la question fait partie de la clé.
const cleDe = (m) => `${m.phase}-${m.etape}-${m.phase === "profil" ? m.mon_profil.index : ""}`;

function afficher() {
  $("jour").textContent = etat.phase === "fin" ? "Fin" : etat.phase === "profil" ? "Test" : etat.situation ? etat.situation.label : `Partie ${code}`;
  const cle = cleDe(etat);
  if (cle !== cleAffichee) {
    cleAffichee = cle;
    verrou = false;
    const vues = { accueil: vueAccueil, profil: vueProfil, vote: vueVote, resultat: vueResultat, fin: vueFin };
    $("vue").innerHTML = vues[etat.phase]();
    window.scrollTo(0, 0);
    animerJetons();
    document.querySelectorAll(".main .carte").forEach((b) => {
      b.onclick = () => {
        const choix = Number(b.dataset.choix);
        if (b.dataset.action === "repondre") {
          if (verrou) return;
          verrou = true;
          setTimeout(() => (verrou = false), 1500);
          reagirTout(b);
        }
        connexion.envoyer({ action: b.dataset.action, choix });
        if (b.dataset.action === "voter") {
          document.querySelectorAll(".main .carte").forEach((carte) => carte.setAttribute("aria-pressed", String(Number(carte.dataset.choix) === choix)));
        }
        if (navigator.vibrate) navigator.vibrate(30);
      };
    });
  }
  document.querySelectorAll(".main .carte[data-action=voter]").forEach((b) => {
    const choisie = Number(b.dataset.choix) === etat.mon_vote;
    b.classList.toggle("choisie", choisie);
    b.setAttribute("aria-pressed", String(choisie));
    const tampon = b.querySelector(".tampon");
    if (choisie && !tampon) b.insertAdjacentHTML("beforeend", '<span class="tampon">Mon vote</span>');
    if (!choisie && tampon) tampon.remove();
  });
  const conf = $("confirmation");
  if (conf) {
    conf.textContent = etat.mon_vote != null
      ? `Vote enregistré : choix ${LETTRES[etat.mon_vote]}. Vous pouvez encore changer d'avis.`
      : "Choisissez une carte pour voter.";
  }
}

function maVille(depuis) {
  return `<details class="fiche pistes" open><summary class="resume"><span>Ego-1 (sur 100)</span></summary>
    ${pistesHtml(etat.indicateurs, { valeur: true, depuis })}</details>`;
}

const robot = () => robotSVG(humeurDe(etat.indicateurs.envie));

function vueAccueil() {
  return `<div class="attente">
    <h2>${echapper(etat.robot.nom)}</h2>
    ${robot()}
    <p>${echapper(etat.robot.presentation)}</p>
    <p>Vous êtes connecté(e). Regardez l'écran : le test va bientôt commencer.</p></div>`;
}

// Humeur d'Ego-1 pendant le test : moyenne de l'impact « planète » des réponses déjà données.
function humeurQuiz(p) {
  if (!p.index) return "normal";
  const m = p.planete / p.index;
  return m >= 0 ? "happy" : m >= -2.5 ? "normal" : m >= -4.5 ? "worried" : "sad";
}

function coachHtml(p) {
  const h = humeurQuiz(p);
  const r = etat.reactions_quiz || {};
  const lignes = (p.index ? r[h] : r.debut) || [];
  const parole = lignes.length ? lignes[p.index % lignes.length] : "";
  return `<div class="coach"><div class="coach-robot">${robotSVG(h, { anime: true })}</div><div class="bulle petite"><p>${echapper(parole)}</p></div></div>`;
}

// Réaction instantanée au toucher, avant même le retour du serveur.
function reagirTout(bouton) {
  bouton.classList.add("choisie");
  const coach = document.querySelector(".coach");
  if (!coach) return;
  coach.querySelector(".coach-robot").innerHTML = robotSVG("surprised", { anime: true });
  coach.querySelector(".bulle p").textContent = "Hmm… je note ça.";
}

function vueProfil() {
  const p = etat.mon_profil;
  if (p.fini) {
    return `${coachHtml(p)}<div class="attente"><h2>Test terminé !</h2>
      <p><span class="ruban">${echapper(p.type)}</span></p>
      <p>Regardez l'écran : Ego-1 se réveille bientôt.</p></div>`;
  }
  const q = etat.quiz[p.index];
  return `${coachHtml(p)}<article class="evenement"><div class="bandeau"><span>Quel type d'égoïste es-tu ?</span><span>${p.index + 1}/${p.total}</span></div>
      <div class="corps"><h2>${echapper(q.q)}</h2></div></article>
    <div class="main">${q.choix.map((t, i) => `<button class="carte c${i}" data-action="repondre" data-choix="${i}">
      <div class="haut"><span class="lettre">${LETTRES[i]}</span><span class="emoji" aria-hidden="true">${(q.icones || [])[i] || "🤖"}</span></div>
      <div><h3>${echapper(t)}</h3></div></button>`).join("")}</div>`;
}

function vueVote() {
  const s = etat.situation;
  return `<article class="evenement"><div class="bandeau"><span>${echapper(s.label)}</span><span>${etat.etape + 1}/${etat.nb_etapes}</span></div>
      <div class="corps"><h2>${echapper(s.titre)}</h2></div></article>
    ${maVille(valeursPrecedentes)}
    <div class="main">${s.choix.map((c, i) => `<button class="carte c${i}" data-action="voter" data-choix="${i}">
      <div class="haut"><span class="lettre">${LETTRES[i]}</span>${illustration(c)}</div>
      <div><h3>${echapper(c.titre)}</h3></div></button>`).join("")}</div>
    <p class="confirmation" id="confirmation" role="status" aria-live="polite"></p>`;
}

function vueResultat() {
  const r = etat.resultat;
  const c = etat.situation.choix[r.gagnant];
  let perso;
  if (etat.mon_vote == null) perso = "Vous n'avez pas voté cette fois-ci.";
  else if (etat.mon_vote === r.gagnant) perso = "Vous avez voté comme la majorité.";
  else perso = `Vous aviez voté <b>${LETTRES[etat.mon_vote]}</b> : ${echapper(etat.situation.choix[etat.mon_vote].titre)}.`;
  const depuis = {};
  for (const k of Object.keys(INDICATEURS)) depuis[k] = etat.indicateurs[k] - (r.effets[k] || 0);
  return `<div class="decision" style="margin-top:14px">
      <div class="titre-decision"><span class="lettre">${LETTRES[r.gagnant]}</span>${echapper(c.titre)}</div>
      <p class="perso">${perso}</p>
      <div>${chipsEffets(r.effets)}</div>
      ${reactionHtml(r, etat)}
    </div>
    ${maVille(depuis)}
    <p class="attente">Regardez l'écran pour la suite…</p>`;
}

function vueFin() {
  const b = etat.bilan;
  const d = etat.depart;
  const lignes = Object.entries(INDICATEURS).map(([k, ind]) =>
    `<tr><td>${icone(k)} ${ind.nom}</td><td class="avant">${d[k]}</td><td class="apres">${etat.indicateurs[k]}</td><td>${ecartHtml(etat.indicateurs[k] - d[k])}</td></tr>`).join("");
  const mon = etat.mon_profil.type ? `<p class="perso">Ton profil : <span class="ruban">${echapper(etat.mon_profil.type)}</span></p>` : "";
  return `<article class="evenement"><div class="bandeau"><span>La fin d'Ego-1</span></div>
      <div class="corps"><h2>${echapper(b.fin.titre)}</h2><p>${echapper(b.fin.texte)}</p></div></article>
    ${robotSVG(b.fin.humeur)}
    ${mon}
    <div class="fiche"><table class="comparaison">
      <thead><tr><th>Sur 100</th><th>Départ</th><th>Fin</th><th>Écart</th></tr></thead>
      <tbody>${lignes}</tbody>
    </table></div>`;
}