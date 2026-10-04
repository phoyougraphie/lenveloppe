# L’enveloppe

Des idées pour manger varié, avec les prix moyens en France : publics quand ils existent, collaboratifs sinon, toujours sourcés. Projet perso, pour l’entourage. Gratuit, sans tracker.

Site : https://phoyougraphie.github.io/lenveloppe/

## Lancer en local

```bash
npm install
npm run dev
```

## Comment ça marche

- `data/recettes/` : une recette par fichier JSON (format : `docs/schema.md`).
- `data/ingredients.json` : les ingrédients. Les régimes (végétarien, vegan, riche en protéines, sans gluten) sont **calculés** à partir d’eux.
- `data/rayons.json` : rayon de supermarché de chaque ingrédient, pour trier la liste de courses.
- `data/prix.json` : généré par `npm run prix` (RNM – FranceAgriMer, puis Open Prices), chaque lundi par GitHub Actions.
- Les recettes ajoutées depuis le site (« + Ma recette ») restent dans le navigateur de chaque personne ; elles se partagent par lien.

`npm run valider` vérifie les recettes ; `npm run build` produit le site statique dans `dist/`.

## Sources et licences des données

- Prix RNM – FranceAgriMer : Licence Ouverte, source citée sur chaque ticket.
- Prix Open Prices (Open Food Facts) : base sous licence ODbL, données collaboratives.
- Protéines : table Ciqual (ANSES).
- Idées de recettes adaptées de TheMealDB (https://www.themealdb.com).
