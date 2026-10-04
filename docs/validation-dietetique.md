# Validation diététique des recettes

Ce document accompagne `scripts/valider-recettes.mjs`. Il décrit ce que le script vérifie, ce que les chiffres veulent dire et ce qu'ils ne disent pas, et liste ce qu'un·e diététicien·ne diplômé·e doit relire avant de présenter le carnet comme validé. **Aucune recette n'a encore été validée par un·e professionnel·le** : toutes sont en `statut: "non-testee"`.

```
node scripts/valider-recettes.mjs            # contrôle + récapitulatif par régime
node scripts/valider-recettes.mjs --detail   # + détail recette par recette (régimes, protéines par portion)
```

Le script sort avec le code 1 s'il trouve une erreur : ref inconnue, unité hors `g`/`ml`/`piece`/`null`, pièce sans `poids_piece_g`, numéro en double, champ manquant, ou **variante qui n'atteint pas le régime qu'elle annonce** (par exemple une « version vegan » qui garderait du beurre).

## 1. Méthode et sources

- **Protéines** : table **Ciqual 2020 (ANSES)**, téléchargée depuis ciqual.anses.fr (fichiers XML du 07/07/2020). On utilise le constituant 25000 « Protéines, N × facteur de Jones (g/100 g) ». Chaque ingrédient porte son `ciqual_code`, et la valeur a été lue dans la table, pas recopiée à la main.
- Valeurs Ciqual « < x » ou « traces » : on les **met à 0**. C'est volontairement prudent : on préfère sous-estimer les protéines que les surestimer (concerne le citron et les huiles).
- Pas de code Ciqual exact pour le **bouillon cube de légumes** (seulement « reconstitué ») ni pour le **piment en poudre** : `ciqual_code` et `proteines_100g` sont à `null`. Les deux sont « placard », donc exclus du calcul.
- Les quantités en **ml** sont converties en grammes avec une densité de 1. Pour le lait, la boisson soja et le lait de coco, l'écart est négligeable. Les huiles sont « placard » et ne comptent pas.
- **Régimes** : calculés par le script selon `docs/schema.md`, jamais déclarés à la main. Une recette compte pour un régime si sa version de base le respecte **ou** si l'une de ses variantes le respecte. Le script recalcule la liste d'ingrédients de chaque variante (remplace / retire / ajoute).
- **Riche en protéines** : au moins 20 g de protéines par portion, tous les ingrédients hors placard ayant une quantité et une valeur Ciqual.

### Biais connus du calcul (à corriger ou à assumer)

| Biais | Effet | Recettes concernées |
|---|---|---|
| `cuisse-poulet` : 250 g par pièce **os compris**, alors que la valeur Ciqual porte sur la viande avec la peau | protéines **surestimées** d'environ 25 à 30 % | 27, 29, 34 (elles restent toutes au-dessus de 35 g par portion) |
| `oeuf` : 60 g par pièce **coquille comprise** (environ 52 g mangeables) | surestimation d'environ 13 % sur la part qui vient de l'œuf | 3, 4, 17, 25, 30, 31 (variante) |
| Légumineuses et céréales sèches comptées **crues** | correct, puisque Ciqual donne aussi la valeur crue, à condition d'utiliser les bons codes (vérifié) | – |
| Cinq œufs comptés pour la carbonara alors que deux blancs ne sont pas utilisés | légère surestimation | 25 |

## 2. Récapitulatif

84 ingrédients distincts, tous utilisés : 20 « placard » (hors total) et 64 achetés (frais 23, sec 27, crèmerie 6, boucherie 6, poissonnerie 2).

| Régime | Recette de base | Base ou variante |
|---|---|---|
| végétarien | 23 | 40 |
| vegan | 13 | 36 |
| sans gluten | 26 | 38 |
| riche en protéines (≥ 20 g par portion) | 23 | 23 |

Légende des tableaux : VG végétarien, VE vegan, SG sans gluten, PR riche en protéines. Les protéines sont en g par portion (une recette fait 4 portions).

| N° | Recette | Base | Via variantes | Prot. base | Prot. variantes |
|---|---|---|---|---|---|
| 1 | Dal de lentilles corail | VG SG PR | VE | 28.2 | VE 28.1 |
| 2 | Ratatouille | VG VE SG | – | 4.8 | – |
| 3 | Chakchouka | VG SG | VE | 14.8 | VE 13.4 |
| 4 | Tortilla de pommes de terre | VG SG | – | 15.1 | – |
| 5 | Penne all'arrabbiata | VG VE | SG | 12.9 | SG 7.6 |
| 6 | Chili sin carne | VG VE SG | – | 18.7 | – |
| 7 | Falafels à la poêle | VG | VE SG | 17.7 | VE 15.8, SG 15.4 |
| 8 | Koshari | VG VE PR | SG | 29.3 | SG 27.3 |
| 9 | Curry de haricots rouges | VG VE SG | – | 16.3 | – |
| 10 | Soupe au pistou | VG SG | VE | 15.5 | VE 12.4 |
| 11 | Soupe de haricots blancs | VG VE SG PR | – | 21.9 | – |
| 12 | Velouté de carottes au cumin | VG VE SG | – | 1.8 | – |
| 13 | Poivrons farcis riz et haricots rouges | VG SG | VE | 19.3 | VE 12.3 |
| 14 | Fajitas aux pois chiches rôtis | VG | VE SG | 16.9 | VE 16.9, SG 14.4 |
| 15 | Bortsch aux haricots blancs | VG VE SG | – | 8.8 | – |
| 16 | Patatas bravas | VG VE SG | – | 6.6 | – |
| 17 | Œufs brouillés sautés à la tomate | VG SG | VE | 17.0 | VE 15.6 |
| 18 | Soupe à l'oignon gratinée | VG | VE SG | 14.4 | VE 5.9, SG 11.4 |
| 19 | Tofu sauté au brocoli et aux cacahuètes | VG VE PR | – | 27.3 | – |
| 20 | Hachis parmentier aux lentilles | VG PR | VE SG | 27.0 | VE 26.9, SG 27.0 |
| 21 | Lasagnes aux lentilles et épinards | VG VE PR | – | 35.4 | – |
| 22 | Velouté de courge au lait de coco | VG VE SG | – | 3.7 | – |
| 23 | Ragoût de pommes de terre à l'algéroise | VG VE SG | – | 9.6 | – |
| 24 | Spaghetti bolognaise | PR | VG VE SG | 40.2 | VE 25.1, SG 35.5 |
| 25 | Spaghetti carbonara | PR | VG SG | 29.7 | VG 25.1, SG 25.1 |
| 26 | Pâté chinois (hachis parmentier au maïs) | SG PR | VG VE | 31.9 | VE 21.6 |
| 27 | Poulet Marengo | SG PR | VG VE | 47.0 | VE 19.5 |
| 28 | Couscous express au poulet et pois chiches | PR | VG VE SG | 34.6 | VE 21.3, SG 32.2 |
| 29 | Poulet basquaise | SG PR | VG VE | 57.4 | VE 20.8 |
| 30 | Salade niçoise au thon | SG PR | VG | 30.9 | VG 16.2 |
| 31 | Parmentier de poisson | PR | SG VG | 44.6 | SG 44.0, VG 26.4 |
| 32 | Saumon au four, fenouil et tomates | SG PR | VG VE | 31.4 | VE 17.9 |
| 33 | Pois chiches au chorizo et aux épinards | SG PR | VG VE | 23.4 | VE 15.6 |
| 34 | Poulet à la moutarde | SG PR | VG VE | 50.5 | VE 19.5 |
| 35 | Riz sauté au poulet | PR | VG VE SG | 37.2 | VE 21.5, SG 37.2 |
| 36 | Curry de poulet au lait de coco | SG PR | VG VE | 35.0 | VE 22.1 |
| 37 | Purée au chou et saucisses | SG PR | VG VE | 27.9 | VG 19.7, VE 19.9 |
| 38 | Chou poêlé au bœuf haché | SG PR | VG VE | 27.5 | VE 20.4 |
| 39 | Spaghetti aux sardines à la tomate | PR | VG VE SG | 25.6 | VE 16.0, SG 20.9 |
| 40 | Soupe de pois cassés aux lardons | SG PR | VG VE | 35.8 | VE 27.4 |

Le badge « protéines » s'applique à la recette de base. Dix variantes vegan dépassent aussi 20 g par portion (1, 20, 24, 26, 28, 29, 35, 36, 38, 40) ; le site pourrait l'afficher au niveau de la variante.

## 3. Grille de validation (à appliquer à chaque recette)

### 3.1 Portions
- [ ] La recette fait 4 portions adultes. Repères pour un plat principal, par personne : féculents 60 à 80 g crus, légumineuses 50 à 80 g sèches (ou 150 à 200 g en conserve égouttée), viande ou poisson 100 à 125 g, légumes au moins 200 g.
- [ ] Les quantités tiennent dans une cocotte ou une poêle ordinaire.
- [ ] Les soupes et veloutés (10, 12, 15, 22) sont présentés comme entrée ou dîner léger, ou suggèrent un complément (pain, fromage, légumineuses). Le velouté de carottes (1,8 g de protéines par portion) et le velouté de courge (3,7 g) ne suffisent pas comme plat unique.

### 3.2 Apports protéiques réalistes
- [ ] Seuil « riche en protéines » à 20 g par portion : à confirmer, ou à remplacer par un pourcentage de l'énergie (pas d'allégation réglementaire visée ici, c'est un repère d'usage).
- [ ] Variantes vegan : les protéines baissent souvent par rapport à la version viande (de 47 à 19,5 g pour le Marengo, de 50,5 à 19,5 g pour le poulet à la moutarde, de 31,4 à 17,9 g pour le saumon). Les quantités de légumineuses ont été relevées pour s'approcher de 20 g, mais une diététicienne doit valider qu'elles restent mangeables (720 g de pois chiches égouttés pour 4, soit trois boîtes).
- [ ] Complémentarité légumineuses et céréales dans les plats vegan : elle est présente dans la plupart (dal + riz, chili + riz, koshari, curry + riz, tofu + riz). Elle manque dans les soupes 11 et 15, à suggérer avec du pain.
- [ ] Les recettes 2, 12, 16, 22 et 23 sont des plats de légumes peu protéinés. Les notes de 12 et 16 suggèrent déjà un complément ; à étendre aux autres.

### 3.3 Vitamine B12 et nutriments à surveiller chez les vegans
- [ ] **B12** : aucune recette vegan n'en apporte. Le site doit afficher, au moins sur les fiches et sur le filtre « vegan », une mention du type : « Une alimentation vegan nécessite une supplémentation en vitamine B12. Parles-en à un professionnel de santé. » La formulation exacte est à valider par la diététicienne.
- [ ] **Calcium** : la boisson soja retenue est la version **enrichie en calcium** (Ciqual 18901). Il faut garder cette consigne sur la liste de courses.
- [ ] **Fer** : les plats vegan riches en fer non héminique (lentilles, pois chiches, épinards, tofu) gagnent à être associés à de la vitamine C (tomate, poivron, citron). C'est souvent le cas ; à signaler.
- [ ] **Iode** : le sel du placard est du sel iodé (Ciqual 11058). Le préciser sur le site.
- [ ] **Oméga-3** : les seules sources sont le saumon et les sardines. Pour les foyers vegan, suggérer l'huile de colza ou les noix ? (Ni l'une ni l'autre n'est dans le dictionnaire pour l'instant.)

### 3.4 Sel
Le sel ajouté « à goût » n'est pas quantifié (`qte: null`). Le script ne le calcule donc pas. Voici une estimation **indicative** du sel apporté par les ingrédients eux-mêmes, d'après le sodium Ciqual (sodium × 2,54), **hors sel ajouté et hors bouillon cube** :

| Sel par portion (estimation) | Recettes | Principales sources |
|---|---|---|
| plus de 2 g | 33 (2,7 g), 37 (2,5 g), 19 (2,3 g), 35 (2,2 g), 14 (2,0 g) | chorizo, saucisse, sauce soja, conserves, tortillas |
| 1,4 à 2 g | 29, 40, 25, 27, 6 | chorizo, lardons, olives, haricots en conserve |
| moins de 1,4 g | les autres | – |

- [ ] Repère : moins de 5 g de sel par jour pour un adulte (OMS) ; l'ANSES et Santé publique France recommandent de réduire. Un repas au-dessus de 2 g avant d'avoir ajouté du sel pèse lourd.
- [ ] Le **bouillon cube** est très salé (plusieurs grammes de sel par cube selon les étiquettes). Ciqual ne donne pas de valeur pour le cube sec, donc il n'est pas chiffré ici : à relever sur les étiquettes des produits premier prix. Recettes concernées : 10, 15, 17, 18 (2 cubes), 20, 21, 22, 24, 27, 28, 29, 34. À vérifier. Suggestion : écrire « goûte avant de saler » dans ces recettes, ou utiliser un demi-cube.
- [ ] La **sauce soja** (19, 20, 35) apporte environ 2,8 g de sel pour 15 ml (sodium Ciqual 7 440 mg/100 g). C'est la première source de sel de ces trois recettes.
- [ ] Rincer les conserves de légumineuses (déjà écrit pour les haricots rouges) réduit le sodium : à généraliser dans les étapes.
- [ ] **Charcuterie** (chorizo, lardons, saucisses) : le PNNS recommande de ne pas dépasser 150 g par semaine. Un planificateur de semaine ne devrait pas enchaîner 25, 29, 33, 37 et 40.

### 3.5 Sécurité et allergènes
- [ ] Haricots blancs secs (recette 11) : trempage puis ébullition franche, pas de cuisson à basse température. Les haricots rouges sont en conserve partout, ce qui évite le risque lié aux haricots rouges crus.
- [ ] Œufs peu cuits (carbonara, chakchouka, œufs brouillés) : mention à prévoir pour les femmes enceintes, les jeunes enfants et les personnes fragiles.
- [ ] Riz cuit la veille (35) : refroidir vite et garder au frigo (risque *Bacillus cereus*). L'étape dit « au frigo » ; ajouter « dans l'heure ».
- [ ] Allergènes à afficher (14 allergènes réglementaires) : **arachide** (19), **soja** (tofu, boisson et crème de soja, sauce soja), **gluten** (déjà calculé), **œuf**, **lait**, **poisson**, **moutarde** (21, 34), **sésame** (aucun), **céleri** (aucun : retiré des recettes d'origine). Le schéma n'a pas de champ « allergènes » ; à ajouter si l'équipe le veut.
- [ ] Sans gluten : les ingrédients sont classés selon leur nature, pas selon leur étiquette. Chorizo, saucisses, bouillon cube, moutarde et épices en mélange (curry) **peuvent contenir du gluten ou des traces** selon la marque. Le badge « sans gluten » doit dire « recette sans ingrédient à base de gluten : vérifie les étiquettes », et ne pas se présenter comme adapté à une personne cœliaque sans vérification.

## 4. Points à faire vérifier par un·e vrai·e diététicien·ne

1. **Seuil protéines** : 20 g par portion est-il le bon repère ? Faut-il un deuxième seuil pour les enfants ou pour les petits appétits ?
2. **Taille des portions** : les grammages (par exemple 250 g de riz pour 4, 400 g de pâtes pour 4 dans l'arrabbiata) correspondent-ils à des adultes, des enfants, des ados ? Faut-il des portions modulables ?
3. **Mention B12** et messages vegan (calcium, iode, oméga-3, fer) : formulation, emplacement, ton.
4. **Sel** : valider l'estimation, fixer un seuil d'alerte par portion, décider s'il faut quantifier le sel dans les recettes au lieu de « sel à goût ».
5. **Variantes vegan avec beaucoup de légumineuses** (720 g de pois chiches pour 4) : tolérance digestive, réalisme, intérêt de mélanger avec une céréale.
6. **Plats peu protéinés** (2, 12, 15, 16, 22, 23) : faut-il les étiqueter « entrée / accompagnement » ou leur ajouter un complément par défaut ?
7. **Biais du calcul** : poids des cuisses avec os, œufs avec coquille. Faut-il passer à un poids net mangeable dans `poids_piece_g`, ou ajouter un champ `part_comestible` au schéma ?
8. **Badge sans gluten** : formulation, et choix entre « sans ingrédient à gluten » et « adapté cœliaque ».
9. **Charcuterie et viande rouge** : faut-il un garde-fou dans le planificateur de semaine (PNNS : charcuterie 150 g par semaine, viande rouge 500 g par semaine) ?
10. **Allergènes** : faut-il un champ calculé, comme les régimes, plutôt qu'un texte ?
11. **Femmes enceintes et jeunes enfants** : œufs peu cuits, mention éventuelle par recette.
12. **Relecture recette par recette** des 40 fiches, puis passage en `statut: "testee"` seulement après une vraie réalisation en cuisine.
