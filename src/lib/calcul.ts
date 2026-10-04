// Calcul des tickets, utilisable au build ET dans le navigateur (recettes perso).
// Règle : aucun chiffre inventé. Un prix absent reste absent, et le total le dit.

export const NIVEAUX = ['premier', 'moyen', 'qualite'] as const;
export type Niveau = (typeof NIVEAUX)[number];
export const LIBELLE_NIVEAU: Record<Niveau, string> = {
  premier: 'Premier prix',
  moyen: 'Moyen',
  qualite: 'Bio',
};

export const REGIMES = ['vegetarien', 'vegan', 'proteines', 'sans-gluten'] as const;
export type Regime = (typeof REGIMES)[number];
export const LIBELLE_REGIME: Record<Regime, string> = {
  vegetarien: 'Végétarien',
  vegan: 'Vegan',
  proteines: 'Riche en protéines',
  'sans-gluten': 'Sans gluten',
};
// Ordre de priorité pour la règle des 2 points : vegan rend végétarien redondant.
const PRIORITE_POINTS: Regime[] = ['vegan', 'vegetarien', 'proteines', 'sans-gluten'];

type Unite = 'g' | 'ml' | 'piece' | null;

export interface Ingredient {
  nom: string;
  rayon: string;
  unite_prix: 'kg' | 'l' | 'piece';
  poids_piece_g?: number | null;
  animal: null | 'viande' | 'poisson' | 'laitier' | 'oeuf' | 'miel';
  gluten: boolean;
  proteines_100g?: number | null;
  placard?: boolean;
  prix_source?: string | null;
  rayon_magasin?: string;
  perso?: boolean;
}

export interface LigneRecette { ref: string; qte: number | null; unite: Unite }

export interface Variante {
  titre: string;
  regime?: Regime | null;
  remplace?: { de: string; par: LigneRecette }[];
  ajoute?: LigneRecette[];
  retire?: string[];
}

export interface Recette {
  numero: number;
  slug: string;
  titre: string;
  chapeau?: string;
  portions: number;
  prep_min: number;
  cuisson_min?: number;
  ingredients: LigneRecette[];
  etapes: string[];
  variantes?: Variante[];
  note?: string | null;
  source?: { type: string; id?: string; url?: string };
  statut: 'non-testee' | 'testee';
}

export interface Prix {
  unite: 'kg' | 'l' | 'piece';
  premier: number | null;
  moyen: number | null;
  qualite: number | null;
  source: string;
  detail?: string;
  periode?: string;
  url?: string;
  observations?: number | Record<string, number> | null;
}

import ingredientsJson from '../../data/ingredients.json';
import prixJson from '../../data/prix.json';
import rayonsJson from '../../data/rayons.json';

// Dictionnaire mutable : les ingrédients créés par l'utilisateur (recettes perso) s'y ajoutent côté navigateur.
export const ingredients: Record<string, Ingredient> = { ...(ingredientsJson as unknown as Record<string, Ingredient>) };
export const prix: Record<string, Prix> = (prixJson as unknown as { items: Record<string, Prix> }).items;
export const prixGenereLe: string = (prixJson as { genere_le: string }).genere_le;

export function enregistrerIngredients(extra: Record<string, Ingredient>) {
  Object.assign(ingredients, extra);
}

// ---------- Rayons de supermarché ----------
export const RAYONS: { id: string; nom: string }[] = rayonsJson.ordre;
const rayonParIngredient = rayonsJson.ingredients as Record<string, string>;
export function rayonDe(ref: string): string {
  return rayonParIngredient[ref] ?? ingredients[ref]?.rayon_magasin ?? 'autres';
}

// ---------- Régimes (calculés, jamais déclarés) ----------

export function regimesDe(lignes: LigneRecette[], portions: number): Regime[] {
  const ings = lignes.map((l) => ingredients[l.ref]).filter(Boolean);
  const out: Regime[] = [];
  if (ings.every((i) => i.animal !== 'viande' && i.animal !== 'poisson')) out.push('vegetarien');
  if (ings.every((i) => !i.animal)) out.push('vegan');
  const p = proteinesParPortion(lignes, portions);
  if (p !== null && p >= 20) out.push('proteines');
  if (ings.every((i) => !i.gluten)) out.push('sans-gluten');
  return out;
}

export function proteinesParPortion(lignes: LigneRecette[], portions: number): number | null {
  let total = 0;
  for (const l of lignes) {
    const ing = ingredients[l.ref];
    if (!ing || ing.placard || l.qte === null) continue;
    if (ing.proteines_100g == null) return null;
    const g = grammes(l, ing);
    if (g === null) return null;
    total += (g * ing.proteines_100g) / 100;
  }
  return total / portions;
}

/** Points de couleur à afficher : 2 au maximum (règle du brief), dans l'ordre de priorité. */
export function pointsVisibles(regimes: Regime[]): Regime[] {
  const tri = PRIORITE_POINTS.filter((r) => regimes.includes(r));
  const sansRedondance = tri.includes('vegan') ? tri.filter((r) => r !== 'vegetarien') : tri;
  return sansRedondance.slice(0, 2);
}

// ---------- Quantités et prix ----------

function grammes(l: LigneRecette, ing: Ingredient): number | null {
  if (l.qte === null) return null;
  if (l.unite === 'g' || l.unite === 'ml') return l.qte; // densité 1 pour les liquides : assumé
  if (l.unite === 'piece') return ing.poids_piece_g ? l.qte * ing.poids_piece_g : null;
  return null;
}

/** Quantité exprimée dans l'unité de prix de l'ingrédient (kg, l ou pièce). */
function quantiteEnUnitePrix(l: LigneRecette, ing: Ingredient, unitePrix: Prix['unite']): number | null {
  if (l.qte === null) return null;
  if (unitePrix === 'piece') {
    if (l.unite === 'piece') return l.qte;
    return ing.poids_piece_g ? l.qte / ing.poids_piece_g : null;
  }
  const g = grammes(l, ing);
  return g === null ? null : g / 1000;
}

export type Montants = Record<Niveau, number | null>;

export interface LigneTicket {
  ref: string;
  nom: string;
  quantite: string;
  montants: Montants;
  prix?: Prix;
}

export interface Ticket {
  lignes: LigneTicket[];
  placard: string[];
  total: Montants;
  manquants: Record<Niveau, number>;
  parPersonne: Montants;
  sources: { source: string; periode?: string; url?: string }[];
  couverture: number; // part des lignes chiffrées au niveau moyen, 0..1
}

export function libelleQuantite(l: LigneRecette): string {
  if (l.qte === null) return '';
  const n = Number.isInteger(l.qte) ? String(l.qte) : String(l.qte).replace('.', ',');
  if (l.unite === 'piece') return n;
  if (l.unite === 'g' && l.qte >= 1000) return `${String(l.qte / 1000).replace('.', ',')} KG`;
  if (l.unite === 'ml' && l.qte >= 1000) return `${String(l.qte / 1000).replace('.', ',')} L`;
  return `${n} ${l.unite === 'ml' ? 'ML' : 'G'}`;
}

export function calculerTicket(lignesRecette: LigneRecette[], portions: number): Ticket {
  const lignes: LigneTicket[] = [];
  const placard: string[] = [];
  const total: Montants = { premier: 0, moyen: 0, qualite: 0 };
  const manquants: Record<Niveau, number> = { premier: 0, moyen: 0, qualite: 0 };
  const sources = new Map<string, { source: string; periode?: string; url?: string }>();

  for (const l of lignesRecette) {
    const ing = ingredients[l.ref];
    const nom = ing?.nom ?? l.ref;
    if (!ing || ing.placard || l.qte === null) {
      placard.push(nom.toLowerCase());
      continue;
    }
    const p = prix[l.ref];
    const montants: Montants = { premier: null, moyen: null, qualite: null };
    if (p) {
      const q = quantiteEnUnitePrix(l, ing, p.unite);
      for (const n of NIVEAUX) {
        const v = p[n];
        if (q !== null && v != null) montants[n] = q * v;
      }
      const cle = `${p.source}|${p.periode ?? ''}`;
      if (!sources.has(cle)) sources.set(cle, { source: p.source, periode: p.periode, url: p.url });
    }
    for (const n of NIVEAUX) {
      if (montants[n] === null) manquants[n] += 1;
      else total[n] = (total[n] as number) + (montants[n] as number);
    }
    lignes.push({ ref: l.ref, nom, quantite: libelleQuantite(l), montants, prix: p });
  }

  for (const n of NIVEAUX) if (lignes.length && manquants[n] === lignes.length) total[n] = null;
  const parPersonne: Montants = { premier: null, moyen: null, qualite: null };
  for (const n of NIVEAUX) if (total[n] !== null) parPersonne[n] = (total[n] as number) / portions;
  const chiffrees = lignes.filter((x) => x.montants.moyen !== null).length;

  return {
    lignes, placard, total, manquants, parPersonne,
    sources: [...sources.values()],
    couverture: lignes.length ? chiffrees / lignes.length : 0,
  };
}

/** Applique une variante et renvoie les nouvelles lignes. */
export function appliquerVariante(lignes: LigneRecette[], v: Variante): LigneRecette[] {
  const retires = new Set([...(v.retire ?? []), ...(v.remplace ?? []).map((r) => r.de)]);
  const out = lignes.filter((l) => !retires.has(l.ref));
  for (const r of v.remplace ?? []) out.push(r.par);
  for (const a of v.ajoute ?? []) out.push(a);
  return out;
}

/** Écart de prix d'une variante, niveau par niveau, calculé sur les seules lignes changées
 *  (ajoutées − retirées). null si l'une de ces lignes n'a pas de prix à ce niveau. */
export function ecartVariante(r: Recette, v: Variante): Montants {
  const retires = new Set([...(v.retire ?? []), ...(v.remplace ?? []).map((x) => x.de)]);
  const moins = calculerTicket(r.ingredients.filter((l) => retires.has(l.ref)), r.portions);
  const plus = calculerTicket([...(v.remplace ?? []).map((x) => x.par), ...(v.ajoute ?? [])], r.portions);
  const out: Montants = { premier: null, moyen: null, qualite: null };
  for (const n of NIVEAUX) {
    if (moins.manquants[n] || plus.manquants[n]) continue;
    out[n] = ((plus.total[n] ?? 0) as number) - ((moins.total[n] ?? 0) as number);
  }
  return out;
}

// ---------- Mise en forme ----------

const fmt = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const euros = (v: number | null) => (v === null ? '—' : fmt.format(v));
export const eurosSigne = (v: number | null) =>
  v === null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmt.format(Math.abs(v))} €`;
export const numero = (n: number) => `N° ${String(n).padStart(4, '0')}`;
