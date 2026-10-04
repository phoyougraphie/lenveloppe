# D'où viennent nos prix : Open Prices

Pour les fruits et légumes frais, nos prix viennent du Réseau des nouvelles des marchés (RNM, FranceAgriMer). Le RNM ne suit pas l'épicerie (pâtes, riz, légumes secs, conserves, huiles, sucre), ni une bonne partie des produits laitiers, de la viande et des surgelés. Pour ces produits, on utilise **Open Prices**.

## Open Prices, c'est quoi ?

[Open Prices](https://prices.openfoodfacts.org) est une base de prix ouverte, lancée par l'association **Open Food Facts**, celle qui fait la base de données des produits alimentaires. N'importe qui peut la consulter et la réutiliser (licence ODbL).

**Qui saisit les prix ?** Des bénévoles. Ils photographient une étiquette en rayon ou un ticket de caisse, puis enregistrent le prix, le magasin et la date. Pour un produit emballé, ils scannent le code-barres. Pour un produit vendu au poids sans code-barres (vrac, fruits et légumes), ils choisissent une catégorie.

**Ce que ça veut dire pour vous.** Ce sont des **données collaboratives**. Ce n'est pas un relevé statistique officiel. Elles reflètent les magasins et les produits que les contributeurs ont eu envie ou l'occasion de relever. Sur le site, on les signale toujours par la mention « Open Prices – Open Food Facts (données collaboratives) ».

## Comment on calcule un prix

Pour chaque ingrédient (par exemple « lentilles corail »), on procède ainsi.

1. **On choisit les produits.** On s'appuie sur les catégories d'Open Food Facts (par exemple `en:red-lentils`). On écarte ce qui n'est pas l'ingrédient brut : plats préparés, conserves quand on cherche le produit sec, boissons, versions aromatisées. Quand les catégories ne suffisent pas, on filtre aussi sur le nom du produit (par exemple, on écarte « crème de coco » quand on cherche du lait de coco, ou le beurre demi-sel). La liste précise est publique, dans le fichier `data/sources/openprices-requetes.json`.
2. **On garde seulement la France.** Il faut un relevé en euros, dans un magasin physique situé en France. Les achats en ligne sont écartés, parce qu'on ne peut pas vérifier le pays.
3. **On écarte les promotions.** Si le relevé est une promo et que le prix normal est connu, on garde le prix normal. S'il n'est pas connu, on n'utilise pas le relevé. Les doublons sont écartés aussi : ceux signalés dans Open Prices, et les relevés identiques (même produit, même magasin, même jour, même prix) saisis par deux personnes.
4. **On ramène tout au kilo (ou au litre).** Le plus souvent, le prix relevé est celui d'un paquet. On le divise par le poids net indiqué sur la fiche Open Food Facts du produit (par exemple 2,53 € pour 500 g donne 5,06 €/kg). Si le poids est inconnu, on n'utilise pas le relevé. Pour quelques liquides déclarés en grammes (ou l'inverse), on convertit avec une densité indiquée dans la configuration (huile, sauce soja, crème).
5. **Un produit ne fait pas la loi à lui seul.** Certains produits sont relevés chaque semaine par le même contributeur. Pour qu'ils ne décident pas seuls du résultat, on garde au plus **3 relevés par produit** (les plus récents) dans chaque calcul.
6. **On écarte les valeurs aberrantes.** Un prix au kilo plus de 4 fois supérieur ou inférieur à la médiane de l'ingrédient vient presque toujours d'une erreur de poids ou de saisie. On ne le garde pas.

## Les trois niveaux

On sépare d'abord les produits **bio** des autres. Un produit compte comme bio s'il porte le label bio européen ou le label AB dans Open Food Facts.

| Niveau | Ce qu'on calcule | En clair |
|---|---|---|
| `moyen` | **Médiane** des prix non bio | Le prix « du milieu » : la moitié des relevés coûtent moins, l'autre moitié plus. |
| `premier` | **1er quartile** des prix non bio | Le prix en dessous duquel se trouvent les 25 % de relevés les moins chers. C'est le bas du rayon : marques premier prix et marques de distributeur. |
| `qualite` | **Médiane** des prix bio | Le prix du milieu chez les produits bio. |

On utilise la médiane plutôt que la moyenne, parce qu'un relevé très cher ou très bon marché la fait à peine bouger.

**Pourquoi pas les prix des enseignes discount pour `premier` ?** On a essayé de prendre la médiane des relevés faits chez Lidl, Aldi, Netto ou Leader Price. Mais ces enseignes sont très peu présentes dans Open Prices : pour presque tous les ingrédients, il y avait moins de 5 relevés. Le 1er quartile de tous les prix non bio, quel que soit le magasin, est plus stable. Il reflète aussi les gammes premier prix que vendent les supermarchés classiques. Le script continue de calculer la médiane en hard-discount, pour contrôle, mais on ne la publie pas.

## Période et seuils

- **Période :** les **12 derniers mois**. Si un niveau a moins de relevés que le seuil sur 12 mois, on élargit à **24 mois** pour ce niveau seulement, et on l'indique dans le texte de la source (« fenêtre élargie à 24 mois pour… »).
- **Seuil :** il faut au moins **5 relevés** pour publier `moyen` ou `qualite`, et au moins **8 relevés** pour `premier` (un quartile calculé sur moins de 8 valeurs ne veut pas dire grand-chose). En dessous du seuil, le niveau reste vide et le site affiche « prix non suivi ». **On n'invente jamais un prix.**
- Pour chaque prix, on publie le **nombre de relevés** utilisés, la période et un lien vers la requête Open Prices correspondante. Tout le monde peut vérifier.

## Les limites, honnêtement

- **Peu de relevés.** Pour beaucoup d'ingrédients, on a quelques dizaines de relevés par an, parfois moins. Un prix calculé sur 6 relevés est une indication, pas une mesure précise.
- **Une France inégalement couverte.** Certains contributeurs, villes ou enseignes pèsent beaucoup dans les données. Les prix peuvent donc pencher vers les magasins les plus relevés, souvent de grands hypermarchés.
- **Le hard-discount est sous-représenté.** C'est pour ça que `premier` est un quartile et non un prix « discount ».
- **Le poids des conserves n'est pas toujours le même.** Pour les conserves et les bocaux (pois chiches, haricots, maïs, thon, olives…), on divise par le poids inscrit sur la fiche Open Food Facts. Selon les contributeurs, ce poids est soit le **poids net total** de la boîte (liquide compris, par exemple 400 g), soit le **poids net égoutté** (par exemple 240 g). Nos prix au kilo de conserves mélangent donc les deux. On ne corrige pas par une estimation. Résultat : si la recette compte en poids égoutté, le vrai coût peut être un peu plus élevé que notre chiffre.
- **Les catégories peuvent se tromper.** Elles sont renseignées par des bénévoles. Un produit mal classé peut se glisser dans un calcul, ou en manquer. Nos filtres limitent ce risque sans le supprimer.
- **Les produits à la pièce.** Pour la baguette, les tortillas, les bottes d'herbes ou le chou, on calcule un prix au kilo à partir du poids indiqué sur l'emballage. Le site le convertit ensuite en prix par pièce avec un poids moyen. Les relevés en vrac « à l'unité » sans poids sont écartés.
- **Le bio paraît parfois moins cher.** Pour quelques produits (riz, boulgour, boisson soja, crème fraîche), la médiane bio est plus basse que la médiane non bio. Ce n'est pas une erreur de calcul. Les produits bio relevés sont souvent vendus en vrac ou en grand format, donc moins chers au kilo, alors que les produits non bio relevés sont souvent en petit format. On publie le chiffre tel quel.
- **Les herbes fraîches et le chou entier sont mal couverts.** En vrac, ils sont surtout relevés « à la botte » ou « à la pièce », sans poids. Avec les paquets, on tombe souvent sur des herbes séchées. Faute de relevés fiables, ces prix restent vides pour l'instant.
- **Les prix bougent.** Une médiane sur 12 mois (parfois 24) lisse les hausses récentes. Le prix du jour en magasin peut être différent.

## Pour aller plus loin

- Open Prices : https://prices.openfoodfacts.org
- Documentation de l'API : https://prices.openfoodfacts.org/api/docs
- Open Food Facts : https://world.openfoodfacts.org
- Notre script : `scripts/openprices.mjs`. Notre configuration : `data/sources/openprices-requetes.json`.

Vous faites vos courses ? Vous pouvez vous aussi ajouter des prix dans Open Prices, et améliorer nos chiffres du même coup.
