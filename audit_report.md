# Rapport d'Audit du MVP

Ce document résume l'audit de la base de code du MVP. L'objectif est de s'assurer que les fondations sont solides, sécurisées et cohérentes avant d'ajouter de nouvelles fonctionnalités.

## 1. Backend

### 1.1. Sécurité et Authentification

- ✅ **JWT Verification (`authMiddleware.js`)**: La validation des tokens est correcte et sécurisée.
- ✅ **Génération de Token (`generateToken.js`)**: La génération est standard et robuste.
- ✅ **Hashage des Mots de Passe (`User.js`)**: Le hashage avec `bcryptjs` et "salting" est implémenté selon les meilleures pratiques.
- ⚠️ **Gestion des erreurs dans `authMiddleware.js`**: Si un token est invalide, le middleware peut essayer d'envoyer deux réponses, ce qui peut causer des erreurs.
  - 🛠️ **Action**: Ajouter un `return` après la première réponse d'erreur pour s'assurer que le code s'arrête.
    ```javascript
    // In server/middleware/authMiddleware.js
    try {
      // ...
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'Not authorized, token failed' }); // Ajouter return
    }
    ```

### 1.2. Modèles de Données et Endpoints

- ✅ **Structure des Modèles (`Activity.js`, `User.js`)**: Les schémas sont bien structurés.
- ✅ **Cohérence des Endpoints (`activityRoutes.js`, `authRoutes.js`)**: Les routes sont logiques, RESTful et bien sécurisées.
- ⚠️ **Validation des Données (Modèles)**: Il manque des validations cruciales dans les modèles Mongoose.
  - 🛠️ **Action**: Ajouter des validateurs pour les champs numériques et une longueur maximale pour les chaînes de caractères.
    ```javascript
    // In server/models/Activity.js
    duration: {
      type: Number,
      required: [true, 'Please add a duration in minutes'],
      min: [0, 'Duration must be a positive number'] // Ajouter cette validation
    },
    title: {
      type: String,
      required: [true, 'Please add a title'],
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters'] // Ajouter cette validation
    }
    ```
- ⚠️ **Validation des Entrées (Routes)**: Aucune validation n'est faite sur `req.body` avant de traiter la logique.
  - 🛠️ **Action**: Intégrer `express-validator` pour valider et assainir les entrées de toutes les routes `POST`.
    ```javascript
    // Example for server/routes/authRoutes.js
    const { body, validationResult } = require('express-validator');

    router.post(
      '/register',
      body('email').isEmail().normalizeEmail(),
      body('password').isLength({ min: 6 }),
      (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
        // ... rest of the logic
      }
    );
    ```

---

## 2. Frontend

### 2.1. Flux de Données et Gestion de l'État

- ✅ **Gestion de l'État (`ActivityContext.tsx`)**: Le contexte gère bien l'état global et les rechargements.
- ✅ **Calcul des Statistiques (`stats.tsx`)**: Très bonne utilisation de `useMemo` pour les performances.
- ⚠️ **Gestion des Erreurs Utilisateur**: Les erreurs (ex: échec d'ajout d'activité) sont loguées mais jamais montrées à l'utilisateur.
  - 🛠️ **Action**: Ajouter un état d'erreur dans `ActivityContext` et l'utiliser pour afficher un message (ex: Toast, Alert) à l'utilisateur.
    ```typescript
    // In context/ActivityContext.tsx
    const [error, setError] = useState<string | null>(null);

    // In addActivity catch block
    setError('Failed to add activity. Please try again.');
    ```
- ⚠️ **Gestion du Token JWT**: Le token est récupéré de `AsyncStorage` à chaque appel API.
  - 🛠️ **Action**: Stocker le token dans l'état de `AuthContext` au moment du login pour un accès synchrone et plus performant dans le reste de l'application.
- 🛠️ **Optimisation du Rechargement**: Après l'ajout, la liste entière est rechargée.
  - 🛠️ **Action**: Pour améliorer la réactivité, mettre à jour l'état localement avec la nouvelle activité retournée par l'API, au lieu de tout recharger.
    ```typescript
    // In context/ActivityContext.tsx's addActivity
    const newActivity = await activityService.addActivity(newActivityData, token);
    setActivities(prevActivities => [newActivity, ...prevActivities]);
    // Plus besoin de `await loadActivities();`
    ```

### 2.2. Interface Utilisateur (UX)

- ✅ **Layout Général**: L'interface est propre et intuitive.
- ⚠️ **Feedback de Soumission (`ActivityForm.tsx`)**: Aucun feedback visuel pendant l'appel API.
  - 🛠️ **Action**: Ajouter un état de chargement local au formulaire pour désactiver le bouton "AJOUTER" et afficher un spinner pendant la soumission.
- ⚠️ **Validation Côté Client**: Validation minimale dans le formulaire.
  - 🛠️ **Action**: Ajouter une validation plus robuste (ex: vérifier que la durée est un nombre positif) avant d'activer le bouton de soumission.
- ⚠️ **Cohérence des Dates (`stats.tsx`)**: Le filtre "semaine" correspond aux 7 derniers jours et non à une semaine calendaire.
  - 🛠️ **Action**: Renommer le filtre en "7 derniers jours" pour plus de clarté, ou implémenter une logique de semaine calendaire si nécessaire.

---

## Conclusion

Le MVP est très bien construit et repose sur des bases solides. La plupart des points sont des améliorations et des renforcements plutôt que des corrections de bugs critiques.

**Prochaines étapes recommandées :**
1.  Corriger la gestion d'erreur dans le middleware.
2.  Ajouter les validations manquantes dans le backend (modèles et routes).
3.  Améliorer la gestion des erreurs et des chargements dans le frontend.
