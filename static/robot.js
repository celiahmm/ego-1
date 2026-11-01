// Icônes des jauges, illustration des cartes et robot Ego-1 (dessin à gros traits, comme la V1).
const ENCRE = "#1c1f3a";
const TRAIT = `stroke="${ENCRE}" stroke-width="2" stroke-linejoin="round"`;
const ICONES = {
  planete: `<circle cx="12" cy="12" r="9.5" fill="#3d7bf5" ${TRAIT}/><path d="M6.5 9c2.5-3 5.5-1.5 4.5 1.5S8 13 9 16.5M14 5.5c2 1.5 5 2 5.5 5-3 .5-4 1.5-4.5 4" fill="#22b46a" ${TRAIT}/>`,
  envie: `<rect x="2.5" y="7" width="16" height="10" rx="2.5" fill="#ffbe2e" ${TRAIT}/><rect x="19.5" y="10" width="2" height="4" rx="1" fill="${ENCRE}"/><path d="M11.5 8.5 8.5 13h3l-1 3.5 4-5h-3z" fill="#fff" stroke="${ENCRE}" stroke-width="1" stroke-linejoin="round"/>`,
};

function icone(cle) {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONES[cle] || ""}</svg>`;
}

// Humeur d'Ego-1 selon son envie (mêmes seuils que le concept d'origine).
function humeurDe(envie) {
  return envie <= 0 ? "dead" : envie < 20 ? "dying" : envie < 40 ? "sad" : "normal";
}

function robotSVG(humeur = "normal") {
  const triste = humeur === "sad" || humeur === "dying";
  const yeux = triste
    ? `<ellipse cx="38" cy="42" rx="8" ry="6" fill="#00d4ff" ${TRAIT}/><ellipse cx="62" cy="42" rx="8" ry="6" fill="#00d4ff" ${TRAIT}/>
       <path d="M31 33l14 4M69 33l-14 4" stroke="${ENCRE}" stroke-width="2.4" stroke-linecap="round"/>`
    : humeur === "dead"
    ? `<path d="M31 37l14 10M45 37 31 47M55 37l14 10M69 37 55 47" stroke="${ENCRE}" stroke-width="3" stroke-linecap="round"/>`
    : `<circle cx="38" cy="40" r="8" fill="#00d4ff" ${TRAIT}/><circle cx="62" cy="40" r="8" fill="#00d4ff" ${TRAIT}/>
       <circle cx="38" cy="40" r="3" fill="#fff"/><circle cx="62" cy="40" r="3" fill="#fff"/>`;
  const bouche = triste
    ? `<path d="M40 63q10-6 20 0" stroke="${ENCRE}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
    : humeur === "dead"
    ? `<path d="M42 62h16" stroke="${ENCRE}" stroke-width="2.6" stroke-linecap="round"/>`
    : `<path d="M41 59q9 8 18 0" stroke="${ENCRE}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  const voyant = humeur === "dead" ? "#8c8fa6" : triste ? "#ffbe2e" : "#3ddc97";
  return `<svg class="plateau robot ${humeur}" viewBox="0 0 100 100" role="img" aria-label="Ego-1, le petit robot">
    <path d="M50 18V9" stroke="${ENCRE}" stroke-width="2.6" stroke-linecap="round"/><circle cx="50" cy="8" r="3.4" fill="${voyant}" ${TRAIT}/>
    <rect x="20" y="55" width="60" height="31" rx="8" fill="#d1d9e6" ${TRAIT}/>
    <circle cx="35" cy="79" r="6" fill="${ENCRE}"/><circle cx="65" cy="79" r="6" fill="${ENCRE}"/>
    <rect x="25" y="22" width="50" height="46" rx="12" fill="#fffaf0" ${TRAIT}/>
    <rect x="42" y="70" width="16" height="6" rx="2" fill="${ENCRE}"/>
    ${yeux}${bouche}</svg>`;
}

// Chaque carte de choix porte un pictogramme neutre (il ne dévoile pas la conséquence).
function illustration(choix) {
  return `<span class="emoji" aria-hidden="true">${choix.icone || "🤖"}</span>`;
}
