import { ActivityTypeKey } from "../utils/activityConfig";

export type ActivityUserRef =
  | string
  | {
      _id: string;
      email?: string;
    };

export interface Activity {
  _id?: string;
  id: string;
  userId?: string;
  // Champ renvoyé par l'API (Mongo/Mongoose)
  user?: ActivityUserRef;
  title: string;
  type: ActivityTypeKey;
  duration: number; // in minutes
  distance?: number; // in km
  elevationGain?: number; // D+ en mètres
  date: string; // ISO 8601
  exercises?: { name: string; sets?: number; reps?: number; weight?: number }[];
  startTime?: string;
  endTime?: string;
  source?: 'manual' | 'tracked';
  avgSpeed?: number;
  poolLength?: number;
  laps?: number;

  // Métadonnées import (Apple Health / Health Connect)
  externalSource?: 'appleHealth' | 'healthConnect';
  externalId?: string;

  // Champs Mongoose timestamps (présents côté API)
  createdAt?: string;
  updatedAt?: string;
}