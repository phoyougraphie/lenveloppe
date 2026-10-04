#!/usr/bin/env node
// scripts/rnm.mjs — prix au stade DÉTAIL du RNM (FranceAgriMer)
//
// Produit data/sources/rnm-catalogue.json : tous les produits suivis au détail
// (GMS et magasins spécialisés bio), avec leurs séries exactes et une
// proposition de niveaux premier / moyen / qualite.
//
// Voie d'accès : pages HTML publiques « prix par marché » du site
// https://rnm.franceagrimer.fr (GET, sans compte, sans cookie). Une page par
// « marché » de détail, ex. https://rnm.franceagrimer.fr/prix?M2502:MARCHE
// renvoie la dernière semaine publiée. Licence ouverte FranceAgriMer :
// réutilisation libre avec mention de la source.
//
// Usage :
//   node scripts/rnm.mjs            # télécharge, met en cache, génère
//   node scripts/rnm.mjs --offline  # régénère depuis le dernier cache brut
//
// Aucune dépendance. Node >= 18 (fetch natif), testé avec Node 24.

import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://rnm.franceagrimer.fr";
const RAW_DIR = path.join(ROOT, "data/sources/raw/rnm");
const OUT = path.join(ROOT, "data/sources/rnm-catalogue.json");
const OFFLINE = process.argv.includes("--offline");
const UA = "L-enveloppe/1.0 (site statique d'idees de repas; collecte hebdomadaire des prix detail RNM)";
const DELAY_MS = 1000;

// Secteurs dont on lit la rubrique « Détail » pour découvrir les marchés.
const SECTEURS = ["FRUITS-ET-LEGUMES", "BEURRE-OEUF-FROMAGE", "PECHE-ET-AQUACULTURE", "VIANDE"];
// Filet de sécurité si la découverte échoue (codes constatés le 2026-10-03).
const MARCHES_CONNUS = ["2500", "2501", "2502", "2503", "2504", "3026", "3027", "3028", "3029"];

const today = new Date().toISOString().slice(0, 10);
const runDir = path.join(RAW_DIR, today);
const warnings = [];
const warn = (m) => { warnings.push(m); console.warn("⚠ " + m); };

// ---------------------------------------------------------------- réseau + cache

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function latestCached(file) {
  if (!existsSync(RAW_DIR)) return null;
  const dirs = (await readdir(RAW_DIR)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
  for (const d of dirs) {
    const p = path.join(RAW_DIR, d, file);
    if (existsSync(p)) return { html: await readFile(p, "utf8"), from: p };
  }
  return null;
}

let firstRequest = true;
async function get(urlPath, file) {
  if (!OFFLINE) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (!firstRequest) await sleep(DELAY_MS);
        firstRequest = false;
        const res = await fetch(BASE + urlPath, { headers: { "User-Agent": UA, "Accept-Language": "fr" } });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const html = await res.text();
        await mkdir(runDir, { recursive: true });
        const dest = path.join(runDir, file);
        await writeFile(dest, html);
        return { html, from: dest };
      } catch (e) {
        if (attempt === 3) warn(`échec du téléchargement ${urlPath} (${e.message}), repli sur le cache`);
        else await sleep(2000 * attempt);
      }
    }
  }
  const cached = await latestCached(file);
  if (!cached) warn(`aucune copie en cache pour ${file}`);
  return cached;
}

// ---------------------------------------------------------------- utilitaires texte

const ENT = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô", icirc: "î", ucirc: "û", euro: "€" };
function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
const text = (s) => decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-");
function num(s) {
  const t = text(s).replace(",", ".");
  if (t === "" ) return null;
  if (t === "=") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------- parsing

// Liste officielle des produits RNM (autocomplétion de la page d'accueil).
function parseProduits(html) {
  const m = html.match(/var produits = new Array\(([\s\S]*?)\);/);
  if (!m) return [];
  return [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => decode(x[1]));
}

function parseMarchesDetail(html) {
  const out = [];
  for (const m of html.matchAll(/href="\/prix\?M(\d+):MARCHE"[^>]*>([^<]*)</g)) {
    const nom = text(m[2]);
    if (/DETAIL/i.test(nom)) out.push({ code: m[1], nom });
  }
  return out;
}

const UNITES = { kg: "kg", litre: "l", "pièce": "piece", piece: "piece" };
function unite(raw) {
  if (!raw) return null;
  const r = raw.trim().replace(/\*$/, "").trim();
  return UNITES[r] ?? r;
}

function parseMarche(html, code) {
  const nom = text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "").replace(/\(cours Détail\)/, "").trim();
  const h2 = text(html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? "");
  const sem = h2.match(/semaine (\d+) du (\d{2})-(\d{2})-(\d{4}) au (\d{2})-(\d{2})-(\d{4})/);
  const dm = html.match(/name="DATE" value="(\d{2})\/(\d{2})\/(\d{2})"/);
  const periode = sem
    ? {
        type: "semaine",
        semaine: +sem[1],
        annee: +sem[4] === +sem[7] ? +sem[4] : +sem[7],
        du: `${sem[4]}-${sem[3]}-${sem[2]}`,
        au: `${sem[7]}-${sem[6]}-${sem[5]}`,
        date_marche: dm ? `20${dm[3]}-${dm[2]}-${dm[1]}` : null,
        libelle: `semaine ${+sem[1]} – ${sem[7]}`,
      }
    : null;
  const table = html.match(/<table class="tabcot" id="tabcotmar">([\s\S]*?)<\/table>/)?.[1];
  if (!table) return { nom, periode, series: [], uniteDefaut: null };
  const th = text(table.match(/<th[^>]*>([\s\S]*?)<\/th>/)?.[1] ?? "");
  const uniteDefaut = unite(th.match(/€ TTC\s*(?:le|la|les)?\s*([^*]*)\*/)?.[1] || "");
  const series = [];
  for (const row of table.split(/<\/tr>/)) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
    if (cells.length < 2) continue;
    const libcod = cells[0].match(/histo_lib\((\d+)/)?.[1] ?? null;
    const libelle = text(cells[0]);
    if (!libelle) continue;
    const u = libelle.match(/\((?:le|la|les|l')\s*([^)]+)\)\s*$/i);
    series.push({
      libelle,
      rnm_libcod: libcod,
      unite_rnm: u ? u[1].trim() : uniteDefaut,
      unite: u ? unite(u[1]) : uniteDefaut,
      prix_moyen: num(cells[1] ?? ""),
      variation: num(cells[2] ?? ""),
      mini_d1: num(cells[3] ?? ""),
      maxi_d9: num(cells[4] ?? ""),
    });
  }
  return { nom, periode, series, uniteDefaut };
}

// ---------------------------------------------------------------- rattachement produit

function makeProduitMatcher(produits) {
  const list = produits.map((p) => ({ p, n: norm(p) })).sort((a, b) => b.n.length - a.n.length);
  return (libelle) => {
    const L = norm(libelle);
    const hit = list.find(({ n }) => L === n || L.startsWith(n + " "));
    if (hit) return hit.p;
    // repli : le bloc initial en capitales (« CHOU FLEUR », « LAIT UHT »…)
    const caps = libelle.match(/^[A-ZÀ-ÖØ-Þ' -]+(?=\s|$)/)?.[0]?.trim();
    return caps ? caps.charAt(0) + caps.slice(1).toLowerCase() : libelle;
  };
}

const isBio = (l) => /biologique/i.test(l);
const isLabel = (l) => /label rouge|\bAOP\b|\bIGP\b/i.test(l) && !/sans label/i.test(l);
const STOP = new Set(["BIOLOGIQUE", "FRANCE", "HORS", "FR", "U", "E", "IMPORT", "VRAC", "LE", "LA", "LES", "KG", "PIECE", "CDT", "VENDU", "A", "DE", "OU", "SANS", "LABEL"]);
const tokens = (l) => new Set(norm(l).split(" ").filter((t) => t && !STOP.has(t) && !/^\d/.test(t)));
function jaccard(a, b) {
  const A = tokens(a), B = tokens(b);
  let i = 0;
  for (const t of A) if (B.has(t)) i++;
  return A.size + B.size ? i / (A.size + B.size - i) : 0;
}
const UNIT_SCORE = { kg: 3, l: 3, piece: 2 };
const lowerMedian = (arr, key) => {
  const s = [...arr].sort((a, b) => key(a) - key(b));
  return s[Math.floor((s.length - 1) / 2)];
};

function niveau(s, valeur, statistique) {
  return {
    valeur,
    unite: s.unite,
    statistique,
    libelle: s.libelle,
    marche: s.marche_nom,
    circuit: s.circuit,
    periode: s.periode,
    url: s.url,
  };
}

function choisirNiveaux(series) {
  // moyen : série conventionnelle (ni bio, ni label rouge/AOP/IGP) en GMS.
  const conv = series.filter((s) => s.circuit === "GMS" && !s.bio && !s.label && s.prix_moyen != null);
  let ref = null;
  if (conv.length) {
    const score = (s) =>
      (UNIT_SCORE[s.unite] ?? 0) * 10 + (/\bFrance\b/.test(s.libelle) ? 2 : 0) + (/\bvrac\b/.test(s.libelle) ? 1 : 0) + (/sans label/i.test(s.libelle) ? 1 : 0);
    const best = Math.max(...conv.map(score));
    ref = lowerMedian(conv.filter((s) => score(s) === best), (s) => s.prix_moyen);
  }
  // qualite : série bio, même unité que la référence si elle existe ;
  // GMS d'abord (même panel que « moyen »), sinon magasins spécialisés bio.
  const bios = series.filter((s) => s.bio && s.prix_moyen != null && (!ref || s.unite === ref.unite));
  let bio = null;
  if (bios.length) {
    const score = (s) =>
      (ref ? 0 : (UNIT_SCORE[s.unite] ?? 0) * 100) +
      (s.circuit === "GMS" ? 50 : 0) +
      (ref ? jaccard(s.libelle, ref.libelle) * 20 : 0) +
      (/\bFrance\b/.test(s.libelle) ? 1 : 0);
    bio = bios.reduce((a, b) => (score(b) > score(a) ? b : a));
  }
  return {
    premier: ref && ref.mini_d1 != null ? niveau(ref, ref.mini_d1, "1er décile des prix relevés en GMS (approximation, pas un relevé hard-discount)") : null,
    moyen: ref ? niveau(ref, ref.prix_moyen, "prix moyen pondéré GMS") : null,
    qualite: bio ? niveau(bio, bio.prix_moyen, bio.circuit === "GMS" ? "prix moyen pondéré, produit bio en GMS" : "prix moyen pondéré, magasins spécialisés bio") : null,
  };
}

// ---------------------------------------------------------------- main

async function main() {
  console.log(OFFLINE ? "Mode hors-ligne : lecture du cache" : `Téléchargement depuis ${BASE}`);

  const home = await get("/", "accueil.html");
  const produitsRnm = home ? parseProduits(home.html) : [];
  if (!produitsRnm.length) warn("liste des produits RNM introuvable sur la page d'accueil");
  const matchProduit = makeProduitMatcher(produitsRnm);

  // Découverte des marchés de détail.
  const found = new Map();
  for (const sect of SECTEURS) {
    const page = await get(`/prix?MARCHES&${sect}&DETAIL`, `secteur-${sect}.html`);
    if (page) for (const m of parseMarchesDetail(page.html)) found.set(m.code, m.nom);
  }
  if (!found.size) {
    warn("découverte des marchés détail impossible, utilisation de la liste connue");
    for (const c of MARCHES_CONNUS) found.set(c, null);
  }
  for (const c of MARCHES_CONNUS) if (!found.has(c)) warn(`le marché M${c} n'apparaît plus dans les rubriques Détail`);

  const marches = [];
  const series = [];
  for (const [code] of [...found].sort()) {
    const url = `${BASE}/prix?M${code}:MARCHE`;
    const page = await get(`/prix?M${code}:MARCHE`, `M${code}.html`);
    if (!page) { marches.push({ code: `M${code}`, url, statut: "indisponible" }); continue; }
    const m = parseMarche(page.html, code);
    const circuit = /SPECIALISES BIO/i.test(m.nom) ? "magasins_bio_specialises" : "GMS";
    if (!m.series.length) warn(`M${code} (${m.nom || "?"}) : aucune série lue`);
    if (!m.periode) warn(`M${code} : période non reconnue`);
    marches.push({ code: `M${code}`, nom: m.nom, circuit, url, periode: m.periode, nb_series: m.series.length, source_brute: path.relative(ROOT, page.from), statut: m.series.length ? "ok" : "vide" });
    for (const s of m.series) {
      if (!s.unite) warn(`M${code} « ${s.libelle} » : unité inconnue`);
      if (s.prix_moyen != null && s.mini_d1 != null && s.maxi_d9 != null && (s.prix_moyen < s.mini_d1 || s.prix_moyen > s.maxi_d9))
        warn(`M${code} « ${s.libelle} » : prix moyen ${s.prix_moyen} hors de l'intervalle mini/maxi ${s.mini_d1}–${s.maxi_d9} publié par le RNM (repris tel quel)`);
      series.push({
        produit: matchProduit(s.libelle),
        ...s,
        bio: isBio(s.libelle),
        label: isLabel(s.libelle),
        marche_code: `M${code}`,
        marche_nom: m.nom,
        circuit,
        periode: m.periode?.libelle ?? null,
        url,
      });
    }
  }

  if (!series.length) {
    console.error("Aucune série récupérée : le catalogue existant n'est pas modifié.");
    process.exit(1);
  }

  const byProduit = new Map();
  for (const s of series) {
    if (!byProduit.has(s.produit)) byProduit.set(s.produit, []);
    byProduit.get(s.produit).push(s);
  }
  const produitsSet = new Set(produitsRnm);
  const produits = [...byProduit]
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .map(([produit, ss]) => ({
      produit,
      url_produit: produitsSet.has(produit) ? `${BASE}/prix?${slug(produit)}` : null,
      unites: [...new Set(ss.map((s) => s.unite))],
      niveaux: choisirNiveaux(ss),
      series: ss.map(({ produit: _p, ...rest }) => rest),
    }));

  const count = (k) => produits.filter((p) => p.niveaux[k]).length;
  const periodes = [...new Set(marches.map((m) => m.periode?.libelle).filter(Boolean))];
  const out = {
    genere_le: today,
    source: "RNM – FranceAgriMer",
    source_url: BASE,
    licence: "Licence ouverte FranceAgriMer — mention obligatoire de la source (https://www.franceagrimer.fr/La-licence-ouverte)",
    stade: "détail (prix consommateur, € TTC)",
    periodes,
    methode_niveaux: {
      moyen: "Prix moyen pondéré RNM d'une série conventionnelle (ni bio, ni label rouge/AOP/IGP) relevée en GMS ; à unités égales on privilégie France puis vrac, et en cas d'égalité la série médiane en prix.",
      premier: "1er décile (colonne « mini ») de cette même série GMS : 10 % des magasins du panel affichent un prix inférieur ou égal. Le RNM ne publie AUCUNE série hard-discount distincte ; c'est une approximation.",
      qualite: "Prix moyen pondéré d'une série « biologique » de même unité : en GMS si elle existe, sinon en magasins spécialisés bio. Le choix est automatique (ressemblance de libellé) et doit être vérifié avant rattachement à un ingrédient.",
    },
    resume: {
      marches: marches.length,
      series: series.length,
      produits: produits.length,
      avec_premier: count("premier"),
      avec_moyen: count("moyen"),
      avec_qualite: count("qualite"),
      avec_les_trois: produits.filter((p) => p.niveaux.premier && p.niveaux.moyen && p.niveaux.qualite).length,
    },
    avertissements: warnings,
    marches,
    produits,
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`✓ ${path.relative(ROOT, OUT)} : ${out.resume.produits} produits, ${out.resume.series} séries, ${marches.length} marchés (${periodes.join(", ")})`);
  console.log(`  niveaux : premier ${out.resume.avec_premier} · moyen ${out.resume.avec_moyen} · qualite ${out.resume.avec_qualite} · les trois ${out.resume.avec_les_trois}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
