module.exports = {
  // --- Configuration multi-environnement ---
  // Utilise la configuration par "projets" pour gérer les environnements
  // de test distincts pour le client (jsdom) et le serveur (node).
  projects: [
    // Configuration pour les tests frontend
    {
      displayName: 'client',
      preset: 'jest-expo',
      setupFilesAfterEnv: ['./jest.setup.js'],
      transformIgnorePatterns: [
        "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
      ],
      testMatch: [
        '<rootDir>/components/**/*.test.tsx',
        '<rootDir>/hooks/**/*.test.ts',
      ],
    },
    // Configuration pour les tests backend
    {
      displayName: 'server',
      testEnvironment: 'node', // Utilise l'environnement Node.js
      setupFilesAfterEnv: ['./server/__tests__/setup.js'],
      testMatch: ['<rootDir>/server/__tests__/**/*.test.js'],
    },
  ],
  testTimeout: 30000, // Augmente le timeout global à 30s
};
