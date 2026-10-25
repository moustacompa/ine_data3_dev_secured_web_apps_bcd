# 🛡️ P1 : Socle Authentification, Sécurité & Administration
> **Projet :** Plateforme collaborative d'analyse et de visualisation de données  
> **Auteur :** P1 (Responsable Architecture Sécurité, IAM & Administration)  
> **Destinataires :** P2 (Datasets), P3 (Analytics), P4 (Dashboards) & Équipe enseignante  

---

## 📌 1. Vue d'ensemble & Rôle de P1

En tant que **P1**, j'ai la responsabilité du **socle transversal** de l'application : l'identité, le contrôle d'accès (RBAC), la sécurité des communications, le traçage des activités (audit logs) et l'espace d'administration.

Ce document est conçu pour vous (camarades P2, P3, P4) afin que vous compreniez précisément :
1. Comment fonctionne le système d'authentification et de permissions.
2. Comment **protéger vos routes API** à l'aide des middlewares de sécurité fournis.
3. Comment **enregistrer les actions critiques** de vos modules avec `logActivity()`.
4. Comment **consommer les API sécurisées côté React** sans réinventer la gestion des tokens.

```mermaid
flowchart TD
    Client["Front-end React (P1, P2, P3, P4)"]
    Axios["Intercepteur Axios (Fourni par P1)"]
    API["Back-end Express (Node.js)"]
    AuthMW["Middleware authenticateToken (P1)"]
    RoleMW["Middleware requireRole (P1)"]
    Modules["Modules Métier : P2 Datasets / P3 Analytics / P4 Dashboards"]
    AdminMod["Module Admin P1"]
    AuditLogger["Logger d'activité central logActivity() (P1)"]
    DB[(Base de données : PostgreSQL)]

    Client -->|Requête HTTP| Axios
    Axios -->|"Ajoute Bearer <JWT>"| API
    API --> AuthMW
    AuthMW -->|Token Valide (req.user)| RoleMW
    RoleMW -->|Accès Autorisé| Modules
    RoleMW -->|Accès Admin| AdminMod
    Modules -.->|Trace action métier| AuditLogger
    AdminMod -.->|Trace action admin| AuditLogger
    AuditLogger -->|Insert| DB
```

---

## 🗄️ 2. Modèle de Données (Base de Données)

Le module P1 gère deux tables relationnelles fondamentales dans PostgreSQL.

### 2.1 Table `users`
Stocke les comptes utilisateurs, leurs identifiants sécurisés et leur rôle RBAC.

| Champ | Type | Contraintes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` / `SERIAL` | `PRIMARY KEY` | Identifiant unique universel |
| `email` | `VARCHAR(255)` | `UNIQUE`, `NOT NULL` | Adresse email normalisée (minuscules, sans espaces) |
| `password_hash`| `VARCHAR(255)` | `NOT NULL` | Mot de passe haché par **bcrypt** (salt 10-12) |
| `first_name` | `VARCHAR(100)` | `NOT NULL` | Prénom de l'utilisateur |
| `last_name` | `VARCHAR(100)` | `NOT NULL` | Nom de l'utilisateur |
| `role` | `VARCHAR(20)` | `DEFAULT 'analyst'` | Rôle : `'admin'` ou `'analyst'` (visiteur = non connecté) |
| `is_active` | `BOOLEAN` | `DEFAULT true` | Suspension de compte par l'administrateur |
| `created_at` | `TIMESTAMP` | `DEFAULT NOW()` | Date de création du compte |
| `updated_at` | `TIMESTAMP` | `DEFAULT NOW()` | Date de dernière mise à jour |

### 2.2 Table `activity_logs`
Enregistre la traçabilité de toutes les actions significatives réalisées sur la plateforme (audit trail de sécurité et métriques du dashboard admin).

| Champ | Type | Contraintes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` / `SERIAL` | `PRIMARY KEY` | Identifiant du log |
| `user_id` | `INTEGER` / `UUID`| `NULLABLE`, `FK users(id)` | Auteur de l'action (`NULL` si anonyme ou login échoué) |
| `action` | `VARCHAR(50)` | `NOT NULL` | Code de l'action (`USER_LOGIN`, `DATASET_IMPORT`, etc.) |
| `entity` | `VARCHAR(50)` | `NOT NULL` | Entité ciblée (`auth`, `dataset`, `analysis`, `dashboard`) |
| `entity_id` | `VARCHAR(100)`| `NULLABLE` | ID de l'entité manipulée (ex: ID du dataset importé) |
| `ip_address` | `VARCHAR(45)` | `NULLABLE` | Adresse IP source (IPv4 / IPv6) |
| `user_agent` | `TEXT` | `NULLABLE` | Navigateur / Client utilisé |
| `status` | `VARCHAR(20)` | `DEFAULT 'SUCCESS'` | `'SUCCESS'` ou `'FAILURE'` |
| `details` | `JSONB` / `TEXT`| `NULLABLE` | Métadonnées contextuelles (ex: taille du fichier, raison de rejet) |
| `created_at` | `TIMESTAMP` | `DEFAULT NOW()` | Horodatage précis de l'événement |

---

## 🎁 3. Outils transverses livrés à P2, P3 et P4

### 3.1 Back-end : Protéger vos routes avec `authenticateToken`
Pour toute route qui nécessite que l'utilisateur soit connecté, vous devez insérer le middleware `authenticateToken`.  
Ce middleware vérifie la validité du JWT dans l'en-tête `Authorization: Bearer <token>` et peuple automatiquement `req.user`.

```typescript
import express from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Exemple pour P2 (Datasets) : seule une personne connectée peut importer un dataset
router.post('/datasets/import', authenticateToken, async (req, res) => {
  // req.user est désormais disponible et garanti valide !
  const userId = req.user.id;
  const userRole = req.user.role;
  
  // Votre logique métier ici...
});
```

### 3.2 Back-end : Restreindre par rôle avec `requireRole`
Si une route est réservée aux administrateurs ou à un rôle précis, combinez avec `requireRole` :

```typescript
import { authenticateToken, requireRole } from '../middlewares/auth.middleware.js';

// Exemple : Seul un admin peut purger des données globales
router.delete('/datasets/purge-all', authenticateToken, requireRole('admin'), async (req, res) => {
  // Exécuté uniquement si req.user.role === 'admin'
});
```

### 3.3 Back-end : Journaliser une action métier avec `logActivity()`
Chaque fois qu'un utilisateur réalise une opération majeure dans votre module, appelez la fonction asynchrone `logActivity` pour enrichir les statistiques d'administration :

```typescript
import { logActivity } from '../modules/admin/activity.service.js';

// Exemple pour P2 lors de la création d'un dataset :
await logActivity({
  req,                         // L'objet Request Express (extrait IP et user-agent automatiquement)
  userId: req.user.id,
  action: 'DATASET_IMPORT',    // Code conventionnel en majuscules
  entity: 'dataset',
  entity_id: newDataset.id,
  status: 'SUCCESS',
  details: { filename: file.originalname, rowCount: rows.length }
});

// Exemple pour P3 lors d'un calcul analytique :
await logActivity({
  req,
  userId: req.user.id,
  action: 'ANALYTICS_QUERY',
  entity: 'analytics',
  details: { queryType: 'correlations', executionTimeMs: 142 }
});

// Exemple pour P4 lors du partage d'un dashboard :
await logActivity({
  req,
  userId: req.user.id,
  action: 'DASHBOARD_SHARE',
  entity: 'dashboard',
  entity_id: dashboard.id,
  details: { visibility: 'public' }
});
```

### 3.4 Front-end : Client HTTP Axios partagé & Intercepteur
Pour que vos composants React n'aient pas à manipuler manuellement `localStorage.getItem('token')` à chaque requête :
- Importez l'instance `api` située dans `src/services/api.ts`.
- L'intercepteur injecte automatiquement le header `Authorization: Bearer <token>`.
- En cas d'erreur `401 Unauthorized` (token expiré ou révoqué), l'intercepteur déconnecte proprement l'utilisateur et le redirige vers `/login`.

```typescript
// Dans vos composants ou services (ex: features/datasets/datasetService.ts) :
import { api } from '../../services/api';

export const fetchUserDatasets = async () => {
  // Inutile d'ajouter les headers auth, c'est fait automatiquement !
  const response = await api.get('/api/datasets');
  return response.data;
};
```

### 3.5 Front-end : Contexte & Garde de Navigation (`AuthContext` & `ProtectedRoute`)
Pour protéger une page dans le routeur React (`react-router-dom`) :

```tsx
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DatasetsPage } from './features/datasets/DatasetsPage';
import { AdminDashboard } from './features/admin/AdminDashboard';

function AppRoutes() {
  return (
    <Routes>
      {/* Route publique */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Route protégée pour tout utilisateur connecté (P2 / P3 / P4) */}
      <Route 
        path="/datasets" 
        element={
          <ProtectedRoute>
            <DatasetsPage />
          </ProtectedRoute>
        } 
      />

      {/* Route réservée exclusivement aux administrateurs (P1) */}
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}
```

---

## 📡 4. Contrats d'API (Spécification des Endpoints P1)

Toutes les réponses de l'API respectent une structure JSON normalisée :
```json
// Succès
{
  "success": true,
  "data": { ... },
  "message": "Opération réussie"
}

// Erreur
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Identifiants invalides."
  }
}
```

### 4.1 Authentification (`/api/auth`)

#### `POST /api/auth/register`
- **Accès :** Public
- **Body :**
  ```json
  {
    "email": "analyst@example.com",
    "password": "Password123!",
    "first_name": "Alice",
    "last_name": "Durand"
  }
  ```
- **Réponse (201 Created) :**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "1",
        "email": "analyst@example.com",
        "first_name": "Alice",
        "last_name": "Durand",
        "role": "analyst"
      },
      "token": "eyJhbGciOiJIUzI1NiIsIn..."
    }
  }
  ```

#### `POST /api/auth/login`
- **Accès :** Public (soumis à un Rate Limiting anti brute-force)
- **Body :**
  ```json
  {
    "email": "analyst@example.com",
    "password": "Password123!"
  }
  ```
- **Réponse (200 OK) :**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "1",
        "email": "analyst@example.com",
        "role": "analyst"
      },
      "token": "eyJhbGciOiJIUzI1NiIsIn..."
    }
  }
  ```

#### `GET /api/auth/me`
- **Accès :** Connecté (`Bearer Token`)
- **Réponse (200 OK) :** Retourne le profil de la session courante.

---

### 4.2 Administration (`/api/admin`)
*(Toutes ces routes exigent `authenticateToken` + `requireRole('admin')`)*

#### `GET /api/admin/users`
- **Description :** Liste tous les utilisateurs enregistrés avec pagination et recherche par nom/email.

#### `PATCH /api/admin/users/:id/role`
- **Body :** `{ "role": "admin" | "analyst" }`
- **Description :** Permet à un admin de promouvoir ou rétrograder un utilisateur.

#### `PATCH /api/admin/users/:id/status`
- **Body :** `{ "isActive": false }`
- **Description :** Permet de désactiver temporairement un compte compromis.

#### `GET /api/admin/stats`
- **Description :** Retourne les métriques clés de la plateforme :
  - Nombre total d'utilisateurs actifs
  - Nombre total de datasets importés
  - Nombre total d'analyses exécutées
  - Répartition des activités sur les 7 derniers jours

#### `GET /api/admin/logs`
- **Description :** Consultation paginée du journal d'audit (`activity_logs`) avec filtres par utilisateur, type d'action et date.

---

## 🔒 5. Architecture de Sécurité & Bonnes Pratiques Cyber

En tant que responsable sécurité, les contre-mesures suivantes sont intégrées nativement :

1. **Protection des Mots de Passe :**
   - Hachage cryptographique fort avec **bcrypt** (facteur de coût `10` à `12`).
   - Le mot de passe en clair ne transite jamais dans les logs ni en base.
   - Politique de complexité minimale (au moins 8 caractères, majuscule, chiffre, caractère spécial).

2. **Sécurité des Tokens (JWT) :**
   - Algorithme symétrique sécurisé `HS256`.
   - Durée de validité bornée (ex: 2h ou 24h).
   - Payload minimaliste : contient uniquement `id`, `email`, `role`. Aucune donnée sensible dans le JWT (le JWT est signé, pas chiffré !).

3. **Protection contre le Brute-Force & Déni de Service (DoS) :**
   - Mise en place d'un **Rate Limiter** (`express-rate-limit`) sur `/api/auth/login` (ex: maximum 5 tentatives échouées par fenêtre de 15 minutes par IP).

4. **En-têtes de Sécurité HTTP :**
   - Activation d'**Helmet** pour configurer les en-têtes HTTP défensifs (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, CSP).

5. **Sanitization & Validation stricte des entrées :**
   - Toutes les entrées utilisateurs (`req.body`, `req.query`, `req.params`) sont validées par un schéma strict (ex: Zod ou Express-Validator) avant d'atteindre le contrôleur.
   - Protection contre les injections SQL grâce aux requêtes paramétrées (ou ORM/Query Builder).

6. **Cloisonnement des Erreurs :**
   - Middleware centralisé `errorHandler`.
   - En environnement de production, les traces de pile (`stack traces`) et détails de base de données sont masqués aux clients pour éviter la fuite d'informations (CWE-209).

---

## 📂 6. Arborescence du Code (Périmètre P1)

Voici l'organisation des répertoires dédiée au socle P1 :

```text
projet/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.ts               # Connexion PostgreSQL
│   │   │   └── security.ts         # Configuration JWT, bcrypt, rate-limit
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts  # authenticateToken & requireRole
│   │   │   ├── error.middleware.ts # Gestionnaire d'erreurs global
│   │   │   └── validate.middleware.ts # Validation des schémas d'entrée
│   │   ├── modules/
│   │   │   ├── auth/               # Inscription, Connexion, Validation tokens
│   │   │   ├── users/              # Gestion des profils utilisateurs
│   │   │   └── admin/              # Statistiques globales, Logs d'audit, Gestion des rôles
│   │   └── server.ts               # Point d'entrée de l'API Express
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   │   └── AuthContext.tsx     # État global utilisateur, login(), logout()
│   │   ├── components/
│   │   │   ├── ProtectedRoute.tsx  # Garde de route React Router
│   │   │   └── Navbar.tsx          # Navigation adaptée au rôle (Admin vs Analyst)
│   │   ├── features/
│   │   │   ├── auth/               # Vues Login, Register, Profil
│   │   │   └── admin/              # Dashboard d'administration, supervision des logs
│   │   └── services/
│   │       └── api.ts              # Client Axios configuré avec intercepteur Bearer
└── docker-compose.yml              # Orchestration PostgreSQL, Backend, Frontend
```

---

## 🚀 7. Variables d'Environnement Requises (`.env`)

Pour faire tourner le backend avec les fonctionnalités d'authentification et de sécurité, chaque développeur doit configurer son fichier `.env` local :

```env
# Port du serveur Express
PORT=5000

# Base de données PostgreSQL (port 5435 dans docker-compose pour éviter tout conflit)
DATABASE_URL=postgres://dev_user:dev_password123!@localhost:5435/platform_db

# Clés secrètes & Cryptographie
JWT_SECRET=super_secret_jwt_key_pour_notre_projet_securise_2026!
JWT_EXPIRES_IN=24h
BCRYPT_SALT_ROUNDS=10

# Sécurité & CORS
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

---

## ⚡ 8. Démarrage Rapide & Comptes de Test (Intégration Réalisée)

L'intégration conjointe de **P1 (Auth & Admin)** et **P4 (Dashboards & Partage)** est opérationnelle.

### 1. Démarrer la Base de Données & l'Adminer
```bash
docker compose up -d
```
- PostgreSQL écoute sur `localhost:5435`.
- Interface graphique Adminer accessible sur `http://localhost:8080`.

### 2. Démarrer le Backend (Node.js / Express / TypeScript)
```bash
cd backend
npm install
npm run dev
```
- API active sur `http://localhost:5000` (Routes Auth, Admin, Analyses, Dashboards).
- Vérification statique : `npm run typecheck` (0 erreur).
- Tests automatisés : `npm run test:dashboards` (20/20 pass).

### 3. Démarrer le Frontend (React / Vite)
```bash
cd frontend
npm install
npm run dev
```
- Interface accessible sur `http://localhost:3000`.

### 🔑 Comptes de démonstration pré-configurés
| Email | Mot de passe | Rôle | Privilèges & Accès |
|---|---|---|---|
| `alice@example.com` | `Password123!` | `admin` | Accès complet : Profil, Analyses, Dashboards, Console Admin (`/admin`) |
| `bob@example.com` | `Password123!` | `analyst` | Data Analyst : Profil, Analyses, Dashboards (accès `/admin` interdit en 403) |

---

## 📄 9. Livrables & Rapports Word (.docx) Disponibles

Dans le dossier `docs/` se trouvent tous les livrables exigés pour la soutenance du 26 octobre 2026 :
- [`docs/rapport-p1.docx`](docs/rapport-p1.docx) : **Rapport officiel individuel de P1** (Périmètre, architecture BDD/Backend/Frontend, mesures de cybersécurité, plan de soutenance).
- [`docs/rapport-fusion-p1-p4.docx`](docs/rapport-fusion-p1-p4.docx) : **Rapport officiel conjoint P1 & P4** (Intégration globale, modèle relationnel à 8 tables, moteur de détection d'outliers, dashboarding).
- [`docs/architecture-p1.md`](docs/architecture-p1.md) : Spécification technique détaillée de sécurité et d'architecture.
- [`docs/soutenance-p1.md`](docs/soutenance-p1.md) : Fiche mémo pour la soutenance orale (scénario de démo et réponses aux questions du jury).

---

## 🤝 10. Procédure pour l'équipe (P2, P3)

1. Pour toute question sur l'intégration du token ou des autorisations, référez-vous à la section **3. Outils transverses livrés**.
2. N'essayez pas de contourner `authenticateToken` en codant votre propre système de vérification d'utilisateur.
3. Si votre fonctionnalité nécessite une permission spéciale ou une nouvelle action dans `activity_logs`, contactez **P1** pour la déclarer proprement dans les constantes de sécurité.
