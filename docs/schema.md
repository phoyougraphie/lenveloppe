# L'enveloppe — contrat de données

Tout le site est statique : il lit des fichiers JSON dans `data/`. Les scripts dans `scripts/` les produisent. Règle absolue du brief : **zéro chiffre sans source, jamais de faux prix**. Si on ne sait pas, on écrit `null` et le site affiche « prix non suivi ».

Les trois niveaux de prix s'appellent partout `premier` (premier prix / hard-discount), `moyen` (grande surface, conventionnel), `qualite` (bio).

## `data/ingredients.json`

Liste canonique des ingrédients. Clé = identifiant en kebab-case français, singulier, sans accents (`carotte`, `lentille-corail`, `pois-chiche-sec`, `tofu-nature`).

```json
{
  "carotte": {
    "nom": "Carottes",                 // libellé affiché sur le ticket, en majuscules côté UI
    "rayon": "frais" | "sec" | "cremerie" | "boucherie" | "poissonnerie" | "placard",
    "unite_prix": "kg" | "l" | "piece", // unité dans laquelle on exprime le prix
    "poids_piece_g": 120,              // obligatoire si une recette l'utilise à la pièce (sert à convertir)
    "animal": null | "viande" | "poisson" | "laitier" | "oeuf" | "miel",
    "gluten": false,
    "proteines_100g": 0.6,             // source Ciqual (ANSES) ; null si inconnu
    "ciqual_code": "20009",            // code aliment Ciqual si renseigné
    "placard": false,                  // true = sel, poivre, épices, huile en petite quantité : exclus du total, mentionnés « hors placard »
  }
}
```

Les champs `prix_source`, `rnm_produit`, `openprices_requete` ne sont pas utilisés : la correspondance avec les sources vit à part.

## Correspondance ingrédient → source

- `data/sources/correspondances.json` : ingrédient → produit RNM (libellé exact du catalogue). Prioritaire.
- `data/sources/openprices-requetes.json` : requêtes Open Prices par ingrédient. Utilisé pour tout ingrédient absent du fichier précédent.
- `scripts/assembler-prix.mjs` fusionne les deux dans `data/prix.json` et affiche la couverture.

Chaîne complète : `npm run prix` (RNM, Open Prices ~30–40 min sans cache, assemblage), puis `npm run valider`, puis `npm run build`.

## `data/recettes/<slug>.json`

Une recette par fichier.

```json
{
  "numero": 1,                         // « N° 0001 » sur le ticket
  "slug": "dal-de-lentilles-corail",
  "titre": "Dal de lentilles corail",
  "chapeau": "Une phrase, ton voisin qui cuisine et compte.",
  "portions": 4,
  "prep_min": 15,
  "cuisson_min": 25,
  "ingredients": [
    { "ref": "lentille-corail", "qte": 300, "unite": "g" },
    { "ref": "oignon", "qte": 1, "unite": "piece" },
    { "ref": "lait-coco", "qte": 400, "unite": "ml" },
    { "ref": "sel", "qte": null, "unite": null }
  ],
  "etapes": ["Phrase courte à l'impératif.", "..."],
  "variantes": [
    {
      "titre": "Version vegan",
      "regime": "vegan",
      "remplace": [ { "de": "beurre", "par": { "ref": "huile-colza", "qte": 20, "unite": "g" } } ],
      "ajoute": [],
      "retire": []
    }
  ],
  "note": "Ça tient 2 jours au frigo.",    // annotation « manuscrite », facultative
  "source": { "type": "themealdb", "id": "52785", "url": "https://www.themealdb.com/meal/52785" },
  "statut": "non-testee" | "testee"
}
```

Unités autorisées dans les recettes : `g`, `ml`, `piece`, ou `null` (pour « une pincée »). Pas de cuillères ni de tasses : on convertit.

**Les régimes ne sont pas déclarés, ils sont calculés** à partir des ingrédients :
- `vegetarien` : aucun ingrédient `animal` ∈ {viande, poisson}
- `vegan` : aucun ingrédient `animal` non nul
- `sans-gluten` : aucun ingrédient `gluten: true`
- `proteines` : ≥ 20 g de protéines par portion (Ciqual), tous ingrédients non placard renseignés

## `data/prix.json` (généré, ne pas éditer à la main)

```json
{
  "genere_le": "2026-10-03",
  "items": {
    "carotte": {
      "unite": "kg",
      "premier": 0.98, "moyen": 1.35, "qualite": 2.40,   // € par unite, null si absent
      "source": "RNM – FranceAgriMer",
      "detail": "Prix détail, GMS / hard-discount / bio",
      "periode": "semaine 39 – 2026",
      "url": "https://rnm.franceagrimer.fr/...",
      "observations": null                                // nombre de relevés (Open Prices)
    }
  }
}
```

## Couleurs des régimes (règle des points)

| Régime | Point |
|---|---|
| végétarien | vert |
| vegan | orange |
| riche en protéines | rouge |
| sans gluten | bleu |
