import { B } from './lien';
// Recettes perso : stockées dans le navigateur (localStorage), jamais envoyées à un serveur.
// Partage : la recette voyage dans le #fragment du lien (le fragment n'est pas transmis au serveur).
import { enregistrerIngredients, REGIMES, type Ingredient, type Recette, type LigneRecette } from './calcul';

export interface RecettePerso extends Recette {
  id: string;
  perso: true;
  ingredients_perso: Record<string, Ingredient>;
  cree_le: string;
}

const CLE = 'mes-recettes';

function lireBrut(): RecettePerso[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLE) ?? '[]');
    return Array.isArray(v) ? v.map(nettoyer).filter((x): x is RecettePerso => x !== null) : [];
  } catch { return []; }
}

function ecrire(liste: RecettePerso[]) {
  localStorage.setItem(CLE, JSON.stringify(liste)); // laisse remonter l'erreur : l'appelant prévient
}

/** Charge les recettes perso et enregistre leurs ingrédients dans le dictionnaire de calcul. */
export function charger(): RecettePerso[] {
  const liste = lireBrut();
  for (const r of liste) enregistrerIngredients(r.ingredients_perso);
  return liste;
}

export const obtenir = (id: string) => charger().find((r) => r.id === id) ?? null;

export function enregistrer(r: RecettePerso) {
  const liste = lireBrut().filter((x) => x.id !== r.id);
  liste.push(r);
  ecrire(liste);
  enregistrerIngredients(r.ingredients_perso);
}

export function supprimer(id: string) {
  ecrire(lireBrut().filter((x) => x.id !== id));
  try {
    const s = JSON.parse(localStorage.getItem('semaine') ?? '[]');
    localStorage.setItem('semaine', JSON.stringify(s.filter((x: string) => x !== `perso:${id}`)));
  } catch {}
}

export const nouvelId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function slugifier(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'ingredient';
}

// ---------- Partage par lien ----------

function enBase64Url(txt: string) {
  const bytes = new TextEncoder().encode(txt);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function deBase64Url(b64: string) {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function lienPartage(r: RecettePerso) {
  const { id, cree_le, ...reste } = r;
  return `${location.origin}${B}/ma-recette/#partage=${enBase64Url(JSON.stringify(reste))}`;
}

export function lireLienPartage(hash: string): RecettePerso | null {
  const m = hash.match(/partage=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    return nettoyer({ ...JSON.parse(deBase64Url(m[1])), id: nouvelId(), cree_le: new Date().toISOString() });
  } catch { return null; }
}

// ---------- Validation (données venant du stockage ou d'un lien : on ne fait confiance à rien) ----------

const txt = (v: unknown, max = 500) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
const UNITES = ['g', 'ml', 'piece', null];
const ANIMAUX = [null, 'viande', 'poisson', 'laitier', 'oeuf', 'miel'];

function ligne(v: any): LigneRecette | null {
  if (!v || typeof v.ref !== 'string') return null;
  return { ref: v.ref.slice(0, 80), qte: num(v.qte, 0, 100000), unite: UNITES.includes(v.unite) ? v.unite : null };
}

function nettoyer(v: any): RecettePerso | null {
  if (!v || typeof v !== 'object' || !txt(v.titre)) return null;
  const ingsPerso: Record<string, Ingredient> = {};
  for (const [k, i] of Object.entries<any>(v.ingredients_perso ?? {})) {
    if (!k.startsWith('perso-') || !txt(i?.nom)) continue;
    ingsPerso[k.slice(0, 80)] = {
      nom: txt(i.nom, 80), rayon: 'perso', unite_prix: 'kg', poids_piece_g: null,
      animal: ANIMAUX.includes(i.animal) ? i.animal : null, gluten: i.gluten === true,
      proteines_100g: null, placard: i.placard === true, rayon_magasin: txt(i.rayon_magasin, 40) || 'autres', perso: true,
    };
  }
  return {
    id: txt(v.id, 40) || nouvelId(),
    perso: true,
    numero: 0,
    slug: txt(v.slug, 80) || 'ma-recette',
    titre: txt(v.titre, 120),
    chapeau: txt(v.chapeau, 300),
    portions: num(v.portions, 1, 50) ?? 4,
    prep_min: num(v.prep_min, 0, 1440) ?? 0,
    cuisson_min: num(v.cuisson_min, 0, 1440) ?? 0,
    ingredients: (Array.isArray(v.ingredients) ? v.ingredients : []).map(ligne).filter(Boolean).slice(0, 60) as LigneRecette[],
    etapes: (Array.isArray(v.etapes) ? v.etapes : []).map((e: unknown) => txt(e, 1000)).filter(Boolean).slice(0, 40),
    variantes: [],
    note: txt(v.note, 300) || null,
    source: { type: 'perso' },
    statut: 'testee',
    ingredients_perso: ingsPerso,
    cree_le: txt(v.cree_le, 40) || new Date().toISOString(),
  };
}

export { REGIMES };
