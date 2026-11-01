// Fonctions partagées entre l'écran animateur et le téléphone (EGO-1).
const LETTRES = "ABCD";
const BACKEND_URL = (window.EGO1_CONFIG?.backendUrl || location.origin).replace(/\/$/, "");
const INDICATEURS = {
  planete: { nom: "Planète" },
  envie: { nom: "Envie d’Ego-1" },
};

function echapper(texte) {
  return String(texte ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function couleurJauge(valeur) {
  if (valeur >= 60) return "#22b46a";
  if (valeur >= 40) return "#ffbe2e";
  return "#ef4343";
}

function chipsEffets(effets) {
  return Object.entries(effets || {})
    .filter(([cle, v]) => v !== 0 && INDICATEURS[cle])
    .map(([cle, v]) => `<span class="chip ${v > 0 ? "plus" : "moins"}">${icone(cle)} ${INDICATEURS[cle].nom} ${signe(v)}</span>`)
    .join("");
}

function signe(v, format = String) {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${format(Math.abs(v))}`;
}

// Connexion WebSocket avec reconnexion automatique (utile quand un téléphone se met en veille).
function connecter(code, role, id, surMessage, surStatut) {
  let ws;
  let delai = 500;
  let ferme = false;
  const ouvrir = () => {
    const url = new URL(BACKEND_URL);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `/ws/${encodeURIComponent(code)}`;
    url.search = new URLSearchParams({ role, id: id || "" });
    ws = new WebSocket(url);
    ws.onopen = () => { delai = 500; surStatut && surStatut(true); };
    ws.onmessage = (e) => {
      const message = JSON.parse(e.data);
      if (message.type === "erreur") ferme = true;
      surMessage(message);
    };
    ws.onclose = () => {
      surStatut && surStatut(false);
      if (!ferme) setTimeout(ouvrir, delai);
      delai = Math.min(delai * 2, 5000);
    };
  };
  ouvrir();
  return { envoyer: (msg) => ws && ws.readyState === 1 && ws.send(JSON.stringify(msg)) };
}

const MEEPLE = `<svg class="pion" viewBox="0 0 30 30" aria-hidden="true"><path d="M15 6V2" stroke="#1c1f3a" stroke-width="2" stroke-linecap="round"/><rect x="3" y="6" width="24" height="20" rx="7" fill="#fffaf0" stroke="#1c1f3a" stroke-width="2.4"/><circle cx="10.5" cy="16" r="3.4" fill="#00d4ff" stroke="#1c1f3a" stroke-width="1.6"/><circle cx="19.5" cy="16" r="3.4" fill="#00d4ff" stroke="#1c1f3a" stroke-width="1.6"/></svg>`;

function ecartHtml(ecart, format = String, inverse = false) {
  const bon = inverse ? ecart < 0 : ecart > 0;
  return `<span class="ecart ${ecart ? (bon ? "plus" : "moins") : ""}">${ecart ? signe(ecart, format) : "="}</span>`;
}

// Pistes de score : un jeton par indicateur, qui glisse de `depuis` vers la valeur actuelle.
// Options : deltas (effets affichés), avant + comparer (bilan), textes, valeur (affiche le nombre).
function pistesHtml(indicateurs, o = {}) {
  return Object.entries(INDICATEURS).map(([k, ind]) => {
    const v = indicateurs[k];
    const cases = Array.from({ length: 10 }, (_, n) => `<i class="${n < 4 ? "r" : n < 6 ? "o" : "v"}"></i>`).join("");
    const depart = o.depuis && o.depuis[k] != null ? o.depuis[k] : v;
    const fantome = o.avant ? `<span class="jeton fantome" style="left:${o.avant[k]}%">${o.avant[k]}</span>` : "";
    const jeton = `<span class="jeton" data-cible="${v}" style="left:${depart}%;background:${couleurJauge(v)}">${v}</span>`;
    let fin;
    if (o.comparer) fin = `<span class="avant-apres"><span>${o.avant[k]}</span> → ${v}</span>${ecartHtml(v - o.avant[k])}`;
    else if (o.valeur) fin = `<b>${v}</b>`;
    else {
      const d = o.deltas && o.deltas[k];
      fin = `<span class="delta ${d > 0 ? "plus" : d < 0 ? "moins" : ""}">${d ? signe(d) : ""}</span>`;
    }
    const texte = o.textes ? `<small>${echapper(o.textes[k])}</small>` : "";
    return `<div class="rang">${icone(k)}<span>${ind.nom}${texte}</span><div class="piste">${cases}${fantome}${jeton}</div>${fin}</div>`;
  }).join("");
}

function animerJetons() {
  requestAnimationFrame(() => setTimeout(() => {
    document.querySelectorAll(".jeton[data-cible]").forEach((j) => (j.style.left = `${j.dataset.cible}%`));
  }, 60));
}

function parcoursHtml(etat) {
  const etapes = [...etat.jours.map((j) => `J${j}`), "Fin"];
  const ici = etat.phase === "fin" ? etapes.length - 1 : etat.phase === "accueil" || etat.phase === "profil" ? -1 : etat.etape;
  return etapes.map((a, i) => {
    const cl = [i === ici ? "ici" : i < etat.historique.length ? "faite" : "", i === etapes.length - 1 ? "fin" : ""].join(" ");
    return `${i ? '<span class="chemin"></span>' : ""}<div class="case ${cl}">${i === ici ? MEEPLE : ""}${a}</div>`;
  }).join("");
}

// Types d'égoïstes de la salle : barre de répartition + légende.
function typesHtml(types) {
  const total = types.reduce((a, t) => a + t.n, 0);
  if (!total) return `<p class="sources">Aucun test terminé pour l'instant.</p>`;
  const barre = types.filter((t) => t.n).map((t) => `<div style="width:${(100 * t.n) / total}%;background:${t.couleur}" title="${echapper(t.nom)} : ${t.n}"></div>`).join("");
  const legende = types.filter((t) => t.n).map((t) => `<span><span class="pastille" style="background:${t.couleur}"></span>${echapper(t.nom)} (${t.n})</span>`).join("");
  return `<div class="repartition">${barre}</div><div class="legende">${legende}</div>`;
}

// Réaction d'Ego-1 après un vote : le robot (humeur liée au résultat) + une bulle de dialogue.
function reactionHtml(r, etat) {
  const humeur = humeurReaction(etat.indicateurs.envie, (r.effets || {}).envie || 0);
  return `<div class="reaction"><div class="reaction-robot">${robotSVG(humeur, { anime: true })}</div>
    <div class="bulle"><span class="titre">Ego-1 réagit…</span><p>« ${echapper(r.commentaire)} »</p></div></div>`;
}