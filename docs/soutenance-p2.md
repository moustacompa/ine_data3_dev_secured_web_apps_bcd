# Soutenance — partie P2 : import et exploration des datasets

**Durée visée :** 3 à 4 minutes, puis questions.
**Objectif :** montrer le passage d’un fichier brut à un dataset vérifié, explorable et prêt à être analysé par P3.

## Préparer la démonstration

- Lancer PostgreSQL, l’API et le frontend ; vérifier `/api/health` avant l’arrivée du jury.
- Exécuter `npm run db:seed` depuis `backend/` si la base de démonstration est vide.
- Se connecter avec `alice@example.com` et `Password123!`.
- Garder le dataset « Qualité des données (démo) » pour montrer les valeurs manquantes et le score ; garder « Ventes 2026 (démo) » pour démontrer le relais P3/P4.
- Préparer un petit CSV à importer ; éviter de créer le dataset pendant que le jury attend.

## Scénario oral

### 1. Besoin (20 secondes)

« Avant de calculer ou de visualiser des indicateurs, il faut centraliser les fichiers, comprendre leur structure et repérer les données manquantes. P2 réalise cette étape d’import et d’exploration. »

### 2. Liste et profil d’un dataset (45 secondes)

Ouvrir **Datasets** et montrer les jeux disponibles, leurs catégories, le nombre de lignes et de colonnes, ainsi que le score de qualité. Ouvrir « Qualité des données (démo) » et désigner le panneau de profil : types détectés, valeurs manquantes et statistiques des colonnes numériques.

### 3. Import CSV (45 secondes)

Ouvrir le formulaire d’import et présenter les métadonnées (titre, description, catégorie, source) puis le fichier CSV. Montrer l’import et le profil créé automatiquement. Préciser que CSV et JSON sont pris en charge.

### 4. Exploration interactive (1 minute)

Dans la page du dataset, rechercher une valeur, trier une colonne et appliquer un filtre. Choisir un champ numérique et sélectionner « Valeur manquante » pour isoler les cellules vides. Montrer le nombre de résultats et la pagination. Modifier ensuite les informations du dataset pour illustrer le CRUD des métadonnées.

### 5. Passage de relais (20 secondes)

« Les lignes sont conservées dans `dataset_rows.data` au format JSONB. P3 peut lire ces lignes pour calculer les agrégats ; P4 réutilise le même contrat pour ses analyses et ses dashboards. Les routes sont protégées par l’authentification P1. »

## Messages techniques à retenir

- `datasets` contient l’utilisateur propriétaire, les métadonnées et le profil ; `dataset_rows` conserve une ligne par objet JSONB.
- Le schéma de P2 garde `datasets.id` entier, `user_id` UUID, `title` et `dataset_rows.data` afin de rester compatible avec P4.
- L’import est transactionnel et les valeurs vides deviennent `null`.
- Le score est le pourcentage de cellules renseignées ; les filtres permettent d’isoler les valeurs manquantes ou présentes.
- P1 fournit le middleware JWT, le client Axios et `logActivity()`.

## Questions possibles

**Comment le type d’une colonne est-il détecté ?**
Les valeurs non vides de chaque colonne sont examinées. Si elles sont toutes numériques, booléennes ou des dates reconnues, le type correspondant est retenu ; sinon la colonne est considérée comme texte.

**Comment calculez-vous le score de qualité ?**
Il s’agit du pourcentage de cellules non manquantes sur l’ensemble des cellules. Cette mesure est simple à expliquer et peut ensuite être complétée par des critères de doublons, de validité ou de cohérence métier.

**Que devient une valeur manquante ?**
Une chaîne vide ou composée d’espaces est stockée comme `null`. Le profil la compte et l’utilisateur peut filtrer les lignes concernées. Une étape de remplacement ou de suppression automatique peut être ajoutée plus tard.

**Pourquoi JSONB pour les lignes ?**
Les jeux importés n’ont pas tous les mêmes colonnes. JSONB permet de conserver chaque ligne sans créer une table SQL différente pour chaque fichier, tout en laissant P3/P4 interroger ses propriétés.

**Comment évitez-vous qu’un utilisateur lise les données d’un autre ?**
Les routes exigent un JWT P1 et les requêtes vérifient l’identifiant propriétaire du dataset. L’administrateur peut consulter les datasets pour la supervision.

**Quels formats sont supportés ?**
CSV et JSON. Excel et d’autres sources sont des évolutions possibles, pas des formats annoncés comme déjà pris en charge.

## Conclusion courte

« P2 transforme un fichier en données structurées, documentées et contrôlées. Le profil qualité aide l’utilisateur à comprendre les limites du dataset avant de lancer une analyse ou de construire un dashboard. »
