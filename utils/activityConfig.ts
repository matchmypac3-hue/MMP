// utils/activityConfig.ts

export type ActivityTypeKey =
  | "running"
  | "cycling"
  | "walking"
  | "swimming"
  | "workout"
  | "yoga";

interface ActivityConfig {
  label: string;
  icon: string;
  iconFamily: 'Ionicons' | 'MaterialCommunityIcons';
}

// ✅ ICÔNES MINIMALISTES ET ÉPURÉES
export const activityConfig: Record<ActivityTypeKey, ActivityConfig> = {
  running: {
    label: "Course",
    icon: "run-fast",  // ✅ Bonhomme qui court vers la droite
    iconFamily: "MaterialCommunityIcons",
  },
  cycling: {
    label: "Cyclisme",
    icon: "bicycle-outline",
    iconFamily: "Ionicons",
  },
  walking: {
    label: "Marche",
    icon: "walk-outline",
    iconFamily: "Ionicons",
  },
  swimming: {
    label: "Natation",
    icon: "water-outline",
    iconFamily: "Ionicons",
  },
  workout: {
    label: "Musculation",
    icon: "barbell-outline",
    iconFamily: "Ionicons",
  },
  yoga: {
    label: "Yoga",
    icon: "flower-outline",
    iconFamily: "Ionicons",
  },
};