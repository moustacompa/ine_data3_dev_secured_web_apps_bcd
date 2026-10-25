# 🎤 Fiche de Soutenance — P1 : Auth, Sécurité & Administration
> **Projet :** Plateforme collaborative d'analyse et de visualisation de données  
> **Rôle :** P1 (Architecte Sécurité, IAM & Espace Administrateur)  
> **Date de soutenance :** Lundi 26 octobre 2026  

---

## 💡 Le Pitch d'introduction (1 minute)

> *"Bonjour à tous. En tant que P1, ma responsabilité a été de concevoir et déployer le socle architectural et sécuritaire de l'application. Sans ce socle, aucun collaborateur ne peut être identifié, aucun dataset ne peut être rattaché à un propriétaire, et aucune donnée confidentielle ne peut être protégée.*  
>  
> *J'ai articulé mon travail autour de trois piliers fondamentaux :*  
> 1. *L'identité et le contrôle d'accès basé sur les rôles (RBAC avec JWT et bcrypt).*  
> 2. *La traçabilité et l'audit de sécurité (`activity_logs` et `logActivity()`).*  
> 3. *La fourniture d'outils transverses (middlewares et intercepteur Axios) livrés clés en main à mes camarades P2, P3 et P4."*

---

## 🎬 Scénario de Démonstration en Direct (3-4 minutes)

Voici le déroulé exact à présenter au jury pour un impact maximal :

### 1. Inscription et Sécurité des Mots de Passe
- **Action :** Ouvrir la page `/register` et créer un compte (ex: `alice@example.com`).
- **Ce qu'il faut expliquer au jury :**  
  Montrer que le mot de passe n'est jamais stocké en clair. Il est haché avec l'algorithme **bcrypt** avec un sel cryptographique unique (`saltRounds = 10`), ce qui immunise notre base contre les attaques par tables arc-en-ciel (*Rainbow Tables*).
- **Montrer la BDD dans Adminer (`http://localhost:8080`) :** La colonne `password_hash` contient bien le hachage sécurisé `$2a$10$...`.

### 2. Le Jeton JWT & l'Intercepteur Axios
- **Action :** Se connecter sur `/login`.
- **Ce qu'il faut expliquer :**  
  L'API émet un **JSON Web Token (JWT)** signé en `HS256`.  
  Côté React, grâce à l'**intercepteur Axios** que j'ai développé, mes camarades n'ont pas à gérer manuellement les en-têtes : le jeton est injecté automatiquement avec `Authorization: Bearer <token>`. Si le jeton expire, l'intercepteur intercepte l'erreur `401` et déconnecte proprement l'utilisateur.

### 3. La Démonstration du RBAC (Contrôle d'Accès par Rôles)
- **Action :**  
  1. Se connecter avec le compte d'un simple analyste.  
  2. Tenter d'accéder à l'URL `/admin`.
- **Ce qu'il faut montrer :**  
  Le composant `<ProtectedRoute requiredRole="admin">` bloque immédiatement la page. Et si l'utilisateur essaie de contourner le Front-end en interrogeant directement l'API (`/api/admin/users`), le middleware backend `requireRole('admin')` le stoppe net avec un code HTTP **`403 Forbidden`** !

### 4. L'Espace Administrateur & la Piste d'Audit (Audit Trail)
- **Action :** Se connecter avec le compte Admin (`alice@example.com`) et aller sur `/admin`.
- **Ce qu'il faut montrer :**  
  1. **Les KPIs globaux :** Répartition des utilisateurs actifs, administrateurs et total d'actions.  
  2. **La gestion des utilisateurs :** Promouvoir un analyste en Administrateur en 1 clic.  
  3. **L'onglet "Journaux d'Audit" :** Montrer que l'action de promotion a été instantanément enregistrée dans `activity_logs` avec l'adresse IP, le navigateur, l'horodatage et les détails JSON !

---

## 🛡️ Questions pièges classiques du Jury & Réponses imparables

#### Q1 : *"Pourquoi avoir utilisé des UUID pour les utilisateurs au lieu d'entiers auto-incrémentés (1, 2, 3) ?"*
> **Réponse :** *"Pour prévenir les vulnérabilités de type IDOR (Insecure Direct Object Reference) et l'énumération de ressources. Avec des entiers prédictibles, un utilisateur malveillant peut facilement deviner l'URL des autres comptes (`/api/users/2`, `/3`). Avec des UUID v4 aléatoires générés nativement par PostgreSQL, la prédiction est mathématiquement impossible."*

#### Q2 : *"Où stockez-vous le token JWT et comment vous protégez-vous contre les failles XSS et CSRF ?"*
> **Réponse :** *"Dans notre architecture SPA moderne, le token est conservé en mémoire applicative dans le Contexte React et persisté dans `localStorage` pour le rafraîchissement de page. En complément, nous appliquons une politique de sanitation stricte des entrées et les en-têtes de sécurité HTTP CORS pour restreindre strictement les requêtes à notre origine frontend (`localhost:3000`). Pour un niveau bancaire supérieur, une alternative envisagée est l'usage de cookies avec les attributs `HttpOnly`, `Secure` et `SameSite=Strict`."*

#### Q3 : *"Que se passe-t-il si votre fonction `logActivity()` échoue (ex: disque saturé sur les logs) ?"*
> **Réponse :** *"Elle a été conçue selon le principe de résilience Fail-Safe : l'insertion du log est encapsulée dans un bloc isolé qui n'interrompt jamais la requête métier principale de l'utilisateur. Un analyste pourra toujours télécharger son dataset ou exécuter son analyse même en cas de ralentissement ponctuel de la table de logs."*

#### Q4 : *"Comment votre travail a-t-il facilité la tâche de vos collègues P2, P3 et P4 ?"*
> **Réponse :** *"Je leur ai fourni trois livrables majeurs dès le premier jour :*  
> 1. *Le middleware `authenticateToken` pour protéger leurs routes en 1 seule ligne de code.*  
> 2. *La fonction `logActivity()` qu'ils ont simplement appelée lors de leurs actions clés.*  
> 3. *L'intercepteur Axios et `<ProtectedRoute>` sur React pour qu'ils n'aient aucune tuyauterie d'authentification à réécrire. La compatibilité a été telle que mon camarade P4 a pu intégrer son module de dashboards en s'appuyant à 100 % sur mes spécifications."*
