# Fusion du module P4 (Dashboards & Partage) dans le dépôt principal

Ce document décrit ce qui a été ajouté depuis `codep4/` et comment le tester.
**Aucun fichier existant du dossier principal n'a été modifié** (`README.md`, `docker-compose.yml`,
`backend/database/schema.sql`, `.gitignore`) : tout passe par de nouveaux fichiers.

Toutes les adaptations faites dans le code P4 sont marquées par le commentaire `[FUSION P1/P4]`
(chercher ce texte dans le projet pour les retrouver).

## 1. Fichiers ajoutés

| Emplacement | Origine | Rôle |
|---|---|---|
| `backend/src/modules/dashboards/` | `codep4/backend/src/modules/dashboards/` | API Express du module P4 |
| `backend/src/modules/dashboards/p1-compat.js` | **nouveau** | Adaptation aux conventions de P1 (UUID, format de `logActivity`) |
| `backend/src/modules/dashboards/tests/p1-compat.test.js` | **nouveau** | Tests de l'adaptation |
| `backend/database/020_datasets_placeholder.sql` | **nouveau** | Tables `datasets` / `dataset_rows` provisoires (en attendant P2) |
| `backend/database/040_dashboards.sql` | **nouveau** (dérivé de `sql/001_analyses_dashboards.sql`) | Tables P4 avec ids utilisateurs en UUID |
| `backend/package.json` | **nouveau** | Dépendances et scripts pour lancer P4 seul |
| `backend/database/init-db.js` | **nouveau** | Crée la base et exécute les scripts SQL sur le PostgreSQL local (sans Docker) |
| `backend/.env.example` | **nouveau** | Modèle de configuration (`DATABASE_URL` sur `localhost:5432`) |
| `frontend/src/features/dashboards/` | `codep4/frontend/src/features/dashboards/` | Pages et composants React |
| `postman/` | `codep4/postman/` | Collection Postman « Dashboards » |
| `docs/architecture-p4.md`, `docs/soutenance-p4.md`, `docs/captures/` | `codep4/docs/` | Documentation P4 |
| `docs/README-p4.md` | `codep4/README.md` | README d'origine du module P4 |

Le dossier `codep4/` est laissé intact (il est ignoré par `.gitignore`) ; il peut être supprimé une fois la fusion validée.

## 2. Adaptations obligatoires du code P4

| Problème | Fichier(s) | Correction |
|---|---|---|
| P1 utilise des **UUID** pour `users.id`, P4 faisait `Number(user.id)` → `NaN`, plus personne n'était propriétaire | `deps.js`, `access.js`, `shares.service.js`, `dashboards.service.js` | Ids gardés en chaîne ; comparaisons via `sameId()` de `p1-compat.js` |
| `DELETE …/shares/:userId` n'acceptait que des entiers | `controllers.js` | `parseUserId()` (UUID ou entier) |
| Le middleware de P1 s'appelle `authenticateToken` et se trouve dans `src/middlewares/` | `deps.js` (`PATHS.authMiddleware`) | Nouveau chemin + nom reconnu |
| `logActivity` de P1 prend un objet `{ userId, action, entity, entity_id, status, details }` | `deps.js` | Conversion via `toP1ActivityPayload()` (`dashboard.publish` → `DASHBOARD_PUBLISH`) |
| Le jeton de dev forçait un id numérique | `dev-server.js` | Id gardé tel quel (UUID) |
| Colonnes `owner_id` / `user_id` en `INTEGER` | `backend/database/040_dashboards.sql` | Passées en `UUID` |

Le fichier `backend/src/modules/dashboards/sql/001_analyses_dashboards.sql` (version INTEGER d'origine) est conservé
pour référence, mais **c'est `backend/database/040_dashboards.sql` qu'il faut utiliser**.

## 3. Tester

### Tests unitaires (sans base)

```bash
cd backend
npm install
NODE_ENV=test npm run test:dashboards        # 20 tests attendus (16 P4 + 4 fusion)
```

Sous PowerShell : `$env:NODE_ENV='test'; npm run test:dashboards`

### Base de données (PostgreSQL installé sur le PC, port 5432 — pas de Docker)

```bash
cd backend
cp .env.example .env          # puis mettre votre utilisateur / mot de passe PostgreSQL dans DATABASE_URL
npm install
npm run db:init               # crée platform_db si besoin, puis schema.sql -> 020 -> 040
```

`db:init` ne crée **que les tables** (les comptes viendront de l'inscription P1, les datasets de l'import P2).
Pour la démo : `npm run db:seed` ajoute `alice@example.com`, `bob@example.com`, `admin@example.com`
(mot de passe `Password123!`) et un dataset « Ventes 2026 (démo) » de 204 lignes dont 4 montants aberrants,
puis affiche les UUID des comptes (fichier `backend/database/050_demo_seed.sql`).

Le script est relançable sans risque (`CREATE ... IF NOT EXISTS`). L'utilisateur PostgreSQL doit avoir le droit
de créer une base ; sinon, créer `platform_db` à la main (pgAdmin) puis relancer `npm run db:init`.

> Le `docker-compose.yml` de P1 (PostgreSQL sur le port 5435 + Adminer) n'est plus nécessaire pour P4 ;
> il n'a pas été modifié.

### API P4 seule (avant que le serveur de P1 existe)

```bash
cd backend
# Créer un utilisateur (pgAdmin, table users) et récupérer son UUID, puis :
npm run token:dashboards -- <uuid-utilisateur> admin
npm run dev:dashboards
# API sur http://localhost:4004/api  (en-tête Authorization: Bearer <jeton>)
```

Les scripts npm chargent `backend/.env` automatiquement (`node --env-file-if-exists`, Node 22.9 minimum).

Le jeton doit contenir un **UUID existant** : un id comme `1` provoque une erreur 400 (valeur invalide pour une colonne UUID).

### Front-end : application de démo provisoire (`frontend-demo-p4/`)

En attendant l'application de P1, `frontend-demo-p4/` affiche les pages de `frontend/src/features/dashboards`
(importées via l'alias `@p4`, sans copie). Elle ajoute uniquement : un login de démo (choix Alice / Bob / Admin),
une navigation, et une page Analyse minimale qui remplace celle de P3. **À supprimer après l'intégration.**

```cmd
:: Terminal 1 : API P4
cd backend
npm run dev:dashboards

:: Terminal 2 : front de démo
cd frontend-demo-p4
npm install
npm run dev
```

Ouvrir http://localhost:5173, choisir un compte. `npm run db:seed` fournit 4 analyses prêtes pour Alice.

## 4. Restant à faire lors des livraisons des autres membres

- **P1** : dans `app.js`, appeler `mountDashboards(app)` (voir `backend/src/modules/dashboards/index.js`).
  Le module P4 est en **CommonJS** (`require`) ; si le serveur P1 est en TypeScript/ESM, l'importer via
  `createRequire` ou activer `esModuleInterop`.
- **P1 (front)** : dans `frontend/src/features/dashboards/api/client.js`, remplacer l'instance Axios locale par
  `src/services/api.ts` ; déclarer les routes de `frontend/src/features/dashboards/index.js` dans `App`.
- **P2** : remplacer `020_datasets_placeholder.sql` par le vrai schéma. Si `datasets.id` devient un UUID,
  il faudra adapter `040_dashboards.sql` (`dataset_id`) et les `Number(datasetId)` de `validate.js`.
- **P3** : fournir `runQuery` dans `src/modules/analytics/analytics.service` et les graphiques dans `charts/source.js`.
