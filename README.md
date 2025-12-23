# MMP3

App mobile/web (Expo + React Native) + API (Express + MongoDB).

## Structure du repo
- `app/` : routes Expo Router (UI)
- `components/` : composants UI réutilisables
- `context/` : state global via React Context (auth, partenaires/slots, challenges, activités)
- `services/` : client API (Axios) + services de données
- `server/` : backend Express (routes/controllers/services/models)

## Démarrage rapide (client Expo)
```bash
npm install
npm run start
```

Lancer sur device/simulateur :
```bash
npm run ios
npm run android
```

Web :
```bash
npm run web
```

### Config API côté client
Le client utilise `EXPO_PUBLIC_API_URL`.

- Exemple local :
	- `EXPO_PUBLIC_API_URL=http://localhost:5000`
	- ou `EXPO_PUBLIC_API_URL=http://localhost:5000/api`

La valeur est normalisée pour terminer par `/api` dans `services/config.ts`.

Le client fait aussi un warmup en arrière-plan via `GET /health` (hors `/api`) dans `services/api.ts`.

## Démarrage rapide (serveur Express)
```bash
cd server
npm install
npm run dev
```

### Variables d'environnement serveur
Le serveur a besoin au minimum de :
- `MONGO_URI` : MongoDB (dev/prod) (voir `server/config/db.js`)
- `JWT_SECRET` : signature des JWT (voir `server/middleware/authMiddleware.js`)

Le serveur écoute par défaut sur `PORT=5000`.

## Tests
Tests (client + server) depuis la racine :
```bash
npm test
```

Tests serveur seulement :
```bash
cd server
npm test
```

Notes tests serveur :
- `server/__tests__/setup.js` charge `server/.env.test`.
- Les tests utilisent `mongodb-memory-server` en replset (dossier `server/mongodb-binaries`).
	- Si le binaire Mongo ne démarre/télécharge pas, définir `MONGOMS_VERSION`.

## Conventions importantes (à connaître)
### Auth
- Le token est stocké sous la clé AsyncStorage `userToken` (`context/AuthContext.tsx`).
- `services/api.ts` ajoute automatiquement `Authorization: Bearer <token>` via interceptors (sauf `/auth/*`).

### Slots partenaires (solo / p1 / p2)
Le slot actif (`activeSlot`) influence ce que l’utilisateur voit partout :
- `context/ChallengeContext.tsx` expose un `currentChallenge` filtré selon le slot.
- `context/ActivityContext.tsx` gère un historique solo (`activities`) et un historique partagé (`duoActivities`), chargé via `GET /api/activities/shared/:partnerId`.

## Troubleshooting
### Web: “gros carrés” de couleur sur les chiffres du compte à rebours (dégradé)
Le dégradé de texte s’appuie sur `background-clip: text` côté web. Selon le navigateur/support, si le clip n’est pas appliqué, le background apparaît en bloc derrière le texte.

- Le composant concerné est `components/GradientText.tsx` (utilisé notamment dans `components/WeeklyCard.tsx`).
- La stratégie attendue :
	- appliquer un dégradé CSS quand `background-clip: text` est supporté
	- sinon fallback sur une couleur unie
