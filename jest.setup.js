// Importe les matchers Jest étendus de React Native Testing Library
// Cela ajoute des assertions utiles comme .toBeVisible(), .toHaveTextContent(), etc.
import '@testing-library/jest-native/extend-expect';

// --- Mocks pour les modules natifs ou les bibliothèques complexes ---

// Mock pour @react-native-async-storage/async-storage
// Essentiel pour les tests qui interagissent avec le stockage local
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock pour expo-router
// Permet de tester les composants qui utilisent des fonctionnalités de navigation
jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return {
    ...actual,
    useRouter: jest.fn(() => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    })),
    useLocalSearchParams: jest.fn(() => ({})),
    useGlobalSearchParams: jest.fn(() => ({})),
    Link: 'Link', // Rend les composants Link comme de simples chaînes
  };
});
