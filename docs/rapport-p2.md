# Rapport P2 — Datasets & Exploration

**Projet :** Plateforme collaborative d’analyse et de visualisation de données
**Périmètre :** importation, gestion, exploration et profilage des datasets
**Date :** 25 octobre 2026

## 1. Résumé

Le module P2 couvre les premières étapes du cycle de vie des données : importation, contrôle, profilage et exploration. Un analyste authentifié peut importer un fichier CSV ou JSON, décrire son dataset, consulter ses colonnes et ses lignes, rechercher et filtrer des valeurs, trier les résultats et modifier les métadonnées.

Le module calcule également le nombre de valeurs manquantes, des statistiques descriptives par colonne et un score de qualité. Les lignes sont stockées en JSONB afin de conserver un format souple que le module P3 peut interroger et que P4 sait déjà exploiter.

## 2. Objectifs et périmètre

Les besoins du cahier des charges couverts par P2 sont :

- créer et gérer des jeux de données avec titre, description, catégorie et source ;
- importer au minimum des fichiers CSV et détecter automatiquement les types ;
- consulter les lignes sous forme tabulaire avec pagination, recherche, filtres et tri ;
- présenter les dimensions, les types, les statistiques descriptives et les cellules manquantes ;
- fournir à P3 des données de démonstration réutilisables ;
- intégrer les protections d’accès et le journal d’activité de P1.

L’import Excel, les connecteurs à des API externes et la modification directe des valeurs des cellules ne font pas partie de cette version.

## 3. Architecture et choix de stockage

Le backend suit l’architecture existante : `backend/src/modules/datasets/` contient les routes Express et le service métier. Le frontend React est regroupé sous `frontend/src/features/datasets/`. Le routeur de l’application monte l’API sous `/api/datasets` et protège les pages avec `ProtectedRoute`.

La table `datasets` contient le propriétaire UUID fourni par P1, les métadonnées, le format, les dimensions et deux documents JSONB : `columns` décrit les colonnes et les types détectés ; `profile` contient les indicateurs calculés. La table `dataset_rows` contient une entrée par ligne importée, dans `data JSONB`.

Le contrat conservé pour P4 est `datasets.id` de type entier, `datasets.user_id` comme propriétaire, `datasets.title` comme titre et `dataset_rows.data` comme objet JSONB. P3 peut ainsi lire directement `dataset_rows` sans dépendre des écrans P2.

## 4. Importation et préparation des données

Le formulaire d’import recueille le titre, la description, la catégorie, la source et un fichier. L’API reçoit le fichier texte brut avec son nom dans `X-File-Name`. CSV et JSON sont pris en charge : le CSV accepte les séparateurs virgule, point-virgule et tabulation ; le JSON peut être un tableau d’objets ou un objet contenant le tableau `data`.

Le système valide le nombre de lignes et de colonnes, normalise les en-têtes vides et rend les noms dupliqués uniques. Les valeurs d’une colonne permettent de détecter les types entier, nombre, booléen, date ou texte. Les chaînes vides et composées d’espaces sont converties en `null`. Les dates restent au format texte pour préserver une représentation JSON stable.

Les limites d’import sont de 15 Mo, 100 000 lignes et 200 colonnes. L’insertion du dataset et des lignes est transactionnelle ; les lignes sont insérées par lots. Une erreur annule la transaction, ce qui évite de laisser un import partiel.

## 5. Exploration et profilage

La page de liste présente les datasets accessibles, leur catégorie, leurs dimensions et leur score de qualité. La page d’exploration affiche un tableau paginé et un profil par colonne. L’utilisateur peut rechercher dans les lignes, choisir une colonne et un opérateur de filtre, trier par colonne, et modifier les métadonnées.

Le profil indique pour chaque colonne le type détecté, le nombre et le pourcentage de valeurs manquantes, le nombre de valeurs distinctes et, pour les colonnes numériques, les minimum, maximum et moyenne.

Le score global est calculé ainsi :

`Score qualité = 100 × (nombre de cellules − cellules manquantes) / nombre de cellules`

Il représente donc la part des cellules renseignées. Un dataset sans cellule est considéré à 100, car aucune cellule manquante n’est observée. Les valeurs manquantes restent `null` dans les lignes et peuvent être filtrées avec les opérateurs « valeur manquante » et « valeur renseignée ».

## 6. Contrat de l’API

Toutes les routes sont protégées par `authenticateToken`. Elles renvoient une enveloppe JSON `success`, `data` ou `error` cohérente avec P1.

- `GET /api/datasets?q=` : lister et rechercher les datasets ;
- `POST /api/datasets/import` : importer CSV ou JSON et créer le profil ;
- `GET /api/datasets/:id` : lire les métadonnées ;
- `PATCH /api/datasets/:id` : modifier titre, description, catégorie ou source ;
- `DELETE /api/datasets/:id` : supprimer un dataset et ses lignes dépendantes ;
- `GET /api/datasets/:id/preview` : récupérer le dataset et dix lignes ;
- `GET /api/datasets/:id/profile` : récupérer le profil ;
- `GET /api/datasets/:id/rows` : lecture paginée avec paramètres de recherche, tri et filtres.

Les filtres disponibles sont `eq`, `contains`, `gt`, `gte`, `lt`, `lte`, `isnull` et `notnull`. La page limite la taille d’une page à 100 lignes. Les noms de colonnes et les valeurs sont passés comme paramètres SQL, et les opérateurs acceptés sont validés par une liste fermée.

## 7. Sécurité et intégration avec P1

Chaque route API commence par le middleware P1 `authenticateToken`. L’identifiant UUID du compte est utilisé pour restreindre les opérations au propriétaire ; un compte administrateur peut superviser les datasets. Le frontend réutilise le client Axios partagé de P1, qui ajoute le JWT automatiquement.

Les imports, modifications et suppressions importantes appellent `logActivity()` avec le compte, l’action et l’identifiant du dataset. Les erreurs d’import sont renvoyées comme erreurs de validation, et les erreurs internes ne divulguent pas les détails de la base de données.

## 8. Données de démonstration et vérifications

La commande `npm run db:seed` exécute les schémas puis ajoute les comptes P1/P4 et deux datasets utiles à la démonstration : « Ventes 2026 (démo) » contient 204 lignes pour les analyses et les dashboards ; « Qualité des données (démo) » contient 12 lignes et des valeurs manquantes pour présenter le profilage P2. Le propriétaire des datasets est `alice@example.com` ; le mot de passe de démonstration est `Password123!`.

Pendant l’intégration, l’initialisation et le seed PostgreSQL ont abouti. `npm run typecheck` a été exécuté avec succès après la correction d’un contrôle `rowCount` nullable. Le parcours de connexion et d’exploration a été vérifié dans l’application. Les commandes détaillées de vérification restent dans le README.

## 9. Limites et améliorations

La première version privilégie un modèle simple adapté au MVP. Elle peut être prolongée par l’import Excel, un aperçu avant validation, des règles de nettoyage (remplacement ou suppression des valeurs manquantes), une détection de doublons, l’export des lignes filtrées et le traitement en flux pour les fichiers volumineux.

## 10. Conclusion

P2 fournit le contrat de données partagé entre les membres : des datasets rattachés à un propriétaire, des lignes JSONB directement exploitables par P3/P4 et un profil explicite. L’utilisateur peut suivre le cheminement de l’import à l’exploration tout en conservant le contrôle d’accès de P1.
