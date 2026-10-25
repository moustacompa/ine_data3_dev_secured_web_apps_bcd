# P2 — Datasets & Exploration

## Intégration

Le module est monté dans `backend/src/server.ts` sous `/api/datasets`. Toutes ses routes utilisent P1 `authenticateToken`; les données sont isolées par `datasets.user_id` (un administrateur peut superviser les datasets). Les imports et modifications/suppressions importantes sont transmis au journal P1 via `logActivity()`.

Le schéma conserve le contrat P4 : `datasets.id` est un entier, `datasets.user_id` référence `users.id`, et une ligne demeure un objet JSONB dans `dataset_rows.data`. `columns` stocke les noms et types détectés. `profile` stocke les statistiques préparées à l'import. P3 peut lire `dataset_rows` sans dépendre du module P2.

Initialisation : `npm run db:init`. Données de démonstration : `npm run db:seed` crée les comptes d'exemple P1/P4, les ventes 2026 (204 lignes et valeurs extrêmes) et le dataset environnemental P2 avec valeurs manquantes. Compte de démo : `alice@example.com`, mot de passe `Password123!`.

## Contrat API

Toutes les routes demandent `Authorization: Bearer <JWT>`.

| Méthode | Route | Fonction |
|---|---|---|
| GET | `/api/datasets?q=` | Liste et recherche des datasets accessibles |
| POST | `/api/datasets/import?title=&description=&category=&source=&format=csv\|json` | Import texte brut, en-tête `X-File-Name`; corps CSV/JSON brut |
| GET | `/api/datasets/:id` | Métadonnées |
| PATCH | `/api/datasets/:id` | Modifier titre, description, catégorie ou source |
| DELETE | `/api/datasets/:id` | Supprimer dataset et lignes associées |
| GET | `/api/datasets/:id/preview` | Métadonnées et dix premières lignes |
| GET | `/api/datasets/:id/profile` | Types, manquants et statistiques descriptives |
| GET | `/api/datasets/:id/rows?page=&pageSize=&search=&sort=&direction=&filters=` | Table paginée; `filters` est un tableau JSON encodé dans la query string |

Filtres pris en charge : `eq`, `contains`, `gt`, `gte`, `lt`, `lte`, `isnull`, `notnull`. Le tri accepte le nom de colonne et `asc`/`desc`. Les colonnes de tri et de filtre sont toujours transmises en paramètres SQL.

Le score de qualité est le pourcentage de cellules non manquantes : `100 × (cellules − cellules manquantes) / cellules`. Les chaînes vides et espaces seuls deviennent `null`. Le CSV accepte virgule, point-virgule et tabulation; JSON accepte un tableau d'objets ou `{ "data": [...] }`. Taille maximale : 15 Mo, 100 000 lignes et 200 colonnes. Les dates restent des chaînes ISO afin de conserver leur format dans JSONB.

## Postman

Importer `postman/collections/datasets.postman_collection.json`, définir la variable de collection `token` avec un JWT valide, puis exécuter « Dossiers Datasets ». La requête d'import enregistre automatiquement `datasetId` pour les requêtes suivantes.
