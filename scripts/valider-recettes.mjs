#!/usr/bin/env node
// Validation des recettes de L'enveloppe (Node 24, ESM, sans dépendance).
//
//   node scripts/valider-recettes.mjs            -> contrôle + tableau récapitulatif
//   node scripts/valider-recettes.mjs --detail   -> ajoute le détail recette par recette
//
// Vérifie le contrat de docs/schema.md (refs, unités, poids à la pièce, champs obligatoires),
// calcule les régimes selon les règles du schéma (jamais déclarés à la main), pour la recette
// de base et pour chaque variante, et vérifie que chaque variante atteint bien le régime annoncé.
// Code de sortie 1 s'il reste au moins une erreur.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR_RECETTES = path.join(ROOT, "data", "recettes");
const FICHIER_INGREDIENTS = path.join(ROOT, "data", "ingredients.json");
const DETAIL = process.argv.includes("--detail");

const UNITES = new Set(["g", "ml", "piece", null]);
const RAYONS = new Set(["frais", "sec", "cremerie", "boucherie", "poissonnerie", "placard"]);
const UNITES_PRIX = new Set(["kg", "l", "piece"]);
const ANIMAUX = new Set([null, "viande", "poisson", "laitier", "oeuf", "miel"]);
const PRIX_SOURCES = new Set([null, "rnm", "openprices", "insee", "aucune"]);
const REGIMES = ["vegetarien", "vegan", "sans-gluten", "proteines"];
const SEUIL_PROTEINES = 20; // g par portion (docs/schema.md)
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const erreurs = [];
const avertissements = [];
const err = (ou, msg) => erreurs.push(`${ou} : ${msg}`);
const warn = (ou, msg) => avertissements.push(`${ou} : ${msg}`);

// ---------- Ingrédients ----------
let ING = {};
try {
  ING = JSON.parse(fs.readFileSync(FICHIER_INGREDIENTS, "utf8"));
} catch (e) {
  console.error(`Impossible de lire ${FICHIER_INGREDIENTS} : ${e.message}`);
  process.exit(1);
}

for (const [id, i] of Object.entries(ING)) {
  const ou = `ingredients.json › ${id}`;
  if (!ID_RE.test(id)) err(ou, "identifiant hors kebab-case ASCII");
  if (typeof i.nom !== "string" || !i.nom.trim()) err(ou, "nom manquant");
  if (!RAYONS.has(i.rayon)) err(ou, `rayon invalide (${i.rayon})`);
  if (!UNITES_PRIX.has(i.unite_prix)) err(ou, `unite_prix invalide (${i.unite_prix})`);
  if (!ANIMAUX.has(i.animal ?? null)) err(ou, `animal invalide (${i.animal})`);
  if (typeof i.gluten !== "boolean") err(ou, "gluten doit être true/false");
  if (typeof i.placard !== "boolean") err(ou, "placard doit être true/false");
  if (i.proteines_100g !== null && !(typeof i.proteines_100g === "number" && i.proteines_100g >= 0 && i.proteines_100g <= 100))
    err(ou, `proteines_100g invalide (${i.proteines_100g})`);
  if (i.proteines_100g !== null && !i.ciqual_code) warn(ou, "protéines renseignées sans code Ciqual");
  if (i.ciqual_code !== null && !/^\d+$/.test(String(i.ciqual_code))) err(ou, `ciqual_code invalide (${i.ciqual_code})`);
  if (i.poids_piece_g != null && !(i.poids_piece_g > 0)) err(ou, "poids_piece_g doit être > 0");
  if (i.unite_prix === "piece" && !(i.poids_piece_g > 0)) err(ou, "unite_prix piece sans poids_piece_g");
  if (!PRIX_SOURCES.has(i.prix_source ?? null)) err(ou, `prix_source invalide (${i.prix_source})`);
  if (!i.placard && i.proteines_100g === null) warn(ou, "protéines inconnues : la recette ne pourra pas être classée « protéines »");
}

// ---------- Outils ----------
function verifierLigne(l, ou) {
  if (!l || typeof l !== "object") return err(ou, "ligne d'ingrédient invalide");
  const ing = ING[l.ref];
  if (!ing) return err(ou, `ref inconnue « ${l.ref} »`);
  if (!("unite" in l) || !UNITES.has(l.unite)) err(ou, `unité invalide « ${l.unite} » pour ${l.ref}`);
  if ((l.qte === null) !== (l.unite === null)) err(ou, `${l.ref} : qte et unite doivent être nulles ensemble`);
  if (l.qte !== null && !(typeof l.qte === "number" && l.qte > 0)) err(ou, `${l.ref} : qte invalide (${l.qte})`);
  if (l.unite === "piece" && !(ing.poids_piece_g > 0)) err(ou, `${l.ref} utilisé à la pièce sans poids_piece_g`);
  if (l.qte === null && !ing.placard) warn(ou, `${l.ref} sans quantité alors qu'il n'est pas « placard »`);
}

function grammes(l) {
  if (l.qte == null) return null;
  if (l.unite === "g") return l.qte;
  if (l.unite === "ml") return l.qte; // densité 1 (approximation, voir docs/validation-dietetique.md)
  if (l.unite === "piece") return l.qte * (ING[l.ref]?.poids_piece_g ?? NaN);
  return null;
}

function analyser(lignes, portions) {
  const ings = lignes.map((l) => ING[l.ref]).filter(Boolean);
  const vegetarien = ings.every((i) => i.animal !== "viande" && i.animal !== "poisson");
  const vegan = ings.every((i) => i.animal == null);
  const sansGluten = ings.every((i) => i.gluten !== true);
  let prot = 0;
  let complet = true;
  for (const l of lignes) {
    const i = ING[l.ref];
    if (!i || i.placard) continue;
    const m = grammes(l);
    if (m == null || !Number.isFinite(m) || i.proteines_100g == null) { complet = false; continue; }
    prot += (m * i.proteines_100g) / 100;
  }
  const parPortion = portions > 0 ? prot / portions : NaN;
  const regimes = [];
  if (vegetarien) regimes.push("vegetarien");
  if (vegan) regimes.push("vegan");
  if (sansGluten) regimes.push("sans-gluten");
  if (complet && parPortion >= SEUIL_PROTEINES) regimes.push("proteines");
  return { regimes, protPortion: complet ? parPortion : null, protPartielle: parPortion };
}

function appliquerVariante(base, v, ou) {
  let lignes = base.map((l) => ({ ...l }));
  for (const r of v.remplace ?? []) {
    if (!lignes.some((l) => l.ref === r.de)) err(ou, `remplace « ${r.de} » absent de la recette`);
    verifierLigne(r.par, ou);
    lignes = lignes.map((l) => (l.ref === r.de ? { ...r.par } : l));
  }
  for (const ref of v.retire ?? []) {
    const cle = typeof ref === "string" ? ref : ref?.ref;
    if (!lignes.some((l) => l.ref === cle)) err(ou, `retire « ${cle} » absent de la recette`);
    lignes = lignes.filter((l) => l.ref !== cle);
  }
  for (const a of v.ajoute ?? []) {
    verifierLigne(a, ou);
    lignes.push({ ...a });
  }
  return lignes;
}

// ---------- Recettes ----------
const fichiers = fs.readdirSync(DIR_RECETTES).filter((f) => f.endsWith(".json")).sort();
const recettes = [];
const numeros = new Map();
const refsUtilisees = new Set();

for (const f of fichiers) {
  const ou = `recettes/${f}`;
  let r;
  try { r = JSON.parse(fs.readFileSync(path.join(DIR_RECETTES, f), "utf8")); }
  catch (e) { err(ou, `JSON illisible (${e.message})`); continue; }

  if (r.slug !== f.replace(/\.json$/, "")) err(ou, `slug « ${r.slug} » différent du nom de fichier`);
  if (!ID_RE.test(r.slug ?? "")) err(ou, "slug hors kebab-case ASCII");
  if (!Number.isInteger(r.numero) || r.numero < 1) err(ou, "numero invalide");
  else if (numeros.has(r.numero)) err(ou, `numero ${r.numero} déjà pris par ${numeros.get(r.numero)}`);
  else numeros.set(r.numero, f);
  for (const k of ["titre", "chapeau"]) if (typeof r[k] !== "string" || !r[k].trim()) err(ou, `${k} manquant`);
  if (!Number.isInteger(r.portions) || r.portions < 1) err(ou, "portions invalide");
  for (const k of ["prep_min", "cuisson_min"]) if (!Number.isInteger(r[k]) || r[k] < 0) err(ou, `${k} invalide`);
  if (!Array.isArray(r.etapes) || !r.etapes.length || r.etapes.some((e) => typeof e !== "string" || !e.trim())) err(ou, "etapes vides ou invalides");
  if (!Array.isArray(r.ingredients) || !r.ingredients.length) { err(ou, "ingredients vides"); continue; }
  if (r.note != null && typeof r.note !== "string") err(ou, "note doit être une chaîne ou null");
  if (!["non-testee", "testee"].includes(r.statut)) err(ou, `statut invalide (${r.statut})`);
  const s = r.source ?? {};
  if (s.type === "themealdb") {
    if (!/^\d+$/.test(String(s.id ?? ""))) err(ou, "source.id invalide");
    if (s.url !== `https://www.themealdb.com/meal/${s.id}`) err(ou, "source.url ne correspond pas à source.id");
  } else if (!s.type) err(ou, "source manquante");

  const vus = new Set();
  for (const l of r.ingredients) {
    verifierLigne(l, ou);
    if (vus.has(l.ref)) warn(ou, `${l.ref} cité deux fois`);
    vus.add(l.ref);
    refsUtilisees.add(l.ref);
  }

  const base = analyser(r.ingredients, r.portions);
  const variantes = [];
  if (!Array.isArray(r.variantes)) err(ou, "variantes doit être un tableau");
  for (const [n, v] of (r.variantes ?? []).entries()) {
    const ouv = `${ou} › variante ${n + 1} (${v.titre ?? "sans titre"})`;
    if (!REGIMES.includes(v.regime)) err(ouv, `regime invalide (${v.regime})`);
    for (const k of ["remplace", "ajoute", "retire"]) if (v[k] != null && !Array.isArray(v[k])) err(ouv, `${k} doit être un tableau`);
    const lignes = appliquerVariante(r.ingredients, v, ouv);
    lignes.forEach((l) => refsUtilisees.add(l.ref));
    const a = analyser(lignes, r.portions);
    if (REGIMES.includes(v.regime) && !a.regimes.includes(v.regime))
      err(ouv, `annonce « ${v.regime} » mais le calcul donne [${a.regimes.join(", ") || "aucun"}]`);
    if (base.regimes.includes(v.regime)) warn(ouv, `la recette de base est déjà « ${v.regime} »`);
    variantes.push({ titre: v.titre, regime: v.regime, ...a });
  }

  // Règle éditoriale : toute recette avec viande, poisson ou laitier propose une alternative végétale.
  const animaux = new Set(r.ingredients.map((l) => ING[l.ref]?.animal).filter(Boolean));
  const aViandePoisson = animaux.has("viande") || animaux.has("poisson");
  if ((aViandePoisson || animaux.has("laitier")) &&
      !variantes.some((v) => v.regimes.includes("vegan") || (aViandePoisson && v.regimes.includes("vegetarien"))))
    warn(ou, "contient un produit animal sans variante végétarienne/vegan");

  recettes.push({ fichier: f, r, base, variantes });
}

// Ingrédients déclarés mais jamais cités
for (const id of Object.keys(ING)) if (!refsUtilisees.has(id)) warn(`ingredients.json › ${id}`, "jamais utilisé");

// ---------- Rapport ----------
recettes.sort((a, b) => (a.r.numero ?? 0) - (b.r.numero ?? 0));
const fmt = (x) => (x == null ? "  n/d" : x.toFixed(1).padStart(5));
const court = { vegetarien: "VG", vegan: "VE", "sans-gluten": "SG", proteines: "PR" };

if (DETAIL) {
  console.log("\nN°   Recette                                       Base          Via variantes   Prot./portion : base | variantes");
  console.log("─".repeat(108));
  for (const { r, base, variantes } of recettes) {
    const via = [...new Set(variantes.flatMap((v) => v.regimes))].filter((x) => !base.regimes.includes(x));
    console.log(
      `${String(r.numero).padStart(3)}  ${r.slug.padEnd(45).slice(0, 45)} ${base.regimes.map((x) => court[x]).join(" ").padEnd(13)} ${via.map((x) => court[x]).join(" ").padEnd(15)} ${fmt(base.protPortion)} g | ${variantes.map((v) => `${court[v.regime] ?? "?"} ${fmt(v.protPortion).trim()}`).join(", ")}`
    );
  }
}

console.log(`\n${recettes.length} recettes, ${Object.keys(ING).length} ingrédients au dictionnaire, ${refsUtilisees.size} utilisés.`);
const rayons = {};
for (const id of refsUtilisees) { const ry = ING[id]?.rayon; if (ry) rayons[ry] = (rayons[ry] ?? 0) + 1; }
console.log("Ingrédients utilisés par rayon : " + Object.entries(rayons).map(([k, v]) => `${k} ${v}`).join(", "));

console.log("\nRégime              Recette de base   Base ou variante");
console.log("─".repeat(54));
for (const reg of REGIMES) {
  const nBase = recettes.filter((x) => x.base.regimes.includes(reg)).length;
  const nTot = recettes.filter((x) => x.base.regimes.includes(reg) || x.variantes.some((v) => v.regimes.includes(reg))).length;
  const ok = nTot >= 10 ? "" : "   < 10 !";
  console.log(`${reg.padEnd(20)}${String(nBase).padStart(15)}${String(nTot).padStart(19)}${ok}`);
}
console.log("(PR = ≥ 20 g de protéines par portion, valeurs Ciqual, ingrédients hors placard tous renseignés)");

if (avertissements.length) {
  console.log(`\n${avertissements.length} avertissement(s) :`);
  for (const a of avertissements) console.log("  ⚠ " + a);
}
if (erreurs.length) {
  console.log(`\n${erreurs.length} erreur(s) :`);
  for (const e of erreurs) console.log("  ✗ " + e);
  process.exit(1);
}
console.log("\n0 erreur.");
