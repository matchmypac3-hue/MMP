// utils/challengeHelpers.ts

import { activityConfig, ActivityTypeKey } from './activityConfig';
import { ChallengeGoalType } from '../types/Challenge';
import { activityFormatters } from './activityFormatters';

export function generateChallengeTitle(
  activityTypes: ActivityTypeKey[],
  goalType: ChallengeGoalType,
  goalValue: number
): string {
  // Formater la valeur
  let valueText = '';
  switch (goalType) {
    case 'distance':
      valueText = `${goalValue} km`;
      break;
    case 'duration':
      valueText = activityFormatters.formatDuration(goalValue);
      break;
    case 'count':
      valueText = `${goalValue} activité${goalValue > 1 ? 's' : ''}`;
      break;
  }

  // Formater les types d'activités
  let activityText = '';
  if (activityTypes.length === 1) {
    activityText = activityConfig[activityTypes[0]].label.toLowerCase();
  } else if (activityTypes.length === 2) {
    activityText = activityTypes
      .map(t => activityConfig[t].label.toLowerCase())
      .join(' et ');
  } else if (activityTypes.length === Object.keys(activityConfig).length) {
    activityText = 'sport';
  } else {
    activityText = 'multi-sports';
  }

  // Construire le titre
  if (goalType === 'distance') {
    return `${valueText} en ${activityText}`;
  } else if (goalType === 'duration') {
    return `${valueText} de ${activityText}`;
  } else {
    return `${valueText} de ${activityText}`;
  }
}