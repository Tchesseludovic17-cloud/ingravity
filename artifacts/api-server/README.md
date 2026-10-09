# InGravity — première étape : API de contrôle

InGravity reçoit une action proposée par un agent, compare son montant à une
règle et renvoie une décision. Chaque décision valide est conservée dans une
base SQLite, avec la date et les informations reçues.

Cette version ne contient volontairement ni écran de tableau de bord, ni
approbation manuelle, ni connecteur n8n. Le code est séparé en modules pour que
ces ajouts puissent être faits plus tard sans réécrire l’API.

## Tester l’API

Le service accepte les deux adresses suivantes :

- `POST /check-action` — adresse courte demandée ;
- `POST /api/check-action` — même endpoint sous le préfixe API du projet.

Exemple de requête :

```sh
curl -X POST http://localhost:80/check-action \
  -H 'Content-Type: application/json' \
  -d '{"action_type":"payment","amount":1250,"metadata":{"order_id":"order-123"}}'
```

Réponse avec la règle fournie :

```json
{
  "decision": "pending_approval",
  "reason": "Montant 1250 supérieur à la limite de 1000 ; décision appliquée : pending_approval.",
  "risk_score": 25
}
```

Les champs `action_type` (texte) et `metadata` (objet JSON) sont nécessaires.
`amount` est facultatif, mais il doit être un nombre positif ou nul s’il est
fourni. Une requête invalide reçoit le code HTTP `400` avec un message JSON.

## Comment le score est calculé

- Sans règle correspondante, l’action est approuvée et le score vaut `0`.
- Si le montant est égal ou inférieur à la limite, l’action est approuvée et
  le score vaut `0`.
- Au-dessus de la limite, le score augmente selon le dépassement :
  `ceil((montant - limite) / limite × 100)`, plafonné à `100`.
  Par exemple, dépasser une limite de `1000` avec un montant de `1250` donne
  `25`.
- Si une règle de montant correspond mais que `amount` n’est pas envoyé,
  l’action est mise en attente : sans montant, la limite ne peut pas être
  vérifiée.
- La décision en cas de dépassement est celle de
  `action_if_exceeded` dans la règle.

## Modifier une règle

Le fichier `config/rules.json` contient les règles. Exemple :

```json
{
  "rules": [
    {
      "action_type": "payment",
      "max_amount": 1000,
      "action_if_exceeded": "pending_approval"
    }
  ]
}
```

Pour bloquer plutôt que demander une approbation, remplacez
`pending_approval` par `blocked`. Le serveur lit le fichier au démarrage :
redémarrez le serveur après avoir modifié les règles. Une configuration
incorrecte empêche le serveur de démarrer et affiche l’erreur à corriger.

## Où sont les éléments du projet ?

1. `src/app.ts` prépare le serveur HTTP, les requêtes JSON et les adresses de
   l’API.
2. `src/routes/check-action.ts` vérifie les données envoyées, appelle le
   moteur de décision et prépare la réponse JSON.
3. `src/domain/check-action.ts` contient les types des actions et les règles
   de décision et de calcul du risque. Il ne dépend pas du serveur HTTP ou de
   la base de données.
4. `src/config/rules.ts` lit et vérifie `config/rules.json` au démarrage.
5. `config/rules.json` est le fichier que vous pouvez modifier pour changer
   les règles.
6. `src/repositories/action-repository.ts` crée la table SQLite et y
   enregistre chaque action valide avec sa décision et sa date.
7. `src/lib/paths.ts` aide les autres modules à trouver le dossier du
   serveur, que l’application tourne en développement ou après compilation.
8. `src/routes/index.ts` rassemble les routes de l’API. La vérification de
   santé existante `/api/healthz` est conservée pour le fonctionnement du
   serveur.
9. `src/index.ts` démarre le serveur sur le port fourni par l’environnement.
10. `../../lib/api-spec/openapi.yaml` décrit le format de la requête et de la
    réponse pour faciliter les futures intégrations et générations de clients.
11. `data/ingravity.sqlite` est la base créée automatiquement au premier
    démarrage. Elle n’a pas besoin d’être créée à la main.

La base utilise SQLite intégré à Node.js 24 : aucun paquet supplémentaire
n’est nécessaire. Node.js peut afficher un avertissement indiquant que son
interface SQLite est encore expérimentale ; cet avertissement n’empêche pas
l’API de fonctionner.

## Lancer et vérifier

Le workflow `artifacts/api-server: API Server` lance l’API. Pour vérifier le
code depuis le terminal :

```sh
pnpm --filter @workspace/api-server run typecheck
```

Pour retrouver les valeurs d’exemple dans la base locale, utilisez un montant
connu, par exemple `{"action_type":"payment","amount":1250,"metadata":{}}`.
