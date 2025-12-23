# 📘 AUDIT DÉTAILLÉ - SPÉCIFICATIONS TECHNIQUES

---

# 🔐 SÉCURITÉ - DÉTAILS

## 1. Authentification & Autorisation

### JWT Implementation
**Fichier:** `server/utils/generateToken.js`

```javascript
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'  // ⚠️ À vérifier
  });
};
```

**Problèmes Identifiés:**
- Durée d'expiration: 30 jours (trop long)
- Pas de refresh token
- Pas de revocation list
- Secret stocké en variable d'environnement ✅

**Recommandation:**
```javascript
// Réduire à 24h avec refresh token
const generateTokens = (id) => {
  const accessToken = jwt.sign({ id, type: 'access' }, 
    process.env.JWT_SECRET, 
    { expiresIn: '24h' }
  );
  
  const refreshToken = jwt.sign({ id, type: 'refresh' }, 
    process.env.REFRESH_TOKEN_SECRET, 
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};
```

### Password Hashing
**Fichier:** `server/controllers/authController.js`

```javascript
const hashedPassword = await bcrypt.hash(password, 10);
// ✅ Bon: Salting automatique avec cost factor 10
```

**Sécurité:** ✅ Satisfaisante

---

## 2. Vulnerabilités Spécifiques

### A. SQL Injection
**Status:** ✅ Non Vulnérable
- Mongoose échappe automatiquement
- Pas de requêtes brutes SQL

### B. XSS (Cross-Site Scripting)
**Status:** ⚠️ À Risque
**Raison:** Helmet.js non activé
```javascript
// ❌ Actuellement dans server/app.js
// app.use(helmet()); // MANQUE

// ✅ À ajouter
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  },
  hsts: {
    maxAge: 31536000, // 1 an
    includeSubDomains: true,
    preload: true
  }
}));
```

### C. CSRF (Cross-Site Request Forgery)
**Status:** ✅ Partiellement Protégé
- JWT utilisé (stateless)
- CORS configuré
- À renforcer avec CSRF tokens

### D. Brute Force
**Status:** 🔴 CRITIQUE - Non Protégé

```javascript
// ❌ Manque dans server/app.js
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives
  message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Trop de tentatives. Réessayez plus tard.'
    });
  }
});

router.post('/login', loginLimiter, authController.login);
```

### E. CORS Misconfiguration
**Fichier:** `server/app.js`

```javascript
app.use(cors()); // ✅ Fonctionnel mais permissif

// ✅ À améliorer
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:19006',
  credentials: true,
  optionsSuccessStatus: 200
}));
```

---

## 3. Données Sensibles

### Token Storage
**Frontend:** AsyncStorage
```typescript
// services/api.ts
await AsyncStorage.setItem('userToken', response.data.token);
```
**Status:** ✅ Bon pour React Native
- AsyncStorage est chiffré sur iOS (Keychain)
- Pas directement accessible

**À Améliorer:**
- Utiliser `expo-secure-store` pour plus de sécurité
```typescript
import * as SecureStore from 'expo-secure-store';

await SecureStore.setItemAsync('userToken', token);
```

### Environment Variables
**Backend (.env):**
```
MONGODB_URI=...
JWT_SECRET=... ✅ Bien caché
PORT=...
NODE_ENV=...
```

**Status:** ✅ Bon pratiques

---

# 📊 MODÈLES DE DONNÉES - DÉTAILS

## 1. User Model Issues

### Email Validation
```javascript
// ❌ Actuel
email: {
  type: String,
  unique: true,
  required: true
}

// ✅ Recommandé
email: {
  type: String,
  unique: true,
  required: [true, 'Email requis'],
  lowercase: true,
  trim: true,
  validate: {
    validator: function(v) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    },
    message: 'Email invalide'
  }
}
```

### Password Constraints
```javascript
// ❌ Manque de validation côté schéma
password: {
  type: String,
  required: true
}

// ✅ Ajouter validation (mais côté controller est mieux)
// Min 8 chars, 1 majuscule, 1 chiffre, 1 special char
```

## 2. Activity Model - Constraints Manquants

### Duration
```javascript
// ❌ Actuel
duration: {
  type: Number,
  required: true,
  min: 0
}

// ✅ Recommandé
duration: {
  type: Number,
  required: [true, 'Durée requise'],
  min: [1, 'Durée minimale: 1 minute'],
  max: [1440, 'Durée maximale: 24h'],
  validate: {
    validator: Number.isInteger,
    message: 'La durée doit être un nombre entier'
  }
}
```

### Distance
```javascript
// ✅ Actuel est correct
distance: {
  type: Number,
  min: [0.01, 'Distance minimale: 0.01 km']
}
```

### Type Enum
```javascript
// ✅ Bon
type: {
  type: String,
  required: true,
  enum: {
    values: ['cycling', 'running', 'walking', 'swimming', 'workout', 'yoga'],
    message: 'Type d\'activité invalide'
  }
}
```

## 3. Index MongoDB

```javascript
// server/models/Activity.js - À ajouter
activitySchema.index({ user: 1, date: -1 });
activitySchema.index({ user: 1, type: 1 });
activitySchema.index({ date: 1 });

// server/models/WeeklyChallenge.js - À ajouter
weeklyChallengeSchema.index({ user: 1, endDate: 1 });
```

---

# 🛣️ API ENDPOINTS - DÉTAILS

## 1. POST /auth/register

### Requête Attendue
```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

### Validation Côté Backend
**Fichier:** Manque un validateur

```javascript
// ❌ Actuellement pas de validation
// ✅ À ajouter
const { body, validationResult } = require('express-validator');

router.post('/register', 
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .matches(/[A-Z]/).withMessage('Au moins 1 majuscule')
    .matches(/[0-9]/).withMessage('Au moins 1 chiffre')
    .matches(/[!@#$%^&*]/).withMessage('Au moins 1 caractère spécial'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  authController.register
);
```

### Réponse Attendue
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "_id": "507f1f77bcf86cd799439011",
  "email": "user@example.com"
}
```

## 2. POST /auth/login

### Requête Attendue
```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

### ⚠️ Rate Limiting Manquant
- **Impact:** Brute force possible
- **Fixme:** 5 tentatives / 15 minutes

### Réponse Attendue (200)
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "_id": "507f1f77bcf86cd799439011",
  "email": "user@example.com"
}
```

### Réponse Erreur (401)
```json
{
  "success": false,
  "message": "Identifiants invalides"
}
```

## 3. POST /activities

### Requête Attendue
```json
{
  "title": "Course du matin",
  "type": "running",
  "duration": 45,
  "date": "2025-12-20T08:00:00Z",
  "distance": 5.2,
  "elevationGain": 150,
  "source": "manual"
}
```

### Validations Backend
```javascript
// ✅ Existant mais vérifier
const validateCreateActivity = [
  body('title').trim().isLength({ min: 3, max: 100 }),
  body('type').isIn(['cycling', 'running', 'walking', 'swimming', 'workout', 'yoga']),
  body('duration').isFloat({ min: 1, max: 1440 }),
  body('date').isISO8601(),
  // Conditionnels:
  body('distance').if((value, { req }) => ['running', 'cycling', 'walking', 'swimming'].includes(req.body.type))
    .notEmpty().isFloat({ min: 0.01, max: 1000 })
];
```

## 4. GET /activities?type=running&page=1&limit=20

### ⚠️ Pagination Manquante
**Problème:** Pas de limit/skip
```javascript
// ❌ Actuel
const activities = await Activity.find(query);

// ✅ Recommandé
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 20;
const activities = await Activity
  .find(query)
  .limit(limit)
  .skip((page - 1) * limit)
  .sort({ date: -1 });
```

---

# 🧪 TESTS - DÉTAILS

## Backend Tests Coverage

### Fichiers Testés
```
server/__tests__/
├── activities.test.js         ✅ Test CRUD activités
├── challenges.test.js         ✅ Test CRUD challenges
├── validation.test.js         ✅ Test validateurs
└── helpers/authHelper.js      ✅ Helper d'auth
```

### Exemple Test - POST /activities

```javascript
// ❌ Test manquant
describe('POST /activities', () => {
  it('devrait créer une activité avec les champs valides', async () => {
    const res = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Course test',
        type: 'running',
        duration: 45,
        date: new Date().toISOString(),
        distance: 5.2
      });
    
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('_id');
    expect(res.body.title).toBe('Course test');
  });
  
  it('devrait rejeter sans titre', async () => {
    const res = await request(app)
      .post('/api/activities')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'running',
        duration: 45,
        distance: 5.2
      });
    
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
```

## Frontend Tests Coverage

### Fichiers Testés
```
components/
└── WeekCountdown.test.tsx     ✅ 1 test minimal
```

### Exemple Test - ActivityForm

```typescript
// ❌ Tests manquants
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ActivityForm } from '../ActivityForm';
import { ActivityProvider } from '../../context/ActivityContext';
import { ChallengeProvider } from '../../context/ChallengeContext';

describe('ActivityForm', () => {
  const Wrapper = ({ children }) => (
    <ActivityProvider>
      <ChallengeProvider>
        {children}
      </ChallengeProvider>
    </ActivityProvider>
  );
  
  it('devrait désactiver le bouton AJOUTER si duration est vide', () => {
    render(<ActivityForm onClose={() => {}} />, { wrapper: Wrapper });
    
    const button = screen.getByText('AJOUTER');
    expect(button).toBeDisabled();
  });
  
  it('devrait activer le bouton quand tous les champs requis sont remplis', async () => {
    const { getByPlaceholderText, getByText } = render(
      <ActivityForm onClose={() => {}} />,
      { wrapper: Wrapper }
    );
    
    fireEvent.changeText(getByPlaceholderText('Titre de l\'activité'), 'Course test');
    fireEvent.changeText(getByPlaceholderText('Durée (minutes)'), '45');
    
    await waitFor(() => {
      expect(getByText('AJOUTER')).not.toBeDisabled();
    });
  });
  
  it('devrait afficher les champs de distance pour running', async () => {
    const { getByDisplayValue, getByPlaceholderText } = render(
      <ActivityForm onClose={() => {}} />,
      { wrapper: Wrapper }
    );
    
    // Assuming type picker default is 'running'
    expect(getByPlaceholderText('Distance (km)')).toBeVisible();
  });
});
```

---

# 📱 FRONTEND - ARCHITECTURE DÉTAILLÉE

## 1. App Router Structure

```
app/
├── _layout.tsx              # Root layout avec providers
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx
│   └── register.tsx
├── (tabs)/
│   ├── _layout.tsx          # Tab bar layout
│   ├── index.tsx            # Home + Activities
│   └── stats.tsx            # Statistics
├── activities/
│   └── [id].tsx             # Activity detail
├── settings.tsx             # Settings
└── users.tsx                # User list (admin?)
```

## 2. Context Hooks

### useActivities()
```typescript
interface ActivityContextType {
  activities: Activity[];
  addActivity: (data: Omit<Activity, 'id'>) => Promise<void>;
  removeActivity: (id: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

// Usage
const { activities, addActivity, error } = useActivities();
```

### useChallenge()
```typescript
interface ChallengeContextType {
  currentChallenge: Challenge | null;
  createChallenge: (data: CreateChallengeData) => Promise<void>;
  updateChallenge: (data: UpdateChallengeData) => Promise<void>;
  deleteChallenge: () => Promise<void>;
  refreshChallenge: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

// Usage
const { currentChallenge, refreshChallenge } = useChallenge();
```

### useAuth()
```typescript
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string | null;
}

// Usage
const { user, login, logout } = useAuth();
```

## 3. Types TypeScript

### Activity Type
```typescript
export interface Activity {
  _id?: string;
  id: string;
  title: string;
  type: 'running' | 'cycling' | 'walking' | 'swimming' | 'workout' | 'yoga';
  duration: number; // minutes
  distance?: number; // km
  elevationGain?: number; // meters
  date: string; // ISO string
  exercises?: Exercise[];
  source?: 'manual' | 'tracked';
  avgSpeed?: number;
  poolLength?: number;
  laps?: number;
}

export interface Exercise {
  name: string;
  sets?: number;
  reps?: number;
  weight?: number;
}
```

### Challenge Type
```typescript
export interface Challenge {
  _id?: string;
  id: string;
  title: string;
  goal: {
    type: 'distance' | 'duration' | 'count';
    value: number;
  };
  progress: {
    current: number;
    percentage: number;
    isCompleted: boolean;
  };
  activityTypes: string[];
  startDate: string;
  endDate: string;
  icon: string;
}
```

---

# 🔧 PROBLÈMES SPÉCIFIQUES & FIXES

## Problème 1: Challenge Progression Ne S'Met Pas à Jour

### Root Cause
```javascript
// ❌ Avant: Dates de challenge incorrectes
const nextMonday = new Date(now);
nextMonday.setDate(now.getDate() + daysUntilMonday); // Could be in 8 days!

const followingMonday = new Date(nextMonday);
followingMonday.setDate(nextMonday.getDate() + 7);

// L'activité d'aujourd'hui ne rentre pas dans nextMonday -> followingMonday
```

### Fix Appliqué
```javascript
// ✅ Après: Dates correctes
const now = new Date();
const startDate = new Date(now);
startDate.setHours(0, 0, 0, 0); // Début du jour actuel

const endDate = new Date(now);
endDate.setDate(now.getDate() + 7);
endDate.setHours(23, 59, 59, 999); // Fin du jour 7 jours plus tard
```

## Problème 2: Structure Goal Incorrecte

### Root Cause
```typescript
// ❌ Avant: Accès direct
currentChallenge.goalValue
currentChallenge.goalType

// Mais le modèle a:
goal: {
  type: ChallengeGoalType;
  value: number;
}
```

### Fix Appliqué
```typescript
// ✅ Après: Accès à la structure imbriquée
currentChallenge.goal.value
currentChallenge.goal.type
```

## Problème 3: Refresh Challenge Non Appelé

### Root Cause
```typescript
// ❌ Avant: ActivityContext essayait d'appeler useChallenge()
// Violation des règles React hooks
let refreshChallenge = undefined;
try {
  const challengeContext = useChallenge(); // ❌ Appel hook au niveau provider
  refreshChallenge = challengeContext.refreshChallenge;
} catch {}
```

### Fix Appliqué
```typescript
// ✅ Après: ActivityForm importe ChallengeContext directement
const { refreshChallenge } = useChallenge();

// Après ajout d'activité:
await addActivity(activityData);
await refreshChallenge(); // ✅ Met à jour le challenge
```

---

# 📈 PERFORMANCE METRICS

## Frontend Bundle Size (Estimé)
```
Main Bundle:    ~800 KB
Expo Libraries: ~500 KB
React Native:   ~300 KB
Other:          ~200 KB
Total:          ~1.8 MB
```

**Recommendation:** < 2MB ✅ Acceptable

## Backend Response Times (Cible)
```
GET /activities         : < 200ms
POST /activities        : < 300ms
POST /challenges        : < 200ms
GET /challenges/current : < 150ms
```

**Monitoring:** Pas implémenté - À faire

## Database Queries
```
Per request avg: 1-2 queries
N+1 problems: ✅ None identified
Indices: ⚠️ À vérifier et ajouter
```

---

# 🚀 DEPLOYMENT CHECKLIST

## Frontend (Expo)
- [ ] Tester sur iOS et Android
- [ ] Build production: `expo build`
- [ ] Upload sur Apple App Store et Google Play Store
- [ ] Environment variables correctes (API_URL)
- [ ] Analytics (Sentry, Crashlytics)

## Backend (Node/Express)
- [ ] Helmet.js activé
- [ ] Rate limiting implémenté
- [ ] Environment variables sécurisées
- [ ] MongoDB en cluster (production)
- [ ] HTTPS/SSL activé
- [ ] Logs structurés (Winston, Morgan)
- [ ] Monitoring (New Relic, DataDog)
- [ ] Backup quotidien

## Database (MongoDB)
- [ ] Replica set pour HA
- [ ] Backups automatiques
- [ ] Indices créés
- [ ] Connection pooling
- [ ] Monitoring

---

**Fin de l'audit technique détaillé**
