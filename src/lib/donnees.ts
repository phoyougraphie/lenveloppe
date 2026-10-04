// Données du carnet, lues au build. Le calcul est dans calcul.ts (partagé avec le navigateur).
export * from './calcul';
import type { Recette } from './calcul';

const fichiersRecettes = import.meta.glob<{ default: Recette }>('/data/recettes/*.json', { eager: true });
export const recettes: Recette[] = Object.values(fichiersRecettes)
  .map((m) => m.default)
  .sort((a, b) => a.numero - b.numero);
