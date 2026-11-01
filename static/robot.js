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

// Humeur d'Ego-1 selon son envie (le nouveau palier « happy » correspond au départ à 80).
function humeurDe(envie) {
  return envie <= 0 ? "dead" : envie < 20 ? "dying" : envie < 40 ? "sad" : envie < 55 ? "worried" : envie < 70 ? "normal" : "happy";
}
// Humeur de réaction : suit le résultat du vote (variation d'envie), sauf si Ego-1 est à bout.
function humeurReaction(envie, delta = 0) {
  if (envie <= 0) return "dead";
  if (envie < 20) return "dying";
  return delta >= 4 ? "happy" : delta > 0 ? "normal" : delta >= -3 ? "worried" : "sad";
}

const VOYANTS = { happy: "#3ddc97", normal: "#3ddc97", surprised: "#00d4ff", worried: "#ffbe2e", sad: "#ffbe2e", dying: "#ef4343", dead: "#8c8fa6" };

function robotSVG(humeur = "normal", opts = {}) {
  const h = VOYANTS[humeur] ? humeur : "normal";
  const voyant = VOYANTS[h];
  const deux = (f) => f(36) + f(64);
  const oeil = (cx, ry = 7.5, cy = 36) => `<ellipse cx="${cx}" cy="${cy}" rx="${h === "surprised" ? 8.5 : 7.5}" ry="${ry}" fill="#00d4ff" ${TRAIT}/><circle cx="${cx - 2.5}" cy="${cy - 2.5}" r="2.6" fill="#fff"/><circle cx="${cx + 2.5}" cy="${cy + 3}" r="1.2" fill="#fff"/>`;
  const trait = (d, w = 2.6) => `<path d="${d}" stroke="${ENCRE}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const joues = `<ellipse cx="25" cy="46" rx="4.5" ry="2.8" fill="#ff9db1" opacity=".65"/><ellipse cx="75" cy="46" rx="4.5" ry="2.8" fill="#ff9db1" opacity=".65"/>`;
  const larme = `<path class="larme" d="M30 44q-3.2 5 0 7.2q3.2-2.2 0-7.2z" fill="#7fe3ff" stroke="${ENCRE}" stroke-width="1.2"/>`;
  const visages = {
    happy: `<g class="yeux">${deux((c) => oeil(c, 8.5))}</g>${trait("M28 24q8-4 15 0")}${trait("M57 24q8-4 15 0")}${joues}
      <path d="M40 46q10 13 20 0z" fill="${ENCRE}" ${TRAIT}/><ellipse cx="50" cy="51.3" rx="4.2" ry="1.9" fill="#ff7a93"/>`,
    normal: `<g class="yeux">${deux((c) => oeil(c))}</g>${joues}${trait("M42 49q8 6 16 0")}`,
    surprised: `<g class="yeux">${deux((c) => oeil(c, 9))}</g>${trait("M28 20q8-4 15 0")}${trait("M57 20q8-4 15 0")}${joues}
      <ellipse cx="50" cy="51" rx="4" ry="5" fill="${ENCRE}"/>`,
    worried: `<g class="yeux">${deux((c) => oeil(c, 7))}</g>${trait("M27 29l16-6")}${trait("M73 29l-16-6")}${trait("M41 51q3-3.5 6 0t6 0t6 0")}`,
    sad: `<g class="yeux">${deux((c) => oeil(c, 6, 38))}</g>${trait("M26 31l17-8")}${trait("M74 31l-17-8")}${trait("M41 54q9-8 18 0")}${larme}`,
    dying: `<ellipse cx="36" cy="39" rx="7.5" ry="3" fill="#00d4ff" ${TRAIT}/><ellipse cx="64" cy="39" rx="7.5" ry="3" fill="#00d4ff" ${TRAIT}/>${trait("M27 35h18")}${trait("M55 35h18")}${trait("M43 53q3-2 6 0t8 0")}${larme}`,
    dead: `${trait("M30 31l12 10M42 31 30 41M58 31l12 10M70 31 58 41", 3)}${trait("M43 52h14")}`,
  };
  const bras = (cote) => {
    const x = cote === "g" ? 23 : 77, s = cote === "g" ? -1 : 1;
    const d = `M${x} 62q${9 * s} 3 ${9 * s} 13`;
    return `<g class="bras bras-${cote}"><path d="${d}" stroke="${ENCRE}" stroke-width="6.4" fill="none" stroke-linecap="round"/><path d="${d}" stroke="#d1d9e6" stroke-width="3.2" fill="none" stroke-linecap="round"/><circle cx="${x + 9 * s}" cy="76" r="3.6" fill="#fffaf0" ${TRAIT}/></g>`;
  };
  return `<svg class="plateau robot ${h}${opts.anime ? " reagit" : ""}" viewBox="0 0 100 100" role="img" aria-label="Ego-1, le petit robot (${h})">
    ${bras("g")}${bras("d")}
    <rect x="22" y="57" width="56" height="26" rx="9" fill="#d1d9e6" ${TRAIT}/>
    <circle cx="36" cy="86" r="5.5" fill="${ENCRE}"/><circle cx="64" cy="86" r="5.5" fill="${ENCRE}"/><circle cx="36" cy="86" r="1.8" fill="#8c8fa6"/><circle cx="64" cy="86" r="1.8" fill="#8c8fa6"/>
    <rect x="40" y="63" width="20" height="13" rx="3.5" fill="${ENCRE}"/>
    <path d="M52 64.5l-5.5 6.5h3.8l-1.8 5.5 6.3-7.5h-4z" fill="${voyant}"/>
    <path d="M50 16V9" stroke="${ENCRE}" stroke-width="2.6" stroke-linecap="round"/><circle class="ampoule" cx="50" cy="7" r="4" fill="${voyant}" ${TRAIT}/>
    <rect x="11" y="30" width="7" height="14" rx="3.5" fill="#d1d9e6" ${TRAIT}/><rect x="82" y="30" width="7" height="14" rx="3.5" fill="#d1d9e6" ${TRAIT}/>
    <rect x="16" y="16" width="68" height="44" rx="15" fill="#fffaf0" ${TRAIT}/>
    <rect x="22" y="22" width="56" height="34" rx="12" fill="#fff" stroke="#e6dcc3" stroke-width="1.5"/>
    ${visages[h]}</svg>`;
}

// Chaque carte de choix porte un pictogramme neutre (il ne dévoile pas la conséquence).
function illustration(choix) {
  return `<span class="emoji" aria-hidden="true">${choix.icone || "🤖"}</span>`;
}