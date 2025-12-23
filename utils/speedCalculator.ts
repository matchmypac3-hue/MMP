export type ActivityType = 'cycling' | 'running' | 'walking' | 'swimming';

/**
 * Calcule la vitesse/allure selon le type d'activité
 */
export const calculateSpeed = (
  distance: number | undefined,
  duration: number | undefined,
  type: string
): { value: string; label: string } | null => {
  if (!distance || !duration || distance <= 0 || duration <= 0) {
    return null;
  }

  const durationInHours = duration / 60;

  switch (type) {
    case 'cycling':
      // Vitesse en km/h
      const kmh = (distance / durationInHours).toFixed(1);
      return { value: `${kmh} km/h`, label: 'Vitesse moyenne' };

    case 'running':
    case 'walking':
      // Allure en min/km
      const minPerKm = duration / distance;
      const mins = Math.floor(minPerKm);
      const secs = Math.round((minPerKm - mins) * 60);
      return { 
        value: `${mins}:${secs.toString().padStart(2, '0')} /km`, 
        label: 'Allure moyenne' 
      };

    case 'swimming':
      // Allure en min/100m
      const minPer100m = duration / (distance * 10);
      const swimMins = Math.floor(minPer100m);
      const swimSecs = Math.round((minPer100m - swimMins) * 60);
      return { 
        value: `${swimMins}:${swimSecs.toString().padStart(2, '0')} /100m`, 
        label: 'Allure moyenne' 
      };

    default:
      return null;
  }
};