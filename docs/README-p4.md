# P4 — Dashboards & Partage

Module de la plateforme d'analyse de données : analyses sauvegardées, dashboards interactifs avec filtres globaux, partage privé/partagé/public, vue publique par lien et **détection des valeurs aberrantes** (fonctionnalité avancée).

```
backend/src/modules/dashboards/   API Express (à copier dans backend/src/modules/)
frontend/src/features/dashboards/ Pages et composants React (à copier dans frontend/src/features/)
postman/                          Dossier Postman « Dashboards » + script de fusion
docs/                             Section d'architecture et préparation de la soutenance
```

## Ce qui a été vérifié

| Vérification | Résultat |
|---|---|
| Tests unitaires (`node --test`) | 16/16 : aberrants, moteur SQL, injection SQL, droits, filtres, validation |
| Scénario de bout en bout contre PostgreSQL 16 | Droits, partage et retrait, publication et révocation du lien, filtres globaux, nettoyage des widgets |
| Collection Postman via Newman | 41 requêtes, 48 assertions, 0 échec |
| Build Vite + parcours Chromium | Aucune erreur console ; clair, sombre et mobile vérifiés |

## Intégration (30 minutes)

### 1. Base de données

Exécuter `backend/src/modules/dashboards/sql/001_analyses_dashboards.sql` **après** les scripts de P1 (`users`) et P2 (`datasets`, `dataset_rows`). Dans le `docker-compose` de P1, si les scripts sont montés dans `docker-entrypoint-initdb.d`, renommer le fichier pour qu'il passe en dernier (par ex. `040_dashboards.sql`).

Si `users.id` ou `datasets.id` sont des UUID, remplacer `INTEGER` par `UUID` dans les colonnes concernées.

### 2. Back-end

```js
// backend/src/app.js — après express.json(), avant le gestionnaire d'erreurs de P1
const { mountDashboards } = require('./modules/dashboards');
mountDashboards(app); // monte /api/analyses, /api/dashboards, /api/outliers, /api/public/dashboards
```

Ensuite, ouvrir **`deps.js`** : c'est le seul fichier à ajuster. Au démarrage, un message `→ mock utilisé` indique chaque dépendance pas encore trouvée.

| Dépendance | Chemin attendu (`PATHS`) | Ce qu'il faut exporter |
|---|---|---|
| Pool PostgreSQL (P1) | `../../config/db` | le `Pool` pg, ou `{ pool }` |
| Auth (P1) | `../auth/auth.middleware` | `authenticate` (ou `requireAuth`/`verifyToken`) qui remplit `req.user` avec `id` et `role`, et `requireRole(...roles)` |
| Journal (P1) | `../admin/activity.service` | `logActivity(userId, action, details)` |
| Requêtes (P3) | `../analytics/analytics.service` | `runQuery(datasetId, query)` → `{ columns, rows }` |

Les colonnes des tables de P2 se règlent par variables d'environnement si elles diffèrent : `P4_DATASET_OWNER_COL` (défaut `user_id`), `P4_DATASET_TITLE_COL` (défaut `title`), `P4_ROWS_DATA_COL` (défaut `data`, la colonne JSONB d'une ligne).

Tant que P3 n'a pas livré `runQuery`, le module utilise son propre moteur (`queryEngine.js`), qui suit le même contrat : il peut d'ailleurs servir de base à P3.

Les erreurs sont transmises au gestionnaire global de P1 avec `err.status`, `err.message` et éventuellement `err.details` (liste `{ field, message }`).

### 3. Front-end

```jsx
// App.jsx
import { DashboardsListPage, DashboardViewPage, DashboardEditorPage,
         MyAnalysesPage, SharedWithMePage, PublicDashboardPage } from './features/dashboards';

<Route path="/public/dashboards/:token" element={<PublicDashboardPage />} />   {/* hors ProtectedRoute */}
<Route element={<ProtectedRoute />}>
  <Route path="/dashboards" element={<DashboardsListPage />} />
  <Route path="/dashboards/:id" element={<DashboardViewPage />} />
  <Route path="/dashboards/:id/edit" element={<DashboardEditorPage />} />
  <Route path="/mes-analyses" element={<MyAnalysesPage />} />
  <Route path="/partages" element={<SharedWithMePage />} />
</Route>
```

Deux remplacements à faire au moment de l'intégration :

- **`api/client.js`** : remplacer l'instance Axios locale par celle de P1 (avec son intercepteur JWT). Garder `publicClient`, qui n'envoie pas de jeton.
- **`charts/source.js`** : remplacer l'import des graphiques temporaires par les composants de P3. Contrat de props : `{ data, x, y, title }` (`y` peut être un tableau de séries).

Les chemins vers la page Analyse de P3 se règlent dans `config.js` (`ROUTES.analysisNew`, `ROUTES.analysisEdit`).

Dépendances : `react-router-dom` v6 et `axios` (déjà présents dans le projet). Aucune autre bibliothèque.

### 4. Ce que les autres membres doivent savoir

**P3 (Analyse)** : le bouton « Enregistrer l'analyse » de la page Analyse appelle `analysesApi.create({ title, datasetId, config: { query, chart } })`, exporté par la feature. `query` est exactement ce qui est envoyé à `POST /analytics/query`. `chart` vaut `{ type: 'bar'|'line'|'pie'|'kpi'|'histogram'|'table', x, y }`. Pour la modification, lire `?analysisId=` puis appeler `analysesApi.get` et `analysesApi.update`.

**P1 (Admin)** : `GET /api/dashboards/stats` (admin) renvoie le nombre d'analyses, de dashboards partagés et publics, le nombre de vues publiques et le top 5 des dashboards publics, pour le dashboard d'administration. `GET /api/dashboards?scope=all` et `GET /api/analyses?scope=all` permettent la supervision.

**Postman** : déposer chaque collection dans `postman/collections/`, puis lancer `node postman/merge-collections.js`.

## Développer sans les autres modules

```bash
cd backend && npm i express pg jsonwebtoken
DATABASE_URL=postgres://... JWT_SECRET=dev-secret node src/modules/dashboards/dev-server.js   # API sur :4004
node src/modules/dashboards/dev-server.js --token 1 user     # affiche un JWT de test
NODE_ENV=test node --test src/modules/dashboards/tests/*.test.js
```

Côté front, définir `VITE_API_URL=http://localhost:4004/api` et placer le JWT dans `localStorage.token`.

## API

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/analyses?scope=mine\|shared\|accessible\|all&q=&datasetId=` | Lister |
| POST | `/api/analyses` | Créer `{ title, description?, datasetId, config: { query, chart }, visibility? }` |
| GET / PUT / DELETE | `/api/analyses/:id` | Lire / modifier (propriétaire ou admin) / supprimer (retire aussi les widgets) |
| POST | `/api/analyses/:id/run` | Exécuter `{ filters?: [...] }` |
| GET / POST / DELETE | `/api/analyses/:id/shares[/:userId]` | Partages (`{ email }`) |
| GET | `/api/dashboards?scope=mine\|shared\|all&q=` | Lister |
| POST | `/api/dashboards` | Créer `{ title, description?, layout?, globalFilters?, visibility? }` |
| GET / PUT / DELETE | `/api/dashboards/:id` | Lire / modifier / supprimer |
| POST | `/api/dashboards/:id/render` | Calculer tous les widgets `{ filters: { [filterId]: valeur } }` |
| GET | `/api/dashboards/:id/filters/:filterId/options` | Valeurs d'un filtre « liste » |
| POST | `/api/dashboards/:id/public-token` | Nouveau lien public (l'ancien est révoqué) |
| GET / POST / DELETE | `/api/dashboards/:id/shares[/:userId]` | Partages |
| GET | `/api/dashboards/stats` | Indicateurs (admin) |
| GET | `/api/public/dashboards/:token` | Vue publique, sans compte |
| POST | `/api/public/dashboards/:token/render` | Calcul public avec filtres |
| GET | `/api/public/dashboards/:token/filters/:filterId/options` | Valeurs de filtre (public) |
| GET | `/api/outliers/methods`, `/api/outliers/datasets`, `/api/outliers/datasets/:id/columns` | Aides à la configuration |
| POST | `/api/outliers` | Détecter `{ datasetId, column, method?: iqr\|zscore\|mad, threshold?, filters? }` |

Le détail des formats est dans la collection Postman et dans `docs/architecture-p4.md`.
