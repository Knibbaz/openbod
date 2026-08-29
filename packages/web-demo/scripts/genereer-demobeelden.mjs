#!/usr/bin/env node
/**
 * Genereert de beelden bij de demo-woningen.
 *
 * Waarom getekend en niet gefotografeerd: een echte woningfoto is van de
 * fotograaf of de makelaar, en dit project kan moeilijk de sector aanspreken op
 * het overnemen van andermans gegevens terwijl het zelf foto's leent. Deze
 * illustraties zijn hier gemaakt, staan in de repo onder dezelfde licentie als
 * de rest, en zijn eerlijk over wat ze zijn: de woningen bestaan niet, en dat
 * mag je zien.
 *
 * Draaien na een wijziging:
 *   node packages/web-demo/scripts/genereer-demobeelden.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const UIT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "demo");
// 16 bij 9, want de fotogalerij toont het beeld in die verhouding met
// object-fit: cover. Een andere verhouding zou boven en onder afgesneden worden,
// en dan verdwijnt net het dak of de stoep.
const B = 1200;
const H = 675;

/** Eén palet per woning, zodat de drie beelden bij elkaar horen. */
const WONINGEN = [
  {
    slug: "zwolle",
    vorm: "rijtjes",
    lucht: ["#cfe3f2", "#eef5fa"],
    gevel: "#b4593f",
    gevelDonker: "#9a4733",
    dak: "#4a4f57",
    kozijn: "#f7f3ec",
    groen: "#5f8f5a",
    grond: "#cdc6b6",
  },
  {
    slug: "deventer",
    vorm: "hoek",
    lucht: ["#c7dce9", "#eef3f6"],
    gevel: "#8d8f7c",
    gevelDonker: "#767865",
    dak: "#3f4a52",
    kozijn: "#fbf8f2",
    groen: "#6d9463",
    grond: "#c3c9c4",
  },
  {
    slug: "apeldoorn",
    vorm: "vrijstaand",
    lucht: ["#cde4e0", "#f0f7f4"],
    gevel: "#e5dcc9",
    gevelDonker: "#d2c8b2",
    dak: "#6b4b3a",
    kozijn: "#ffffff",
    groen: "#4f7d4a",
    grond: "#c9cbb5",
  },
  {
    slug: "nijmegen",
    vorm: "boven",
    lucht: ["#dcd9ea", "#f4f2f8"],
    gevel: "#9a5d63",
    gevelDonker: "#844d53",
    dak: "#494049",
    kozijn: "#f6f1ef",
    groen: "#6f8f66",
    grond: "#c8c2c4",
  },
  {
    slug: "leeuwarden",
    vorm: "twee-onder-een-kap",
    lucht: ["#c9dff0", "#eff5fa"],
    gevel: "#c9b79a",
    gevelDonker: "#b3a086",
    dak: "#5a5348",
    kozijn: "#ffffff",
    groen: "#5d8b57",
    grond: "#cbc9b8",
  },
];

const rond = (n) => Math.round(n * 10) / 10;

function lucht(w) {
  return `
  <defs>
    <linearGradient id="lucht-${w.slug}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${w.lucht[0]}"/>
      <stop offset="100%" stop-color="${w.lucht[1]}"/>
    </linearGradient>
  </defs>
  <rect width="${B}" height="${H}" fill="url(#lucht-${w.slug})"/>`;
}

function wolk(x, y, s) {
  return `<g fill="#ffffff" opacity="0.75" transform="translate(${x} ${y}) scale(${s})">
    <circle cx="0" cy="0" r="26"/><circle cx="30" cy="-10" r="34"/><circle cx="66" cy="2" r="24"/>
    <rect x="-2" y="-2" width="70" height="26" rx="13"/>
  </g>`;
}

function boom(x, grondlijn, s, kleur) {
  const h = 150 * s;
  return `<g transform="translate(${x} ${grondlijn})">
    <rect x="${rond(-6 * s)}" y="${rond(-h * 0.35)}" width="${rond(12 * s)}" height="${rond(h * 0.35)}" fill="#6b5642"/>
    <circle cx="0" cy="${rond(-h * 0.52)}" r="${rond(46 * s)}" fill="${kleur}"/>
    <circle cx="${rond(-30 * s)}" cy="${rond(-h * 0.38)}" r="${rond(32 * s)}" fill="${kleur}" opacity="0.9"/>
    <circle cx="${rond(30 * s)}" cy="${rond(-h * 0.4)}" r="${rond(30 * s)}" fill="${kleur}" opacity="0.85"/>
  </g>`;
}

function struik(x, grondlijn, s, kleur) {
  return `<g transform="translate(${x} ${grondlijn})">
    <ellipse cx="0" cy="${rond(-14 * s)}" rx="${rond(34 * s)}" ry="${rond(22 * s)}" fill="${kleur}"/>
    <ellipse cx="${rond(-22 * s)}" cy="${rond(-8 * s)}" rx="${rond(22 * s)}" ry="${rond(15 * s)}" fill="${kleur}" opacity="0.85"/>
    <ellipse cx="${rond(22 * s)}" cy="${rond(-9 * s)}" rx="${rond(20 * s)}" ry="${rond(14 * s)}" fill="${kleur}" opacity="0.9"/>
  </g>`;
}

function tuinstoel(x, voet, w) {
  return `<g fill="${w.kozijn}" transform="translate(${x} ${voet})">
    <rect x="-34" y="-46" width="68" height="12" rx="6"/>
    <rect x="-34" y="-96" width="12" height="52" rx="6"/>
    <rect x="-30" y="-92" width="60" height="10" rx="5" opacity="0.9"/>
    <rect x="-30" y="-34" width="10" height="34"/>
    <rect x="20" y="-34" width="10" height="34"/>
  </g>`;
}

function schoorsteen(x, y, w) {
  return `<g>
    <rect x="${x}" y="${y}" width="34" height="70" fill="${w.gevelDonker}"/>
    <rect x="${x - 6}" y="${y - 10}" width="46" height="12" fill="${w.dak}"/>
  </g>`;
}

function deur(x, grondlijn, br, ho, w) {
  return `<g>
    <rect x="${x}" y="${grondlijn - ho}" width="${br}" height="${ho}" fill="${w.dak}"/>
    <rect x="${rond(x + br * 0.2)}" y="${rond(grondlijn - ho + ho * 0.12)}" width="${rond(br * 0.6)}" height="${rond(ho * 0.28)}" fill="#8fb4c9" opacity="0.8"/>
    <circle cx="${rond(x + br * 0.82)}" cy="${rond(grondlijn - ho * 0.45)}" r="5" fill="${w.kozijn}"/>
  </g>`;
}

function raam(x, y, br, ho, w, verlicht = false) {
  return `<g>
    <rect x="${x}" y="${y}" width="${br}" height="${ho}" fill="${verlicht ? "#f6dfa8" : "#8fb4c9"}"/>
    <rect x="${x}" y="${y}" width="${br}" height="${ho}" fill="none" stroke="${w.kozijn}" stroke-width="7"/>
    <line x1="${x + br / 2}" y1="${y}" x2="${x + br / 2}" y2="${y + ho}" stroke="${w.kozijn}" stroke-width="5"/>
  </g>`;
}

/** Het huis zelf, per vorm net even anders, zodat vijf woningen niet vijf keer hetzelfde zijn. */
function huis(w, grondlijn) {
  const midden = B / 2;
  if (w.vorm === "vrijstaand") {
    const br = 520;
    const ho = 300;
    const x = midden - br / 2;
    const y = grondlijn - ho;
    return `
    ${schoorsteen(midden + 120, y - 175, w)}
    <polygon points="${x - 40},${y} ${midden},${y - 170} ${x + br + 40},${y}" fill="${w.dak}"/>
    <rect x="${x}" y="${y}" width="${br}" height="${ho}" fill="${w.gevel}"/>
    <rect x="${x}" y="${y}" width="${br / 2}" height="${ho}" fill="${w.gevelDonker}" opacity="0.35"/>
    ${raam(x + 60, y + 60, 110, 90, w, true)}
    ${raam(x + 350, y + 60, 110, 90, w)}
    ${raam(x + 60, y + 190, 110, 90, w)}
    <rect x="${midden - 45}" y="${y + 170}" width="90" height="130" fill="${w.dak}"/>
    <circle cx="${midden + 28}" cy="${y + 240}" r="6" fill="${w.kozijn}"/>`;
  }
  if (w.vorm === "boven") {
    const br = 420;
    const ho = 420;
    const x = midden - br / 2;
    const y = grondlijn - ho;
    return `
    ${schoorsteen(x + br - 90, y - 90, w)}
    <rect x="${x - 14}" y="${y - 26}" width="${br + 28}" height="30" fill="${w.dak}"/>
    <rect x="${x}" y="${y}" width="${br}" height="${ho}" fill="${w.gevel}"/>
    <rect x="${x}" y="${y}" width="${br}" height="150" fill="${w.gevelDonker}" opacity="0.3"/>
    ${raam(x + 50, y + 50, 130, 100, w, true)}
    ${raam(x + 240, y + 50, 130, 100, w)}
    ${raam(x + 50, y + 210, 130, 100, w)}
    ${raam(x + 240, y + 210, 130, 100, w, true)}
    <rect x="${x + 160}" y="${grondlijn - 110}" width="100" height="110" fill="${w.dak}"/>`;
  }
  if (w.vorm === "twee-onder-een-kap") {
    const br = 300;
    const ho = 270;
    const linkerX = midden - br - 10;
    const rechterX = midden + 10;
    const y = grondlijn - ho;
    const helft = (x, verlicht) => `
      ${verlicht ? schoorsteen(x + br * 0.7, y - 130, w) : ""}
      <polygon points="${x - 25},${y} ${x + br / 2},${y - 130} ${x + br + 25},${y}" fill="${w.dak}"/>
      <rect x="${x}" y="${y}" width="${br}" height="${ho}" fill="${verlicht ? w.gevel : w.gevelDonker}"/>
      ${raam(x + 40, y + 55, 95, 85, w, verlicht)}
      ${raam(x + 165, y + 55, 95, 85, w)}
      <rect x="${x + 110}" y="${y + 165}" width="80" height="105" fill="${w.dak}"/>`;
    return helft(linkerX, true) + helft(rechterX, false);
  }
  const br = 250;
  const ho = 320;
  const start = midden - br * 1.5;
  const uitgelicht = w.vorm === "hoek" ? 2 : 1;
  let out = "";
  for (let i = 0; i < 3; i++) {
    const x = start + i * br;
    const actief = i === uitgelicht;
    const hoogte = actief ? ho + 30 : ho;
    const top = grondlijn - hoogte;
    out += `
    ${actief ? schoorsteen(x + br * 0.72, top - 105, w) : ""}
    <polygon points="${x - 12},${top} ${x + br / 2},${top - 90} ${x + br + 12},${top}" fill="${w.dak}"/>
    <rect x="${x}" y="${top}" width="${br}" height="${hoogte}" fill="${actief ? w.gevel : w.gevelDonker}"/>
    ${raam(x + 35, top + 50, 80, 75, w, actief)}
    ${raam(x + 140, top + 50, 80, 75, w)}
    ${raam(x + 35, top + 165, 80, 75, w, actief && i % 2 === 0)}
    <rect x="${x + 140}" y="${grondlijn - 115}" width="75" height="115" fill="${w.dak}"/>`;
  }
  return out;
}

function gevelbeeld(w) {
  const grondlijn = 520;
  const midden = B / 2;
  void midden;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${B} ${H}" width="${B}" height="${H}" role="img">
  <title>Illustratie van de demonstratiewoning</title>
  ${lucht(w)}
  ${wolk(190, 120, 1.1)}${wolk(880, 85, 0.8)}
  <rect x="0" y="${grondlijn}" width="${B}" height="${H - grondlijn}" fill="${w.grond}"/>
  <rect x="0" y="${grondlijn + 95}" width="${B}" height="12" fill="#ffffff" opacity="0.45"/>
  <rect x="0" y="${grondlijn + 107}" width="${B}" height="${H - grondlijn - 107}" fill="#000000" opacity="0.05"/>
  ${boom(120, grondlijn, 0.95, w.groen)}
  ${boom(1090, grondlijn, 0.8, w.groen)}
  ${huis(w, grondlijn)}
  ${struik(midden - 320, grondlijn, 1, w.groen)}
  ${struik(midden + 320, grondlijn, 0.9, w.groen)}
  <ellipse cx="${midden}" cy="${grondlijn + 8}" rx="420" ry="14" fill="#000000" opacity="0.07"/>
</svg>`;
}

function tuinbeeld(w) {
  const grondlijn = 430;
  const terras = grondlijn + 60;
  const tegels = Array.from(
    { length: 9 },
    (_, i) => `<line x1="${620 + i * 70}" y1="${terras}" x2="${560 + i * 70}" y2="${H}" stroke="#ffffff" stroke-width="3" opacity="0.35"/>`,
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${B} ${H}" width="${B}" height="${H}" role="img">
  <title>Illustratie van de tuin bij de demonstratiewoning</title>
  ${lucht(w)}
  ${wolk(300, 95, 0.9)}
  <rect x="0" y="${grondlijn}" width="${B}" height="${H - grondlijn}" fill="${w.groen}" opacity="0.5"/>
  <rect x="0" y="${grondlijn - 34}" width="${B}" height="34" fill="${w.groen}" opacity="0.75"/>
  <polygon points="640,${terras} ${B},${terras} ${B},${H} 540,${H}" fill="${w.grond}"/>
  ${tegels}
  <rect x="640" y="${grondlijn - 250}" width="520" height="250" fill="${w.gevel}"/>
  <rect x="628" y="${grondlijn - 262}" width="544" height="24" fill="${w.dak}"/>
  ${raam(700, grondlijn - 205, 175, 145, w, true)}
  ${deur(960, grondlijn, 110, 195, w)}
  ${boom(430, grondlijn + 30, 1.15, w.groen)}
  <rect x="120" y="${grondlijn - 115}" width="230" height="115" fill="${w.gevelDonker}"/>
  <polygon points="100,${grondlijn - 115} 235,${grondlijn - 185} 370,${grondlijn - 115}" fill="${w.dak}"/>
  ${raam(160, grondlijn - 92, 58, 52, w)}
  ${struik(90, grondlijn + 40, 1.1, w.groen)}
  ${struik(560, grondlijn + 20, 0.9, w.groen)}
  <ellipse cx="330" cy="${grondlijn + 165}" rx="215" ry="52" fill="#5f8ba8" opacity="0.35"/>
  <ellipse cx="330" cy="${grondlijn + 160}" rx="200" ry="45" fill="#7fa8c4" opacity="0.75"/>
  ${tuinstoel(720, terras + 120, w)}
  <g fill="${w.kozijn}">
    <rect x="820" y="${terras + 62}" width="190" height="14" rx="7"/>
    <rect x="836" y="${terras + 76}" width="14" height="62"/>
    <rect x="980" y="${terras + 76}" width="14" height="62"/>
  </g>
  ${tuinstoel(1060, terras + 120, w)}
</svg>`;
}

function interieurbeeld(w) {
  const vloer = 470;
  const planken = Array.from(
    { length: 11 },
    (_, i) => `<line x1="${i * 120}" y1="${vloer}" x2="${i * 120 - 80}" y2="${H}" stroke="#b8996d" stroke-width="3"/>`,
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${B} ${H}" width="${B}" height="${H}" role="img">
  <title>Illustratie van het interieur van de demonstratiewoning</title>
  <rect width="${B}" height="${H}" fill="#f2ede4"/>
  <rect x="0" y="${vloer}" width="${B}" height="${H - vloer}" fill="#c8a97e"/>
  ${planken}
  <rect x="0" y="${vloer - 14}" width="${B}" height="14" fill="${w.kozijn}"/>

  <rect x="700" y="90" width="380" height="290" fill="${w.lucht[0]}"/>
  <rect x="700" y="325" width="380" height="55" fill="${w.groen}" opacity="0.45"/>
  <circle cx="990" cy="160" r="32" fill="#f6dfa8"/>
  <rect x="700" y="90" width="380" height="290" fill="none" stroke="${w.gevelDonker}" stroke-width="14"/>
  <line x1="890" y1="90" x2="890" y2="380" stroke="${w.gevelDonker}" stroke-width="10"/>

  <rect x="240" y="120" width="150" height="110" fill="${w.kozijn}" stroke="${w.gevelDonker}" stroke-width="8"/>
  <polygon points="252,222 300,160 340,222" fill="${w.groen}" opacity="0.7"/>
  <circle cx="352" cy="152" r="14" fill="#f6dfa8"/>

  <ellipse cx="420" cy="${vloer + 90}" rx="300" ry="70" fill="${w.gevel}" opacity="0.18"/>
  <rect x="110" y="300" width="420" height="140" rx="20" fill="${w.gevel}"/>
  <rect x="130" y="268" width="180" height="58" rx="16" fill="${w.gevelDonker}"/>
  <rect x="330" y="268" width="180" height="58" rx="16" fill="${w.gevelDonker}"/>
  <rect x="150" y="290" width="70" height="46" rx="12" fill="${w.kozijn}" opacity="0.85"/>
  <rect x="360" y="290" width="70" height="46" rx="12" fill="${w.kozijn}" opacity="0.7"/>
  <rect x="230" y="${vloer + 20}" width="250" height="15" rx="7" fill="#8a6f4f"/>
  <rect x="248" y="${vloer + 35}" width="15" height="62" fill="#8a6f4f"/>
  <rect x="450" y="${vloer + 35}" width="15" height="62" fill="#8a6f4f"/>

  <g transform="translate(618 ${vloer})">
    <path d="M -34 0 L 34 0 L 24 -66 L -24 -66 Z" fill="${w.gevelDonker}"/>
    <ellipse cx="0" cy="-104" rx="52" ry="44" fill="${w.groen}"/>
    <ellipse cx="-34" cy="-78" rx="30" ry="24" fill="${w.groen}" opacity="0.85"/>
    <ellipse cx="34" cy="-82" rx="28" ry="22" fill="${w.groen}" opacity="0.9"/>
  </g>

  <circle cx="600" cy="78" r="26" fill="#f6dfa8"/>
  <line x1="600" y1="0" x2="600" y2="52" stroke="${w.dak}" stroke-width="6"/>
</svg>`;
}

mkdirSync(UIT, { recursive: true });
let aantal = 0;
for (const w of WONINGEN) {
  const beelden = { gevel: gevelbeeld(w), tuin: tuinbeeld(w), interieur: interieurbeeld(w) };
  for (const [naam, svg] of Object.entries(beelden)) {
    writeFileSync(join(UIT, `${w.slug}-${naam}.svg`), svg.trimStart() + "\n");
    aantal++;
  }
}
console.log(`${aantal} beelden geschreven naar ${UIT}`);
