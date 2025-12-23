import { Activity } from '../types/Activity';

/**
 * Helpers pour formater l'affichage des activités
 */

export const activityFormatters = {
  /**
   * Formate la durée en heures/minutes
   */
  formatDuration: (minutes: number): string => {
    if (minutes < 1) {
      return "< 1min";
    }
    if (minutes < 60) {
      return `${Math.round(minutes)}min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  },
  
  /**
   * Formate la distance
   */
  formatDistance: (km: number): string => {
    return `${km.toFixed(2)} km`;
  },

  /**
   * Formate le dénivelé
   */
  formatElevation: (meters: number): string => {
    return `D+ ${meters}m`;
  },

  /**
   * Formate la vitesse moyenne
   */
  formatSpeed: (kmh: number): string => {
    return `${kmh.toFixed(1)} km/h`;
  },

  /**
   * Formate la date et l'heure
   */
  formatDateTime: (date: string): { date: string; time: string } => {
    const d = new Date(date);
    return {
      date: d.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: 'short',
        year: 'numeric'
      }),
      time: d.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
    };
  },

  /**
   * Résumé condensé des exercices pour la muscu
   */
  formatExerciseSummary: (exercises?: Array<{
    name: string;
    sets?: number;
    reps?: number;
    weight?: number;
  }>): string => {
    if (!exercises || exercises.length === 0) {
      return 'Aucun exercice';
    }

    if (exercises.length === 1) {
      const ex = exercises[0];
      return `${ex.name}${ex.sets ? ` - ${ex.sets}×${ex.reps || '?'}` : ''}`;
    }

    // Plus d'un exercice : affiche le nombre
    return `${exercises.length} exercices (${exercises.map(e => e.name).join(', ')})`;
  },

  /**
   * Obtient les statistiques à afficher selon le type
   */
  getActivityStats: (activity: Activity): Array<{ label: string; value: string; icon: string }> => {
    const stats: Array<{ label: string; value: string; icon: string }> = [
      {
        label: 'Durée',
        value: activityFormatters.formatDuration(activity.duration),
        icon: '⏱️',
      },
    ];

    // Distance (running, cycling, walking, swimming)
    if (activity.distance) {
      stats.push({
        label: 'Distance',
        value: activityFormatters.formatDistance(activity.distance),
        icon: '📏',
      });
    }

    // Dénivelé (running, cycling)
    if (activity.elevationGain) {
      stats.push({
        label: 'Dénivelé',
        value: activityFormatters.formatElevation(activity.elevationGain),
        icon: '⛰️',
      });
    }

    // Vitesse moyenne
    if (activity.avgSpeed) {
      stats.push({
        label: 'Vitesse moy.',
        value: activityFormatters.formatSpeed(activity.avgSpeed),
        icon: '⚡',
      });
    }

    // Piscine (swimming)
    if (activity.poolLength) {
      stats.push({
        label: 'Bassin',
        value: `${activity.poolLength}m`,
        icon: '🏊',
      });
    }

    if (activity.laps) {
      stats.push({
        label: 'Longueurs',
        value: `${activity.laps}`,
        icon: '🔄',
      });
    }

    return stats;
  },
};