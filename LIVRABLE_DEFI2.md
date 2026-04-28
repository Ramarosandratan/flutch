# Livrable — Défi 2 : Critère DPE

## Résumé
Le Défi 2 demandait d’ajouter le DPE comme critère incontournable du rapprochement immobilier, avec une logique de comparaison entre un bien classé de `A` à `G` et un acquéreur qui impose un `dpe_min`.

Le projet livré implémente ce besoin dans la base, la synchronisation CRM, le moteur de matching et l’interface.

## Ce qui a été livré

### 1. Base de données
Le schéma contient désormais les colonnes nécessaires au critère DPE dans `db.js` :

```sql
ALTER TABLE biens ADD COLUMN IF NOT EXISTS dpe TEXT;
ALTER TABLE acquereur_criteria ADD COLUMN IF NOT EXISTS dpe_min TEXT;
```

Ces colonnes sont aussi créées au bootstrap du schéma pour que l’application reste autonome en local.

### 2. Intégration CRM Pipedrive
Le mapping et la synchronisation ont été étendus pour récupérer et stocker le DPE depuis Pipedrive :

- `pipedrive/fieldMapping.js` résout le champ `DPE` pour les biens.
- `pipedrive/sync.js` normalise les valeurs avec `normalizeDpe()` et écrit :
	- `biens.dpe`
	- `acquereur_criteria.dpe_min`

Le code accepte plusieurs libellés CRM pour rester robuste aux variations de configuration.

### 3. Moteur de matching
La règle métier est appliquée dans `db.js` avec une échelle ordonnée `A=1 ... G=7` :

- un bien doit avoir un DPE au moins aussi bon que le `dpe_min` demandé,
- un acquéreur avec `dpe_min = B` ne peut donc pas recevoir un bien `F`,
- la logique fonctionne dans les deux sens du matching.

Un correctif important a aussi été appliqué : le matching ne contourne plus les critères lorsqu’un todo existe déjà.

### 4. Interface utilisateur
La vue `bien → acquéreur` dans `public/search.html` affiche désormais les informations utiles au contrôle du critère :

- le DPE du bien sélectionné dans la fiche affichée à l’utilisateur,
- un badge `DPE: X` pour chaque acquéreur retourné,
- un sélecteur DPE dans les critères de recherche,
- la saisie du `dpe_min` dans le formulaire d’acquéreur.

## Validation
Les vérifications utiles pour ce défi sont :

```bash
npm run seed:e2e
npm test
node .verify-defi2.js
```

Le seed n’est utile que si vous voulez repartir d’un jeu de données reproductible avant la validation.

## Points de contrôle
Les points suivants doivent être vrais pour considérer le Défi 2 comme validé :

- les colonnes `dpe` et `dpe_min` existent bien,
- les données synchronisées remontent correctement depuis Pipedrive,
- le matching respecte l’ordre DPE,
- l’UI expose le DPE du bien et le DPE minimum de l’acquéreur,
- `npm test` et `node .verify-defi2.js` passent.
