# 🛡️ Architecture & Cybersécurité — Module P1 (Auth, Sécurité & Admin)

*Section rédigée par le Responsable P1 pour le document d'architecture global du projet.*

---

## 1. Rôle dans l'Architecture Globale

Le module **P1** constitue le **socle transversal et sécuritaire** de la plateforme. Aucun des modules métiers (**P2 Datasets**, **P3 Analytics**, **P4 Dashboards**) ne peut fonctionner en production sans s'appuyer sur les services fournis par P1 :
1. **Identification & Authentification (IAM) :** Enregistrement des utilisateurs, vérification des identifiants et émission de jetons cryptographiques sans état (JWT).
2. **Contrôle d'accès basé sur les rôles (RBAC) :** Cloisonnement strict entre Visiteurs (non authentifiés), Data Analysts (utilisateurs réguliers) et Administrateurs.
3. **Traçabilité & Piste d'audit (Audit Trail) :** Journalisation infalsifiable et centralisée de chaque action significative via la fonction `logActivity()`.
4. **Supervision & Espace Administrateur :** Dashboard dédié aux métriques de plateforme, à la gestion du cycle de vie des utilisateurs et à l'inspection des logs d'audit.

---

## 2. Modèle de Données & Schéma Relationnel

```mermaid
erDiagram
  users ||--o{ activity_logs : effectue
  users {
    uuid id PK "gen_random_uuid()"
    varchar email UK "Index unique B-Tree"
    varchar password_hash "Hachage bcrypt (cost 10)"
    varchar first_name "Prénom"
    varchar last_name "Nom"
    varchar role "admin | analyst (CHECK constraint)"
    boolean is_active "Contrôle d'activation"
    timestamp created_at "Horodatage UTC"
  }
  activity_logs {
    uuid id PK "gen_random_uuid()"
    uuid user_id FK "ON DELETE SET NULL"
    varchar action "Code action (USER_LOGIN, etc.)"
    varchar entity "Entité ciblée (dataset, auth...)"
    varchar entity_id "ID de la ressource ciblée"
    varchar ip_address "IPv4 / IPv6 cliente"
    text user_agent "Client HTTP / Navigateur"
    varchar status "SUCCESS | FAILURE (CHECK)"
    jsonb details "Métadonnées contextuelles"
    timestamp created_at "Horodatage UTC (Index DESC)"
  }
```

### Choix d'ingénierie structurants :
1. **Identifiants UUID v4 (`gen_random_uuid()`) :**  
   Contrairement à des entiers auto-incrémentés (`1, 2, 3`), les UUID empêchent formellement l'énumération de ressources (Insecure Direct Object Reference - IDOR). Un attaquant ne peut pas deviner l'identifiant des autres utilisateurs ou des logs.
2. **Clé étrangère avec `ON DELETE SET NULL` :**  
   Pour des impératifs d'audit et de conformité légale (RGPD/ISO 27001), la suppression d'un utilisateur ne doit jamais détruire la trace des opérations passées. L'événement reste consigné dans `activity_logs` avec `user_id = NULL`.
3. **Validation stricte au niveau de la BDD (`CHECK constraints`) :**  
   Les rôles sont restreints à `CHECK (role IN ('admin', 'analyst'))` et les statuts à `CHECK (status IN ('SUCCESS', 'FAILURE'))`. Même en cas d'anomalie applicative, la base de données protège son intégrité.
4. **Indexation ciblée :**  
   Index B-Tree sur `users(email)` pour garantir un temps de réponse en $O(\log n)$ lors de la connexion, et sur `activity_logs(created_at DESC)` pour alimenter instantanément le dashboard admin.

---

## 3. Matrice de Sécurité & Contrôle d'Accès (RBAC)

| Ressource / Action | Visiteur | Data Analyst | Administrateur |
|---|---|---|---|
| Consulter la page d'accueil (`/`) | ✅ Oui | ✅ Oui | ✅ Oui |
| Créer un compte (`/register`) | ✅ Oui | ❌ (Déjà connecté) | ❌ (Déjà connecté) |
| Se connecter (`/login`) | ✅ Oui | ❌ (Déjà connecté) | ❌ (Déjà connecté) |
| Voir son profil (`/profile`, `/api/auth/me`) | ❌ 401 | ✅ Oui | ✅ Oui |
| Consulter les dashboards publics (P4) | ✅ Oui | ✅ Oui | ✅ Oui |
| Créer / Modifier ses datasets et analyses (P2/P3/P4) | ❌ 401 | ✅ Oui | ✅ Oui |
| Liste des utilisateurs (`/api/admin/users`) | ❌ 401 | ❌ 403 Forbidden | ✅ Oui |
| Promouvoir / Rétrograder un utilisateur (`PATCH /role`) | ❌ 401 | ❌ 403 Forbidden | ✅ Oui |
| Suspendre / Réactiver un compte (`PATCH /status`) | ❌ 401 | ❌ 403 Forbidden | ✅ Oui |
| Consulter les statistiques globales (`/api/admin/stats`) | ❌ 401 | ❌ 403 Forbidden | ✅ Oui |
| Inspecter la piste d'audit (`/api/admin/logs`) | ❌ 401 | ❌ 403 Forbidden | ✅ Oui |

---

## 4. Principes de Cybersécurité Appliqués (Défense en Profondeur)

### 4.1 Protection des Mots de Passe (CWE-256)
- **Hachage adaptatif bcrypt (`saltRounds = 10`) :** Génération automatique d'un sel cryptographique unique par mot de passe.
- **Résistance au Brute-Force :** Le facteur de coût $2^{10} = 1024$ itérations ralentit drastiquement les tentatives d'attaques massives par dictionnaire ou GPU sans pénaliser l'expérience utilisateur légitime (~70ms par vérification).
- **Politique de complexité :** Longueur minimale de 8 caractères imposée dès la validation des formulaires.

### 4.2 Jeton d'Authentification sans état (JWT)
- **Algorithme :** `HS256` signé avec une clé secrète robuste (`JWT_SECRET`).
- **Principe du moindre privilège d'information :** Le payload du token ne contient aucun mot de passe ni donnée sensible, uniquement `{ id, email, role }`.
- **Durée de vie bornée :** Expiration automatique (`24h`) pour limiter l'impact d'un vol de jeton.

### 4.3 Protection Anti-Énumération (OWASP Top 10)
- Lors de l'échec de connexion, l'API renvoie systématiquement un code unifié `INVALID_CREDENTIALS` avec le message générique *"Email ou mot de passe incorrect."*, que l'email soit inexistant ou que le mot de passe soit faux. Un attaquant ne peut pas cartographier la liste des inscrits.

### 4.4 Protection Anti-Injection SQL (CWE-89)
- Toutes les requêtes SQL sans exception utilisent des requêtes paramétrées avec la syntaxe `$1, $2, ...` via le pool `pg`. Aucune concaténation de chaînes de caractères n'est autorisée.

### 4.5 Résilience du Journal d'Audit (Fail-Safe Logging)
- La fonction `logActivity()` est encapsulée dans un bloc `try/catch` isolé. Si l'écriture du log rencontre une difficulté transitoire, l'opération métier principale de l'utilisateur n'est jamais interrompue.

---

## 5. Intégration Front-end (React & Routeur)

1. **Client Axios Partagé (`frontend/src/services/api.js`) :**
   - **Intercepteur de Requête :** Lit le jeton dans `localStorage` et injecte automatiquement l'en-tête standard `Authorization: Bearer <token>`.
   - **Intercepteur de Réponse :** En cas d'expiration (`HTTP 401`), supprime automatiquement les identifiants locaux et redirige l'utilisateur vers `/login`.
2. **Contexte React (`AuthContext`) :**
   - Centralise l'état global (`user`, `token`, `isAuthenticated`, `isAdmin`).
   - Effectue un contrôle automatique de validité du jeton au démarrage via `GET /api/auth/me`.
3. **Garde de Route (`<ProtectedRoute>`) :**
   - Bloque le rendu des composants privés si l'utilisateur est anonyme.
   - Restreint l'accès aux pages réservées aux administrateurs (`requiredRole="admin"`).

