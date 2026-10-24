# Soutenance : partie P4 (création du dashboard et partage public)

Durée visée : 4 à 5 minutes de démonstration, puis questions.

## Préparer la veille

- Un dataset de démonstration importé (par P2) avec au moins une colonne de catégorie, une date et un montant. Y glisser **deux valeurs volontairement fausses** (un montant énorme, un montant négatif) : ce sont elles que la détection va révéler.
- Trois ou quatre analyses enregistrées depuis la page Analyse de P3 : un KPI, des barres par catégorie, une courbe mensuelle, des secteurs.
- Un deuxième compte (« Bob ») pour montrer le partage.
- Une fenêtre de **navigation privée** déjà ouverte, sans être connecté, pour la vue publique.
- Ne pas exécuter le dossier Postman « Nettoyage » avant la démo : il supprime les données de test.

## Scénario

1. **Le besoin (20 s).** « Une analyse isolée ne suffit pas : on veut regrouper les indicateurs sur un écran, les filtrer ensemble et les diffuser, y compris à des gens sans compte. »
2. **Créer le dashboard (1 min).** Mes dashboards → Nouveau dashboard → titre. Ajouter le KPI, les barres, la courbe. Glisser un widget pour le déplacer et changer une largeur via le menu ⋯. Montrer l'indicateur « Enregistré » : il n'y a pas de bouton Enregistrer, tout est sauvegardé automatiquement.
3. **Filtres globaux (1 min).** Filtres globaux → ajouter « Région » (liste) et « Période ». Choisir une région : *tous* les widgets se recalculent en même temps. Montrer que le camembert passe à 100 %.
4. **Fonctionnalité avancée (1 min).** Ajouter un widget → Valeurs aberrantes → dataset, colonne montant → Prévisualiser. Les deux valeurs piégées apparaissent, en ambre, avec leur numéro de ligne. Passer de IQR à MAD et expliquer en une phrase la différence (voir ci-dessous). Ajouter le widget : il suit lui aussi les filtres.
5. **Partage (1 min).** Partager → inviter Bob par e-mail (le dashboard passe en « Partagé »). Puis choisir Public → Copier le lien → le coller dans la fenêtre de navigation privée : le dashboard s'affiche sans compte, filtres compris.
6. **Révocation (30 s).** Générer un nouveau lien → recharger l'ancien dans la navigation privée : « n'existe pas ou n'est plus public ». Le contrôle reste au propriétaire.

## Questions probables

**Comment empêchez-vous l'injection SQL alors que les colonnes sont choisies par l'utilisateur ?**
Les noms de colonnes sont passés en paramètres (`data ->> $3`), comme les valeurs. Seuls les opérateurs sont écrits dans le SQL, et ils viennent d'une liste fermée. Un test unitaire tente l'injection.

**Le lien public, on peut le deviner ?**
Non : 192 bits aléatoires générés par `crypto.randomBytes`. Il est révocable à tout moment, la réponse ne contient pas d'informations personnelles et les routes publiques sont limitées en débit.

**Si l'auteur d'une analyse retire son partage, que devient mon dashboard ?**
Le widget affiche que l'accès a été retiré. Les droits sont vérifiés à chaque calcul, avec ceux du propriétaire du dashboard, pas ceux du lecteur.

**Pourquoi trois méthodes de détection ?**
IQR fonctionne sur n'importe quelle distribution. Le z-score suppose des données à peu près normales et subit l'effet de masquage : plusieurs extrêmes gonflent l'écart-type et se cachent eux-mêmes. La méthode MAD s'appuie sur la médiane, donc elle résiste à ces extrêmes.

**Pourquoi calculer le dashboard côté serveur ?**
Un seul appel au lieu d'un par widget, la vue publique n'a pas besoin d'accéder à l'API d'analyse, et le visiteur ne reçoit que les résultats, pas le dataset.

**Pourquoi du JSONB pour la mise en page ?**
Sa forme évolue avec l'interface sans migration ; la cohérence est assurée par la validation côté serveur et une contrainte en base sur le lien public.

**Comment avez-vous travaillé en parallèle des autres ?**
Toutes les dépendances passent par un seul fichier (`deps.js`), avec des mocks automatiques tant que les modules des autres n'existaient pas.

**Qu'amélioreriez-vous ?**
Cache des résultats, instantanés figés des dashboards publics, liens avec date d'expiration, export PDF.
