# AUDIT TECHNIQUE & ARCHITECTURE — MMP3
**Date:** 21 décembre 2025  
**Scope:** Monorepo **Expo / React Native (TypeScript)** + **Express / MongoDB (JS)**.  
**Objectif:** fournir un rapport à jour et actionnable sur la structure, l’architecture, la qualité, les risques, et les priorités.

> Note: le repo contient déjà des audits détaillés du **20/12/2025** (ex: `AUDIT_COMPLET.md`, `AUDIT_DETAILS_TECHNIQUES.md`, `AUDIT_CHALLENGES_COMPLET.md`). Ce document est une **mise à jour/complément** orientée *architecture & risques* (avec les correctifs récents côté app).

---

## 1) Résumé exécutif

### Points forts
- **Architecture globale claire**: séparation nette `app/` (routes), `components/` (UI), `context/` (state), `services/` (API client) et `server/` (API Express).
- **Stratégie slot/partenaire** bien intégrée à l’expérience: `activeSlot` pilote l’affichage du contenu et l’accès aux fonctionnalités.
- **Client API robuste** (`services/api.ts`): interceptors, messages d’erreur normalisés, warmup `/health`.
- **Tests existants et exécutables**: `npm test` passe (projets client + serveur).

### Risques majeurs (à traiter en priorité)
- **P0 — Sécurité:** route admin **non protégée** `GET /api/admin/fix-indexes` (modifie les index DB). En production, c’est un point d’entrée critique.
- **P0 — Sécurité:** **CORS permissif** (`app.use(cors())`) + absence de **rate limiting** sur login/register + **helmet non activé**.
- **P0 — Migrations/DB:** `server/config/db.js` tente de **dropper un index** au démarrage (risque perf/indisponibilité, comportement non déterministe, surprises en prod).

### Risques importants
- **Re-renders / “flash”** possibles via polling: `ChallengeContext` poll (3s/15s) + `PartnerContext` poll (15s). Un correctif a été appliqué sur `ChallengeContext` pour éviter des `setState` inutiles (moins de jank), mais `PartnerContext` peut encore re-render inutilement si les réponses sont identiques.
- **Incohérence des shapes de réponse** (certaines routes retournent `{success,data}`, d’autres du “raw”): la couche client a un `unwrapData()` pour les challenges, mais ce n’est pas systématique.

---

## 2) Structure du repo

### Racine
- `app/`: écrans Expo Router (groupes `(auth)` et `(tabs)`, plus écrans de configuration).
- `context/`: providers (Auth, Partner, Challenge, Activity).
- `services/`: Axios + services orientés domaine (challenge, activities, users, stats).
- `server/`: API Express + jobs + tests.
- `types/`, `utils/`, `components/`.

### Convention clé
- Le client dépend fortement de **4 Contexts** en cascade:
  1. `AuthProvider` (token/user)
  2. `PartnerProvider` (slot/partenaires/invites)
  3. `ChallengeProvider` (challenge actuel + invitations + polling)
  4. `ActivityProvider` (activities solo + shared DUO)

---

## 3) Architecture Client (Expo / React Native)

### 3.1 Navigation & guard
- Point d’entrée: `app/_layout.tsx`.
- Guard global:
  - redirige vers `/(auth)/login` si non authentifié,
  - force l’onboarding slot sur `/settings` si `hasSelectedSlot` est false,
  - conserve `<Slot />` monté pendant le chargement (bonne pratique: évite la perte de state des forms).

**Observation:** le loader overlay utilise des couleurs hardcodées (`#111`, `#ffd700`). Si vous avez un design system (ex: `utils/theme.ts`), ça mériterait d’être aligné.

### 3.2 State management

#### Auth (`context/AuthContext.tsx`)
- Token stocké AsyncStorage (`userToken`).
- `services/api.ts` ajoute automatiquement `Authorization: Bearer <token>` (sauf `/auth/*`).
- Gestion des `401`: suppression token + callback `setUnauthorizedHandler()`.

**Recommandation (sécurité):** passer à `expo-secure-store` pour le token si le niveau de menace l’exige.

#### Partner/Slots (`context/PartnerContext.tsx`)
- Source de vérité: `partnerLinks`, `activeSlot`, `incomingInvites`, `hasSelectedSlot`.
- Polling toutes les **15s** pour refléter un slot `pending -> confirmed`.

**Risque perf/UX:** `setPartnerLinks(...)` à chaque tick, même si identique → re-render possible sur toutes les pages abonnées au contexte.

#### Challenge (`context/ChallengeContext.tsx`)
- `rawChallenge` + projection `currentChallenge` filtrée selon `activeSlot`.
- Données annexes: `pendingInvitations` (reçues), `pendingSentChallenge`.
- Polling:
  - **15s** normal
  - **3s** si une invitation DUO envoyée est pending

**Correctif récent (important):** réduction des re-renders inutiles en évitant les `setState` si les données n’ont pas changé (comparaison par signature). Cela adresse directement les symptômes “profil qui refresh/flash en boucle”.

#### Activities (`context/ActivityContext.tsx`)
- `activities` (solo) + `duoActivities` (shared), fetch conditionnel selon slot ou challenge DUO.
- Appelle `refreshChallenge()` après ajout/suppression.

**Risque perf:** dépendances `useCallback([... partnerLinks ...])` peuvent déclencher des re-fetch si `partnerLinks` change de référence (même sans changement réel).

### 3.3 Couche API (client)
- `services/api.ts`:
  - `API_URL` normalisé (termine par `/api` via `services/config.ts`).
  - `warmupServer()` hit `/health` (hors `/api`).
  - extraction d’erreurs plus fiable (réseau/timeout, shape express-validator, fallback).

**Point fort:** gestion claire des cas “backend en sleep”.

### 3.4 UX: verrouillage & onboarding
- Le repo implémente une sémantique slot stricte (solo vs duo) et des écrans verrouillés quand la configuration duo n’est pas prête (ou en attente). C’est cohérent et réduit les états impossibles.

---

## 4) Architecture Serveur (Express / MongoDB)

### 4.1 Composition
- `server/app.js`:
  - `cors()` + `express.json()` + routes.
  - routes: `/api/auth`, `/api/activities`, `/api/challenges`, `/api/users`, `/api/admin`.
  - `/health` public.
  - `errorHandler` global.

- `server/server.js`:
  - `connectDB()`
  - démarre des CRON jobs (`jobs/challengeCron`).

### 4.2 Auth
- `middleware/authMiddleware.js`: JWT Bearer, `jwt.verify`, `req.user` = user Mongo sans password.
- `utils/generateToken.js`: expiration **30d**.

**Recommandations (alignées audits 20/12):** réduire la durée, introduire refresh tokens, ajouter rate-limit.

### 4.3 API challenges
- Routes `server/routes/challengeRoutes.js`:
  - `/current`: si `slot` fourni, appelle `calculateProgress(userId, {slot})`, sinon `getCurrentChallenge(userId)`.
  - invitations/pending-sent/history/finalize.

**Observation:** le serveur renvoie `{success,data}` de façon assez régulière ici (bien), mais pas uniformément partout.

### 4.4 Erreurs
- `middleware/errorMiddleware.js` standardise `{success:false,message}` + `stack` en dev.

**Amélioration:** une partie des routes catchent et renvoient elles-mêmes (certaines en 400, d’autres en 500). Une standardisation plus stricte via `asyncHandler` éviterait la divergence.

---

## 5) Problèmes & dettes (priorisées)

### P0 — Critiques
1. **Route admin non protégée**: `GET /api/admin/fix-indexes`
   - aucune auth (`protect`) + exposition directe.
   - impact: modification d’index en prod, fuite d’infos (liste d’index), DoS potentiel.

2. **Gestion index DB au démarrage** (`server/config/db.js`)
   - drop d’index au runtime.
   - mieux: migration script / job unique (avec logs et contrôle).

3. **Sécurité HTTP**
   - `helmet` absent dans `server/app.js`.
   - `cors()` permissif.
   - pas de rate-limiting sur login/register.

### P1 — Importants
1. **Polling = re-render**
   - `PartnerContext` poll 15s: risque de re-render global si la réponse ne change pas.
   - `ActivityContext` dépend de `partnerLinks` (référence) + `currentChallenge?.mode`.

2. **Incohérence shapes d’API**
   - déjà partiellement adressé par `unwrapData()` côté challenges.
   - proposer une convention unique `{ success, data, message?, errors? }`.

3. **Logs**
   - côté serveur: certains logs incluent emails/objets complets.
   - côté client: logs fréquents peuvent dégrader perf en dev.

### P2 — Améliorations
- Renforcer validation (schemas + validators) sur activités/challenges.
- Augmenter couverture tests UI/business (client) au-delà de `WeekCountdown`.

---

## 6) Recommandations (plan d’action)

### Semaine 1 (P0)
- Protéger `/api/admin/*` (au minimum `protect`, idéalement rôle admin + disabled en prod).
- Remplacer la logique “drop index au démarrage” par un script de migration explicite (`server/scripts/`), exécuté manuellement/CI.
- Activer `helmet` + config CORS stricte (origins connus) + rate-limiting sur `/api/auth/login`.

### Semaine 2 (P1)
- Stabiliser polling Partner:
  - ne faire `setPartnerLinks`/`setIncomingInvites` que si les données ont changé (même approche que ChallengeContext).
- Standardiser responses (ou généraliser `unwrapData` à tous les services).

### Semaine 3+ (P2)
- Tests:
  - tests client sur flows critiques (auth guard, slots, locks, invitations), au moins unit tests des helpers + 1–2 tests d’intégration UI si possible.
- Sécurité:
  - réduire TTL JWT / refresh token,
  - stockage token via SecureStore (si requis).

---

## 7) Annexes — Fichiers clés à connaître

### Client
- `app/_layout.tsx` (guard)
- `services/api.ts` (axios + interceptors)
- `context/AuthContext.tsx`, `context/PartnerContext.tsx`, `context/ChallengeContext.tsx`, `context/ActivityContext.tsx`

### Serveur
- `server/app.js`, `server/server.js`
- `server/middleware/authMiddleware.js`, `server/middleware/errorMiddleware.js`
- `server/routes/*` (auth, users, challenges)
- `server/services/*` (challengeService, userService)

---

## 8) Delta depuis les audits du 20/12
- Stabilisation du “flash/refresh” sur Profil liée au polling challenges: évite les `setState` inutiles quand les réponses ne changent pas.
- UX: verrouillage de certains écrans quand slot duo non prêt / invitation en attente, et centralisation des invitations dans Profil.
