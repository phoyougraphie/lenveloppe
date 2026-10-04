# D'où viennent nos prix : le RNM de FranceAgriMer

Une partie des prix affichés sur L'enveloppe vient du **Réseau des Nouvelles des Marchés (RNM)**. C'est un service public piloté par FranceAgriMer, un établissement public du ministère de l'Agriculture. Ses données sont publiées en accès libre sur [rnm.franceagrimer.fr](https://rnm.franceagrimer.fr) sous licence ouverte, à condition de citer la source.

Le RNM suit les prix à plusieurs stades : production, expédition, marchés de gros et vente au détail. **Nous n'utilisons que le stade « détail »**, c'est-à-dire le prix payé en magasin, toutes taxes comprises.

## Ce que le RNM relève

Au stade détail, le RNM publie chaque semaine neuf séries de prix, appelées « marchés » sur son site :

| Rayon | Grandes et moyennes surfaces (GMS) | Magasins spécialisés bio |
|---|---|---|
| Légumes | Légumes France DETAIL GMS | Légumes France DETAIL MAG. SPECIALISES BIO |
| Fruits | Fruits France DETAIL GMS | Fruits France DETAIL MAG. SPECIALISES BIO |
| Lait et œufs | Lait Oeuf DETAIL GMS | Lait Oeuf France DETAIL MAG. SPECIALISES BIO |
| Viande | Viande France DETAIL GMS | Viande France DETAIL MAG. SPECIALISES BIO |
| Poisson et coquillages | Marée France DETAIL GMS | — |

Chaque ligne est un produit précis, avec son origine et son conditionnement. Par exemple : « CAROTTE France lavée vrac » ou « LAIT UHT demi écrémé brique (le litre) ». Pour chaque ligne, le RNM donne :

- un **prix moyen** pondéré ;
- un **mini** et un **maxi**. D'après la méthodologie du RNM, ce sont le 1er et le 9e décile des prix relevés : 10 % des magasins sont moins chers que le mini, 10 % sont plus chers que le maxi.

Le prix est donné au kilo, sauf mention contraire dans le libellé (à la pièce, au litre, à la botte, la boîte de 6 œufs…).

### Où sont faits les relevés

Pour les fruits et légumes en GMS, le RNM décrit son panel ainsi : environ **150 magasins de plus de 400 m²**. Ce sont des hypermarchés, des supermarchés, des « magasins à dominante marque propre » (le hard-discount en fait partie) et des grandes surfaces spécialisées dans le frais. Les magasins sont choisis selon leur surface, leur région et la taille de leur ville. Le prix moyen est pondéré selon la surface du magasin et la population de sa zone de chalandise. Le RNM précise aussi que ce panel est en cours de renouvellement partiel.

Quand un même magasin propose plusieurs produits correspondant à un même libellé, l'enquêteur relève **le moins cher**.

Le RNM ne publie un prix que s'il a été relevé dans assez de magasins.

### À quelle fréquence

Les prix sont relevés et publiés **chaque semaine**. Sur la page de la semaine 39 de 2026 (du 21 au 27 septembre), la date de relevé indiquée est le jeudi 24 septembre. La liste des produits suivis **change d'une semaine à l'autre** selon la saison. Par exemple, il n'y a pas de fraises en octobre.

### Combien de produits

Pour la semaine 39 de 2026, nous avons compté **224 lignes de prix au détail**, regroupées en **65 produits** :

- légumes en GMS : 65 lignes ;
- fruits en GMS : 58 lignes ;
- légumes en magasins bio : 55 lignes ;
- fruits en magasins bio : 22 lignes ;
- marée en GMS : 7 lignes ;
- viande en GMS : 7 lignes ;
- lait et œufs en GMS : 6 lignes ;
- lait et œufs en magasins bio : 3 lignes ;
- viande en magasins bio : 1 ligne.

On est loin des « plus de 300 produits » qu'on lit parfois. Nous n'avons pas trouvé d'où vient ce chiffre, mais il ne correspond pas aux prix en magasin. Le RNM suit beaucoup plus de produits aux autres stades (gros, expédition), qui ne reflètent pas ce que paie le consommateur. Au détail, l'offre est riche en fruits et légumes, mais très mince pour le reste. On trouve par exemple un seul morceau de bœuf (le steak haché 15 % MG), un seul de porc (la côte), aucun fromage, aucun beurre, et aucun poulet standard (seulement label rouge et bio).

## Comment nous en tirons nos trois niveaux de prix

Le RNM ne publie pas ses prix sous la forme « premier prix / prix moyen / bio ». Nous reconstruisons ces trois niveaux nous-mêmes, de la façon suivante.

**Prix moyen (grande surface)**

C'est le prix moyen RNM d'une ligne relevée en GMS, sans mention bio, label rouge, AOP ou IGP. Quand plusieurs lignes conviennent, nous préférons celle exprimée au kilo (ou au litre, ou à la pièce), d'origine France et vendue en vrac. S'il reste plusieurs candidates, nous prenons celle dont le prix est au milieu.

**Premier prix**

⚠️ **Le RNM ne distingue pas le hard-discount.** Les magasins discount font partie du panel GMS, mais ils ne sont pas publiés à part. Faute de mieux, notre « premier prix » est le **mini** (1er décile) de la même ligne GMS que le prix moyen. Concrètement, c'est le prix en dessous duquel se trouvent les 10 % de magasins les moins chers du panel. C'est une **approximation**, pas un relevé dans une enseigne discount. Si le RNM ne publie pas de mini pour cette ligne, nous n'affichons pas de premier prix.

**Bio**

C'est le prix moyen d'une ligne « biologique » vendue dans la même unité. Nous prenons de préférence le bio vendu en GMS, parce qu'il vient du même panel que le prix moyen. À défaut, nous prenons le prix relevé en magasins spécialisés bio, qui est souvent plus élevé. Le site indique toujours lequel des deux est utilisé. Le choix de la ligne bio la plus proche est automatique : nous le vérifions à la main avant de le rattacher à un ingrédient.

Pour chaque prix, le site affiche le libellé RNM exact, la semaine du relevé et le lien vers la page source.

Un exemple concret : pour la semaine 39 de 2026, les carottes donnent :

| Niveau | Prix | Ligne RNM |
|---|---|---|
| Premier prix | 1,49 €/kg | mini de « CAROTTE France lavée vrac » (GMS) |
| Prix moyen | 2,02 €/kg | « CAROTTE France lavée vrac » (GMS) |
| Bio | 2,43 €/kg | « CAROTTE France lavée biologique » (GMS) |

## Ce que nous ne savons pas (et ne prétendons pas savoir)

- **Le vrai prix en hard-discount.** Il n'existe pas de série dédiée au RNM. Notre « premier prix » en est seulement une estimation.
- **Les prix de nombreux produits.** Sur 65 produits suivis au détail, la semaine 39 de 2026 nous donne 41 prix moyens, 40 premiers prix, 50 prix bio, et les trois niveaux pour seulement 25 produits. Une vingtaine de légumes (bette, céleri, épinard, fenouil…) ne sont suivis qu'en magasin bio. Nous n'avons alors aucun prix conventionnel pour eux. Les produits d'épicerie (pâtes, riz, légumes secs, huile, conserves) ne sont pas suivis du tout par le RNM.
- **Les prix magasin par magasin.** Le RNM publie des moyennes nationales, pas le prix d'une enseigne ou d'une ville.
- **Les prix d'une semaine donnée, pour toujours.** Les prix changent chaque semaine. Nous affichons la dernière semaine publiée. Un produit hors saison peut disparaître.
- **Les petites incohérences de la source.** Il arrive qu'un prix moyen publié sorte de l'intervalle mini–maxi. Nous reprenons les chiffres tels quels, sans les corriger, et nous signalons ces cas dans nos fichiers.

Quand nous n'avons pas de prix, nous l'écrivons : **« prix non suivi »**. Nous n'inventons jamais de chiffre.

---

*Source : RNM – FranceAgriMer, prix au stade détail, [rnm.franceagrimer.fr](https://rnm.franceagrimer.fr). Données réutilisées sous la licence ouverte de FranceAgriMer.*
