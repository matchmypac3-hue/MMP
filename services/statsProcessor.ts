// services/statsProcessor.ts

import { Activity } from '../types/Activity';
import type { ActivityTypeKey } from '../utils/activityConfig';

export interface GlobalStats {
  totalActivities: number;
  totalDuration: number;
  totalDistance: number;
  averageDuration: number;
  durationByType: Record<ActivityTypeKey, number>;
  distanceByType: Record<ActivityTypeKey, number>;
  longestActivity?: Activity;
}

export interface ExtendedStats extends GlobalStats {
  totalElevationGain: number;
  averageSpeedKmh: number; // average over activities where speed can be computed
  bestDistanceKm: number;
  bestDurationMin: number;
  bestElevationGain: number;
  totalLaps: number;
  totalExercises: number;
}

const initializeTypeStats = (): Record<ActivityTypeKey, number> => ({
  running: 0,
  cycling: 0,
  walking: 0,
  swimming: 0,
  workout: 0,
  yoga: 0,
});

export const statsProcessor = {
  calculateGlobalStats(activities: Activity[]): GlobalStats {
    if (!activities || activities.length === 0) {
      return {
        totalActivities: 0,
        totalDuration: 0,
        totalDistance: 0,
        averageDuration: 0,
        durationByType: initializeTypeStats(),
        distanceByType: initializeTypeStats(),
      };
    }

    const stats = activities.reduce(
      (acc, activity) => {
        // ✅ CORRIGÉ : Pas besoin de vérifier config.fields
        // On traite directement duration et distance
        
        // Durée (toutes les activités ont une durée)
        acc.totalDuration += activity.duration || 0;
        if (activity.type in acc.durationByType) {
          acc.durationByType[activity.type as ActivityTypeKey] += activity.duration || 0;
        }

        // Distance (seulement si présente)
        if (activity.distance) {
          acc.totalDistance += activity.distance;
          if (activity.type in acc.distanceByType) {
            acc.distanceByType[activity.type as ActivityTypeKey] += activity.distance;
          }
        }

        // Activité la plus longue
        if (!acc.longestActivity || activity.duration > acc.longestActivity.duration) {
          acc.longestActivity = activity;
        }

        return acc;
      },
      {
        totalDuration: 0,
        totalDistance: 0,
        durationByType: initializeTypeStats(),
        distanceByType: initializeTypeStats(),
        longestActivity: undefined as Activity | undefined,
      }
    );

    return {
      totalActivities: activities.length,
      totalDuration: stats.totalDuration,
      totalDistance: stats.totalDistance,
      averageDuration: stats.totalDuration / activities.length,
      durationByType: stats.durationByType,
      distanceByType: stats.distanceByType,
      longestActivity: stats.longestActivity,
    };
  },

  calculateExtendedStats(activities: Activity[]): ExtendedStats {
    const base = this.calculateGlobalStats(activities);

    let totalElevationGain = 0;
    let totalLaps = 0;
    let totalExercises = 0;

    let bestDistanceKm = 0;
    let bestDurationMin = 0;
    let bestElevationGain = 0;

    let speedSum = 0;
    let speedCount = 0;

    for (const activity of activities || []) {
      const elevation = activity.elevationGain || 0;
      totalElevationGain += elevation;
      if (elevation > bestElevationGain) bestElevationGain = elevation;

      const dist = activity.distance || 0;
      if (dist > bestDistanceKm) bestDistanceKm = dist;

      const dur = activity.duration || 0;
      if (dur > bestDurationMin) bestDurationMin = dur;

      const laps = activity.laps || 0;
      totalLaps += laps;

      const exercises = Array.isArray(activity.exercises) ? activity.exercises.length : 0;
      totalExercises += exercises;

      // Prefer explicit avgSpeed if present, else derive from distance/duration.
      const speed =
        typeof activity.avgSpeed === 'number' && !Number.isNaN(activity.avgSpeed)
          ? activity.avgSpeed
          : dist > 0 && dur > 0
            ? dist / (dur / 60)
            : null;

      if (typeof speed === 'number' && Number.isFinite(speed) && speed > 0) {
        speedSum += speed;
        speedCount += 1;
      }
    }

    return {
      ...base,
      totalElevationGain,
      averageSpeedKmh: speedCount > 0 ? speedSum / speedCount : 0,
      bestDistanceKm,
      bestDurationMin,
      bestElevationGain,
      totalLaps,
      totalExercises,
    };
  },
};