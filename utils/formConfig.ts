// utils/formConfig.ts

import type { ActivityTypeKey } from './activityConfig';

export type { ActivityTypeKey };

interface FormConfig {
  label: string;
  icon: string;
  fields: ("distance" | "elevationGain" | "exercises" | "poolLength" | "laps")[];
}

export const formConfig: Record<ActivityTypeKey, FormConfig> = {
  running: {
    label: "Course",
    icon: "🏃",
    fields: ["distance", "elevationGain"],
  },
  cycling: {
    label: "Cyclisme",
    icon: "🚴",
    fields: ["distance", "elevationGain"],
  },
  walking: {
    label: "Marche",
    icon: "🚶",
    fields: ["distance"],
  },
  swimming: {
    label: "Natation",
    icon: "🏊",
    fields: ["distance", "poolLength", "laps"],
  },
  workout: {
    label: "Musculation",
    icon: "🏋️",
    fields: ["exercises"],
  },
  yoga: {
    label: "Yoga",
    icon: "🧘",
    fields: [],
  },
};
