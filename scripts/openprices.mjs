#!/usr/bin/env node
// scripts/openprices.mjs — prix de l'épicerie sèche via Open Prices (Open Food Facts)
//
// Produit data/sources/openprices-prix.json : pour chaque ingrédient décrit dans
// data/sources/openprices-requetes.json, un prix en €/kg (ou €/l) sur trois
// niveaux (premier / moyen / qualite), au format des `items` de data/prix.json
// (voir docs/schema.md). Méthode détaillée : docs/methodo-openprices.md.
//
// Source : API publique en lecture d'Open Prices, https://prices.openfoodfacts.org/api/docs
// (sans compte). Données collaboratives (saisies par des bénévoles), licence ODbL.
// Le poids des produits vient de la fiche Open Food Facts (product_quantity),
// incluse dans la réponse Open Prices ; à défaut on interroge l'API produit
// d'Open Food Facts.
//
// Usage :
//   node scripts/openprices.mjs                 # réutilise le cache brut de moins de 7 jours, sinon télécharge
//   node scripts/openprices.mjs --refresh       # force le re-téléchargement
//   node scripts/openprices.mjs --offline       # n'utilise que le cache brut (le plus récent)
//   node scripts/openprices.mjs --only pates,sucre
//   node scripts/openprices.mjs --verbose       # détail des rejets et des relevés par ingrédient
//
// Aucune dépendance. Node >= 18 (fetch natif), testé avec Node 24.

import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = path.join(ROOT, "data/sources/openprices-requetes.json");
const OUT = path.join(ROOT, "data/sources/openprices-prix.json");
const RAW_DIR = path.join(ROOT, "data/sources/raw/openprices");
const OFF_CACHE = path.join(RAW_DIR, "off-produits.json");

const API = "https://prices.openfoodfacts.org/api/v1/prices";
const OFF_API = "https://world.openfoodfacts.org/api/v2/product";
const UA = "LEnveloppe/0.1 (projet non commercial)";
const DELAY_MS = 1100; // ~1 requête/seconde, pas de rafale
const PAGE_SIZE = 100;
const CACHE_JOURS = 7; // un cache brut de moins de 7 jours est réutilisé (sauf --refresh)

const args = process.argv.slice(2);
const REFRESH = args.includes("--refresh");
const OFFLINE = args.includes("--offline");
const VERBOSE = args.includes("--verbose");
const ONLY = (() => {
  const i = args.indexOf("--only");
  return i >= 0 ? new Set(args[i + 1].split(",")) : null;
})();

// ---- Paramètres de méthode (documentés dans docs/methodo-openprices.md) ----
const SEUIL = 5; // relevés minimum pour publier un niveau, sinon null
const SEUIL_PREMIER = 8; // un 1er quartile sur moins de 8 valeurs ne veut pas dire grand-chose
const QUANTILE_PREMIER = 0.25; // premier = 1er quartile des prix non bio
const FENETRE_COURTE = 12; // mois
const FENETRE_LONGUE = 24; // mois, utilisée seulement si la courte a < SEUIL relevés
const MAX_PAR_PRODUIT = 3; // au plus 3 relevés (les plus récents) par produit et par niveau
const FACTEUR_ABERRANT = 4; // écarte les €/kg < médiane/4 ou > médiane×4 (erreur de poids, de saisie)
const LABELS_BIO = ["en:organic", "en:eu-organic", "fr:ab-agriculture-biologique"];
// Enseignes de hard-discount présentes en France (nom ou marque OSM du magasin).
// Sert seulement de diagnostic : Open Prices compte trop peu de relevés dans
// ces enseignes pour en tirer un niveau (voir docs/methodo-openprices.md).
const ENSEIGNES_DISCOUNT = /\b(lidl|aldi|netto|leader ?price|norma|supeco|le mutant)\b/i;

const TODAY = new Date();
const today = TODAY.toISOString().slice(0, 10);
const moisAvant = (n) => {
  const d = new Date(TODAY);
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
};
const DEBUT_COURT = moisAvant(FENETRE_COURTE);
const DEBUT_LONG = moisAvant(FENETRE_LONGUE);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Deux files séparées : Open Prices (~1 req/s) et l'API produit d'Open Food Facts,
// plus stricte (réponses 429 constatées au-delà de ~10 req/min).
const files = { prices: { delai: DELAY_MS, derniere: 0 }, off: { delai: 6000, derniere: 0 } };
async function getJSON(url, file = "prices") {
  const f = files[file];
  for (let essai = 1; essai <= 4; essai++) {
    const attente = f.derniere + f.delai - Date.now();
    if (attente > 0) await sleep(attente);
    f.derniere = Date.now();
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    } catch (e) {
      console.warn(`  réseau (${e.message}), essai ${essai}/4`);
      await sleep(5000 * essai);
      continue;
    }
    if (res.ok) return res.json();
    if (res.status === 404) return null;
    if (res.status === 429 || res.status >= 500) {
      console.warn(`  HTTP ${res.status} (${file}), pause puis essai ${essai + 1}/4`);
      if (res.status === 429 && file === "off") f.delai = Math.min(f.delai * 1.5, 30000);
      await sleep(15000 * essai);
      continue;
    }
    throw new Error(`HTTP ${res.status} pour ${url}`);
  }
  throw new Error(`Échec répété pour ${url}`);
}

// ---- Construction des requêtes ----
function paramsRequete(req, debut) {
  const p = new URLSearchParams();
  if (req.mode === "vrac") {
    p.set("type", "CATEGORY");
    p.set("category_tag", req.categorie);
  } else {
    p.set("type", "PRODUCT");
    p.set("product__categories_tags__contains", req.categorie);
  }
  p.set("currency", "EUR");
  p.set("date__gte", debut);
  p.set("duplicate_of__isnull", "true");
  p.set("order_by", "-date");
  return p;
}
const urlLisible = (req, debut) => `${API}?${paramsRequete(req, debut).toString().replaceAll("%3A", ":")}`;

// ---- Cache brut : data/sources/raw/openprices/<AAAA-MM-JJ>/<cle>.json.gz ----
const cleRequete = (req) => `${req.mode}--${req.categorie.replace(/[^a-z0-9-]+/gi, "_")}`;

async function dernierCache(cle) {
  if (!existsSync(RAW_DIR)) return null;
  const jours = (await readdir(RAW_DIR)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
  for (const j of jours) {
    const f = path.join(RAW_DIR, j, `${cle}.json.gz`);
    if (existsSync(f)) return { jour: j, fichier: f };
  }
  return null;
}

async function telechargerRequete(req) {
  const cle = cleRequete(req);
  const fichierDuJour = path.join(RAW_DIR, today, `${cle}.json.gz`);
  if (!REFRESH) {
    let c = await dernierCache(cle);
    if (c && !OFFLINE && (TODAY - new Date(c.jour)) / 86400000 > CACHE_JOURS) c = null;
    if (c) {
      const brut = JSON.parse(gunzipSync(await readFile(c.fichier)).toString("utf8"));
      return { ...brut, depuisCache: c.jour };
    }
    if (OFFLINE) throw new Error(`--offline : pas de cache pour ${cle}`);
  }
  const pages = [];
  let page = 1;
  let total = null;
  for (;;) {
    const p = paramsRequete(req, DEBUT_LONG);
    p.set("size", String(PAGE_SIZE));
    p.set("page", String(page));
    const d = await getJSON(`${API}?${p}`);
    if (!d) break;
    pages.push(d);
    total = d.total;
    process.stdout.write(`\r  ${req.mode} ${req.categorie} : page ${page}/${d.pages}   `);
    if (page >= (d.pages || 1)) break;
    page++;
  }
  process.stdout.write("\n");
  const brut = {
    requete: req,
    url: `${API}?${paramsRequete(req, DEBUT_LONG)}`,
    telecharge_le: new Date().toISOString(),
    total,
    pages,
  };
  await mkdir(path.dirname(fichierDuJour), { recursive: true });
  await writeFile(fichierDuJour, gzipSync(JSON.stringify(brut)));
  return { ...brut, depuisCache: null };
}

// ---- Poids des produits ----
let offCache = {};
let offAppels = 0;
async function chargerOffCache() {
  if (existsSync(OFF_CACHE)) offCache = JSON.parse(await readFile(OFF_CACHE, "utf8"));
}
async function poidsDepuisOFF(code) {
  if (code in offCache) return offCache[code];
  if (OFFLINE) return null;
  let d;
  try {
    d = await getJSON(`${OFF_API}/${encodeURIComponent(code)}?fields=product_quantity,product_quantity_unit,quantity`, "off");
  } catch (e) {
    console.warn(`  OFF ${code} : ${e.message} (relevé écarté)`);
    return null; // pas mis en cache : on réessaiera au prochain passage
  }
  const p = d?.product || null;
  offCache[code] = p
    ? { product_quantity: p.product_quantity ?? null, product_quantity_unit: p.product_quantity_unit ?? null, quantity: p.quantity ?? null }
    : null;
  if (++offAppels % 10 === 0) await writeFile(OFF_CACHE, JSON.stringify(offCache, null, 1));
  return offCache[code];
}

const UNITES = { g: ["masse", 1], gr: ["masse", 1], kg: ["masse", 1000], mg: ["masse", 0.001], ml: ["volume", 1], cl: ["volume", 10], dl: ["volume", 100], l: ["volume", 1000] };

// Lit "500 g", "4 x 400 g", "1 L", "75cl" -> { type, valeur (g ou ml) }
function parseQuantite(txt) {
  if (!txt || typeof txt !== "string") return null;
  const t = txt.toLowerCase().replace(",", ".");
  let m = t.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|mg|gr|g|cl|dl|ml|l)\b/);
  if (m) {
    const [type, f] = UNITES[m[3]];
    return { type, valeur: Number(m[1]) * Number(m[2]) * f };
  }
  m = t.match(/(\d+(?:\.\d+)?)\s*(kg|mg|gr|g|cl|dl|ml|l)\b/);
  if (m) {
    const [type, f] = UNITES[m[2]];
    return { type, valeur: Number(m[1]) * f };
  }
  return null;
}

function quantiteProduit(prod) {
  if (!prod) return null;
  const q = Number(prod.product_quantity);
  const u = (prod.product_quantity_unit || "g").toLowerCase();
  if (q > 0 && UNITES[u]) {
    const [type, f] = UNITES[u];
    return { type, valeur: q * f };
  }
  return parseQuantite(prod.quantity);
}

// Convertit une quantité en unités de prix (kg ou l). null si impossible.
function versUnitePrix(qte, unite, densite) {
  if (!qte || !(qte.valeur > 0)) return null;
  if (unite === "kg") {
    if (qte.type === "masse") return qte.valeur / 1000;
    if (densite) return (qte.valeur / 1000) * densite;
  } else if (unite === "l") {
    if (qte.type === "volume") return qte.valeur / 1000;
    if (densite) return qte.valeur / 1000 / densite;
  }
  return null;
}

// ---- Statistiques ----
function quantile(valeurs, q) {
  const v = [...valeurs].sort((a, b) => a - b);
  if (!v.length) return null;
  const pos = (v.length - 1) * q;
  const bas = Math.floor(pos);
  const haut = Math.ceil(pos);
  return v[bas] + (v[haut] - v[bas]) * (pos - bas);
}
const mediane = (v) => quantile(v, 0.5);
const arrondi = (x) => (x == null ? null : Math.round(x * 100) / 100);

// ---- Normalisation d'un relevé ----
async function normaliser(prix, cfg, req) {
  const loc = prix.location;
  if (!loc || loc.type !== "OSM") return { rejet: "magasin en ligne ou inconnu" };
  if (loc.osm_address_country_code !== "FR") return { rejet: "hors France" };
  if (prix.currency !== "EUR") return { rejet: "devise" };

  const tags = prix.type === "PRODUCT" ? prix.product?.categories_tags || [] : [prix.category_tag];
  if (prix.type === "PRODUCT") {
    if ((cfg.exiger || []).some((t) => !tags.includes(t))) return { rejet: "catégorie exigée absente" };
    if ((cfg.exclure || []).some((t) => tags.includes(t))) return { rejet: "catégorie exclue" };
    if (cfg.exclure_nom) {
      const nom = `${prix.product?.product_name || ""} ${prix.product_name || ""}`;
      if (new RegExp(cfg.exclure_nom, "i").test(nom)) return { rejet: "nom de produit exclu" };
    }
    if (cfg.exiger_nom) {
      const nom = `${prix.product?.product_name || ""} ${prix.product_name || ""}`;
      if (!new RegExp(cfg.exiger_nom, "i").test(nom)) return { rejet: "nom de produit hors sujet" };
    }
    const lab = prix.product?.labels_tags || [];
    if (cfg.exiger_label_un_de && !cfg.exiger_label_un_de.some((l) => lab.includes(l))) return { rejet: "label exigé absent" };
  } else if (cfg.exiger_label_un_de) {
    return { rejet: "label exigé absent" };
  }

  // Prix de référence : hors promotion. Si le relevé est une promo, on prend
  // le prix barré s'il est connu, sinon on écarte le relevé.
  let p = Number(prix.price);
  if (prix.price_is_discounted) {
    if (Number(prix.price_without_discount) > 0) p = Number(prix.price_without_discount);
    else return { rejet: "promotion sans prix normal" };
  }
  if (!(p > 0)) return { rejet: "prix nul" };

  let eur;
  if (prix.price_per === "KILOGRAM") {
    // Prix déjà au kilo (vrac, produits pesés). Pour un liquide on applique la densité.
    if (cfg.unite === "kg") eur = p;
    else if (cfg.densite) eur = p * cfg.densite;
    else return { rejet: "prix au kg pour un produit en litres, sans densité" };
  } else if (prix.type === "PRODUCT") {
    let qte = quantiteProduit(prix.product);
    if (!qte && prix.product_code) qte = quantiteProduit(await poidsDepuisOFF(prix.product_code));
    const u = versUnitePrix(qte, cfg.unite, cfg.densite);
    if (!u) return { rejet: "poids/volume du produit inconnu" };
    eur = p / u;
  } else {
    return { rejet: "prix à l'unité sans poids (vrac)" };
  }

  const labels = (prix.type === "PRODUCT" ? prix.product?.labels_tags : prix.labels_tags) || [];
  const enseigne = loc.osm_brand || loc.osm_name || "";
  return {
    obs: {
      id: prix.id,
      date: prix.date,
      eur,
      bio: labels.some((l) => LABELS_BIO.includes(l)),
      discount: ENSEIGNES_DISCOUNT.test(enseigne),
      enseigne,
      code: prix.product_code || null,
      // Identifiant « produit » pour le plafond par produit : code-barres, ou catégorie + magasin pour le vrac.
      produit: prix.product_code || `${prix.category_tag}@${prix.location_id}`,
      mode: req.mode,
      // Même produit, même magasin, même jour, même prix = un seul relevé
      // (deux contributeurs ont pu saisir la même étiquette).
      cle: `${prix.product_code || prix.category_tag}|${prix.location_id}|${prix.date}|${p}`,
    },
  };
}

// Calcule un niveau : fenêtre courte si assez de relevés, sinon longue, sinon null.
// Plafonne à MAX_PAR_PRODUIT relevés par produit (les plus récents), pour qu'un
// seul produit relevé chaque semaine par le même contributeur ne fasse pas la médiane.
function plafonner(obs) {
  const parProduit = new Map();
  for (const o of [...obs].sort((a, b) => b.date.localeCompare(a.date))) {
    const l = parProduit.get(o.produit) || [];
    if (l.length < MAX_PAR_PRODUIT) l.push(o);
    parProduit.set(o.produit, l);
  }
  return [...parProduit.values()].flat().map((o) => o.eur);
}

function niveau(obs, filtre, stat, seuil = SEUIL) {
  const court = plafonner(obs.filter((o) => filtre(o) && o.date >= DEBUT_COURT));
  if (court.length >= seuil) return { valeur: stat(court), n: court.length, mois: FENETRE_COURTE };
  const long = plafonner(obs.filter((o) => filtre(o) && o.date >= DEBUT_LONG));
  if (long.length >= seuil) return { valeur: stat(long), n: long.length, mois: FENETRE_LONGUE };
  return { valeur: null, n: long.length, mois: null };
}

// ---- Programme principal ----
const config = JSON.parse(await readFile(CONFIG, "utf8"));
await chargerOffCache();
const ids = Object.keys(config).filter((k) => !k.startsWith("_") && (!ONLY || ONLY.has(k)));

// Fusion avec la sortie existante si --only (on ne recalcule que ces ingrédients).
let sortiePrecedente = {};
if (ONLY && existsSync(OUT)) sortiePrecedente = JSON.parse(await readFile(OUT, "utf8")).items || {};

const items = { ...sortiePrecedente };
const diagnostics = {};
for (const id of ids) {
  const cfg = config[id];
  console.log(`\n${id} (${cfg.nom})`);
  const vus = new Set();
  const cles = new Set();
  const obs = [];
  const rejets = {};
  for (const req of cfg.requetes) {
    const brut = await telechargerRequete(req);
    if (brut.depuisCache) console.log(`  ${req.mode} ${req.categorie} : cache du ${brut.depuisCache}`);
    for (const page of brut.pages) {
      for (const prix of page.items || []) {
        if (vus.has(prix.id)) continue;
        vus.add(prix.id);
        if (prix.date < DEBUT_LONG) continue;
        const r = await normaliser(prix, cfg, req);
        if (r.rejet) rejets[r.rejet] = (rejets[r.rejet] || 0) + 1;
        else if (cles.has(r.obs.cle)) rejets["doublon (même produit, magasin, jour et prix)"] = (rejets["doublon (même produit, magasin, jour et prix)"] || 0) + 1;
        else {
          cles.add(r.obs.cle);
          obs.push(r.obs);
        }
      }
    }
  }

  // Écarte les valeurs aberrantes autour de la médiane globale (24 mois, tous niveaux).
  const m0 = mediane(obs.map((o) => o.eur));
  const gardes = obs.filter((o) => o.eur >= m0 / FACTEUR_ABERRANT && o.eur <= m0 * FACTEUR_ABERRANT);
  if (obs.length - gardes.length) rejets["valeur aberrante (×4 / ÷4 de la médiane)"] = obs.length - gardes.length;

  const conv = (o) => !o.bio;
  const moyen = niveau(gardes, conv, mediane);
  const premier = niveau(gardes, conv, (v) => quantile(v, QUANTILE_PREMIER), SEUIL_PREMIER);
  const qualite = niveau(gardes, (o) => o.bio, mediane);
  // Contrôle, non publié : médiane des relevés non bio en enseignes de hard-discount.
  const discount = niveau(gardes, (o) => conv(o) && o.discount, mediane);

  const fenetres = [moyen, premier, qualite].map((n) => n.mois).filter(Boolean);
  const moisMax = fenetres.length ? Math.max(...fenetres) : FENETRE_COURTE;
  const debut = moisMax === FENETRE_LONGUE ? DEBUT_LONG : DEBUT_COURT;
  const elargis = ["premier", "moyen", "qualite"].filter((k, i) => [premier, moyen, qualite][i].mois === FENETRE_LONGUE);

  items[id] = {
    unite: cfg.unite,
    premier: arrondi(premier.valeur),
    moyen: arrondi(moyen.valeur),
    qualite: arrondi(qualite.valeur),
    source: "Open Prices – Open Food Facts (données collaboratives)",
    detail:
      `${cfg.nom}. Calculé sur des relevés de prix saisis par des bénévoles en magasin, France, hors promotions, au plus ${MAX_PAR_PRODUIT} relevés par produit : ` +
      `moyen = médiane des produits non bio, premier = 1er quartile des produits non bio, qualite = médiane des produits bio. ` +
      `Fenêtre ${FENETRE_COURTE} mois` +
      (elargis.length ? ` (élargie à ${FENETRE_LONGUE} mois pour : ${elargis.join(", ")}, faute de relevés)` : "") +
      `. Niveau non publié sous ${SEUIL} relevés (${SEUIL_PREMIER} pour premier).`,
    periode: `${debut} – ${today}`,
    url: urlLisible(cfg.requetes[0], debut),
    observations: { premier: premier.n, moyen: moyen.n, qualite: qualite.n },
    fenetre_mois: { premier: premier.mois, moyen: moyen.mois, qualite: qualite.mois },
  };
  diagnostics[id] = {
    retenus_24_mois: gardes.length,
    rejets,
    controle_mediane_hard_discount: { valeur: arrondi(discount.valeur), n: discount.n },
    mediane_globale_24_mois: arrondi(m0),
  };

  console.log(
    `  relevés FR retenus ${gardes.length} | premier ${arrondi(premier.valeur)} (n=${premier.n}) · moyen ${arrondi(moyen.valeur)} (n=${moyen.n}) · qualite ${arrondi(qualite.valeur)} (n=${qualite.n}) €/${cfg.unite} | contrôle hard-discount ${arrondi(discount.valeur)} (n=${discount.n})`
  );
  if (VERBOSE) {
    console.log("  rejets :", rejets);
    const parEnseigne = {};
    for (const o of gardes) parEnseigne[o.enseigne] = (parEnseigne[o.enseigne] || 0) + 1;
    console.log("  enseignes :", Object.entries(parEnseigne).sort((a, b) => b[1] - a[1]).slice(0, 12));
  }
}

await writeFile(OFF_CACHE, JSON.stringify(offCache, null, 1));

const sortie = {
  genere_le: today,
  source: "Open Prices – Open Food Facts (données collaboratives), https://prices.openfoodfacts.org — licence ODbL",
  methode: "docs/methodo-openprices.md",
  parametres: {
    seuil_releves: SEUIL,
    seuil_releves_premier: SEUIL_PREMIER,
    premier: "1er quartile des relevés non bio",
    moyen: "médiane des relevés non bio",
    qualite: "médiane des relevés bio",
    fenetre_mois: FENETRE_COURTE,
    fenetre_elargie_mois: FENETRE_LONGUE,
    facteur_aberrant: FACTEUR_ABERRANT,
    max_releves_par_produit: MAX_PAR_PRODUIT,
    labels_bio: LABELS_BIO,
    enseignes_discount: ENSEIGNES_DISCOUNT.source,
  },
  items: Object.fromEntries(Object.entries(items).sort(([a], [b]) => a.localeCompare(b))),
  diagnostics,
};
await writeFile(OUT, JSON.stringify(sortie, null, 2) + "\n");

const tous = Object.values(sortie.items);
const compte = (k) => tous.filter((i) => i[k] != null).length;
console.log(`\n${OUT}\n${tous.length} ingrédients · premier ${compte("premier")} · moyen ${compte("moyen")} · qualite ${compte("qualite")}`);
