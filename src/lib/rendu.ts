import { B } from './lien';
// Rendu HTML côté navigateur, pour les recettes perso. Reprend le balisage de Ticket.astro.
import {
  calculerTicket, regimesDe, pointsVisibles, euros, NIVEAUX, LIBELLE_NIVEAU, LIBELLE_REGIME, REGIMES,
  type Montants, type Recette, type Regime,
} from './calcul';

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function montantsHtml(m: Montants, suffixe = '', prefixe: Partial<Record<string, string>> = {}) {
  return `<span class="val">${NIVEAUX.map((n, i) =>
    `${i ? '<span class="sep" aria-hidden="true"> / </span>' : ''}<span class="n n-${n}"><span class="vh">${LIBELLE_NIVEAU[n]} : </span>${
      m[n] === null ? '—' : `${prefixe[n] ?? ''}${euros(m[n])}${suffixe}`}</span>`).join('')}</span>`;
}

function regimesHtml(regimes: Regime[]) {
  const avecPoint = pointsVisibles(regimes);
  const affiches = regimes.includes('vegan') ? regimes.filter((r) => r !== 'vegetarien') : regimes;
  if (!affiches.length) return '';
  return `<p class="regimes">${affiches.map((r) =>
    `<span>${avecPoint.includes(r) ? `<span class="point ${r}" aria-hidden="true"></span>` : ''}${r === 'vegan' ? 'Vegan (donc végétarien)' : LIBELLE_REGIME[r]}</span>`).join('')}</p>`;
}

export function ticketHtml(r: Recette, enTete = 'Gardée sur cet appareil') {
  const t = calculerTicket(r.ingredients, r.portions);
  const regimes = regimesDe(r.ingredients, r.portions);
  const pre = Object.fromEntries(NIVEAUX.map((n) => [n, t.manquants[n] ? '≥ ' : '']));
  const minutes = r.prep_min + (r.cuisson_min ?? 0);
  return `<article class="ticket trois">
  <div class="ticket-tete"><span>Ma recette</span><span>${esc(enTete)}</span></div>
  <hr />
  <h1 class="titre-l" style="margin:.4rem 0 .6rem">${esc(r.titre)}</h1>
  ${r.chapeau ? `<p style="margin:0 0 .8rem;max-width:30rem">${esc(r.chapeau)}</p>` : ''}
  ${regimesHtml(regimes)}
  <div class="ticket-tete" style="margin-top:.6rem"><span>Pour ${r.portions}</span><span>${minutes} min${r.cuisson_min ? ` dont ${r.prep_min} de prépa` : ''}</span></div>
  <hr />
  <div class="ligne petit" aria-hidden="true"><span></span><span class="val">${NIVEAUX.map((n, i) =>
    `${i ? '<span class="sep"> / </span>' : ''}<span class="n n-${n}">${n === 'premier' ? '1er prix' : LIBELLE_NIVEAU[n]}</span>`).join('')}</span></div>
  ${t.lignes.map((l) => `<div class="ligne"><span class="lib"><span>${esc(l.nom)} ${esc(l.quantite)}</span></span>${montantsHtml(l.montants)}</div>`).join('')}
  ${t.placard.length ? `<p class="petit" style="margin:.5rem 0 0">Hors ticket (placard) : ${esc(t.placard.join(', '))}</p>` : ''}
  <hr />
  <div class="ligne total"><span class="lib"><span>Total pour ${r.portions}</span></span>${montantsHtml(t.total, ' €', pre)}</div>
  <div class="ligne"><span class="lib"><span>Soit par personne</span></span>${montantsHtml(t.parPersonne, ' €', pre)}</div>
  <hr />
  ${NIVEAUX.some((n) => t.manquants[n]) ? '<p class="petit" style="margin:0 0 .4rem">— = prix non suivi (ingrédient ajouté par toi, ou sans source publique). ≥ = total sans ces lignes.</p>' : ''}
  ${t.sources.map((s) => `<p class="petit" style="margin:0">Source : ${esc(s.source)}${s.periode ? ` · ${esc(s.periode)}` : ''}</p>`).join('')}
</article>`;
}

/** Données de filtrage d'une recette, identiques à celles des cartes du carnet. */
export function infosCarte(r: Recette) {
  const t = calculerTicket(r.ingredients, r.portions);
  const parPersonne = { ...t.parPersonne };
  for (const n of NIVEAUX) if (t.manquants[n] > t.lignes.length / 4) parPersonne[n] = null;
  const pre = Object.fromEntries(NIVEAUX.map((n) => [n, t.manquants[n] ? '≥ ' : '']));
  return { regimes: regimesDe(r.ingredients, r.portions), parPersonne, pre, minutes: r.prep_min + (r.cuisson_min ?? 0) };
}

export function carteHtml(r: Recette & { id: string }) {
  const { regimes, parPersonne, pre, minutes } = infosCarte(r);
  return `<li class="carte" data-perso="1" data-regimes="${regimes.join(' ')}" data-variantes="" data-minutes="${minutes}"
    data-premier="${parPersonne.premier ?? ''}" data-moyen="${parPersonne.moyen ?? ''}" data-qualite="${parPersonne.qualite ?? ''}">
    <a href="${B}/ma-recette/?id=${encodeURIComponent(r.id)}">
      <span class="ticket-tete"><span>Ma recette</span><span>${minutes} min</span></span>
      <span class="titre-m carte-titre">${esc(r.titre)}</span>
      <span class="carte-regimes">${REGIMES.filter((g) => regimes.includes(g)).map((g) =>
        `<span data-g="${g}"><span class="point ${g}" aria-hidden="true"></span>${LIBELLE_REGIME[g]}</span>`).join('')}</span>
      <span class="ligne"><span class="lib"><span>Par personne</span></span>${montantsHtml(parPersonne, ' €', pre)}</span>
      ${NIVEAUX.some((n) => parPersonne[n] === null) ? '<span class="petit">— = prix incomplet, détail sur la fiche</span>' : ''}
    </a>
  </li>`;
}
