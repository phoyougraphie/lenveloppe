// Assemble data/prix.json à partir des sources (RNM d'abord, Open Prices ensuite).
// La correspondance ingrédient → source est dans data/sources/correspondances.json :
//   { "carotte": { "rnm": "Carotte" }, "tomate": { "rnm": "Tomate", "libelle_moyen": "TOMATE ronde ..." },
//     "lentille-corail": { "openprices": true }, "sel": null }
// Aucun prix n'est inventé : un ingrédient sans correspondance n'apparaît pas dans prix.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const lire = (p, defaut) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : defaut);
const ingredients = lire('data/ingredients.json', {});
const corr = lire('data/sources/correspondances.json', {});
const rnm = lire('data/sources/rnm-catalogue.json', { produits: [] });
const op = lire('data/sources/openprices-prix.json', {});
const opItems = op.items ?? op;

const rnmParNom = new Map(rnm.produits.map((p) => [p.produit.toLowerCase(), p]));
const NIV = ['premier', 'moyen', 'qualite'];
const items = {};
const rapport = { rnm: [], openprices: [], aucun: [], erreurs: [] };

for (const [ref, ing] of Object.entries(ingredients)) {
  if (ing.placard) continue;
  const c = corr[ref];
  if (c?.rnm) {
    const p = rnmParNom.get(c.rnm.toLowerCase());
    if (!p) { rapport.erreurs.push(`${ref} : produit RNM « ${c.rnm} » absent du catalogue`); continue; }
    // Choix explicite de série si demandé (variétés multiples), sinon les niveaux déjà choisis par le script RNM.
    const niveaux = { ...p.niveaux };
    for (const n of NIV) {
      const lib = c[`libelle_${n}`];
      if (!lib) continue;
      const s = p.series.find((x) => x.libelle === lib);
      if (!s) { rapport.erreurs.push(`${ref} : série « ${lib} » introuvable`); continue; }
      niveaux[n] = { valeur: n === 'premier' ? s.mini_d1 : s.prix_moyen, unite: s.unite, periode: s.periode, url: s.url, circuit: s.circuit };
    }
    // Œufs : RNM publie la boîte de 6 ; on ramène à la pièce (division exacte, pas d'estimation).
    for (const n of NIV) {
      const v = niveaux[n];
      if (v?.unite === 'botte') niveaux[n] = { ...v, unite: 'piece' }; // une botte = une « pièce » côté recette
      else if (v?.unite === 'boîte de 6') niveaux[n] = { ...v, valeur: Math.round((v.valeur / 6) * 1000) / 1000, unite: 'piece' };
    }
    const unites = new Set(NIV.map((n) => niveaux[n]?.unite).filter(Boolean));
    if (unites.size > 1) { rapport.erreurs.push(`${ref} : unités RNM incohérentes ${[...unites]}`); continue; }
    const unite = [...unites][0];
    if (!unite || !['kg', 'l', 'piece'].includes(unite)) { rapport.erreurs.push(`${ref} : unité RNM « ${unite} » non gérée`); continue; }
    const m = niveaux.moyen ?? niveaux.qualite ?? niveaux.premier;
    items[ref] = {
      unite,
      premier: niveaux.premier?.valeur ?? null,
      moyen: niveaux.moyen?.valeur ?? null,
      qualite: niveaux.qualite?.valeur ?? null,
      source: 'RNM – FranceAgriMer',
      detail: `Prix au détail. 1er prix = 1er décile GMS ; moyen = prix moyen GMS ; bio = ${niveaux.qualite?.circuit === 'GMS' ? 'bio en GMS' : 'magasins bio'}`,
      periode: m?.periode ?? null,
      url: p.url_produit ?? m?.url ?? null,
      observations: null,
    };
    rapport.rnm.push(ref);
  } else if (c?.openprices || (c === undefined && opItems[ref])) {
    const o = opItems[ref];
    if (!o || NIV.every((n) => o[n] == null)) { rapport.aucun.push(ref); continue; }
    items[ref] = o;
    rapport.openprices.push(ref);
  } else {
    rapport.aucun.push(ref);
  }
}

writeFileSync('data/prix.json', JSON.stringify({ genere_le: new Date().toISOString().slice(0, 10), items }, null, 1) + '\n');
const total = rapport.rnm.length + rapport.openprices.length + rapport.aucun.length;
const pct = (n) => (total ? Math.round((100 * n) / total) : 0);
console.log(`Ingrédients hors placard : ${total}`);
console.log(`  RNM (public)        : ${rapport.rnm.length} (${pct(rapport.rnm.length)} %)`);
console.log(`  Open Prices (collab): ${rapport.openprices.length} (${pct(rapport.openprices.length)} %)`);
console.log(`  Sans prix           : ${rapport.aucun.length} (${pct(rapport.aucun.length)} %) ${rapport.aucun.join(', ')}`);
if (rapport.erreurs.length) { console.error('Erreurs :\n  ' + rapport.erreurs.join('\n  ')); process.exitCode = 1; }
