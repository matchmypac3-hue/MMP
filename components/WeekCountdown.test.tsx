import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { WeekCountdown } from './WeekCountdown';
import { useWeekCountdown } from '../hooks/useWeekCountdown';

// Simuler (mock) le hook personnalisé pour contrôler ses valeurs
jest.mock('../hooks/useWeekCountdown');

describe('WeekCountdown Component', () => {

  it('should render the countdown timer with values from the hook', () => {
    // Fournir des valeurs de retour statiques pour le mock du hook
    const mockCountdownValues = {
      days: 3,
      hours: 12,
      minutes: 45,
      seconds: 30,
    };
    (useWeekCountdown as jest.Mock).mockReturnValue(mockCountdownValues);

    // Rendre le composant
    render(<WeekCountdown />);

    // Vérifier que les labels sont présents
    expect(screen.getByText('J')).toBeVisible();
    expect(screen.getByText('H')).toBeVisible();
    expect(screen.getByText('M')).toBeVisible();
    expect(screen.getByText('S')).toBeVisible();

    // Vérifier que les valeurs (formatées avec padStart) sont correctement affichées
    expect(screen.getByText('03')).toBeVisible();
    expect(screen.getByText('12')).toBeVisible();
    expect(screen.getByText('45')).toBeVisible();
    expect(screen.getByText('30')).toBeVisible();
  });

});
