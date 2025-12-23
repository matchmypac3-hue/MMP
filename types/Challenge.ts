// types/Challenge.ts

import type { ActivityTypeKey } from '../utils/activityConfig';

export type ChallengeGoalType = 'distance' | 'duration' | 'count';
export type ChallengeMode = 'solo' | 'duo';
export type ChallengeStatus = 'pending' | 'active' | 'completed' | 'failed' | 'cancelled';
export type InvitationStatus = 'none' | 'pending' | 'accepted' | 'refused';

// ✅ Joueur dans un challenge
export interface ChallengePlayer {
  user: string | {
    _id: string;
    username?: string;
    email: string;
    totalDiamonds?: number;
  };
  progress: number;
  diamonds: number;
  completed: boolean;
}

// ✅ Objectif du challenge
export interface ChallengeGoal {
  type: ChallengeGoalType;
  value: number;
}

// ✅ Progression (rétrocompatibilité SOLO)
export interface ChallengeProgress {
  current: number;
  goal: number;
  percentage: number;
  isCompleted: boolean;
}

// ✅ Challenge complet (SOLO + DUO)
export interface Challenge {
  _id: string;
  mode: ChallengeMode;
  creator: string;
  players: ChallengePlayer[];
  goal: ChallengeGoal;
  activityTypes: ActivityTypeKey[];
  title: string;
  icon: string;
  startDate: string;
  endDate: string;
  status: ChallengeStatus;
  bonusEarned: boolean;
  bonusAwarded: boolean;
  invitationStatus: InvitationStatus;
  progress?: ChallengeProgress;  // Virtual (pour SOLO)
  createdAt: string;
  updatedAt: string;
  user?: string;  // Rétrocompatibilité
}

// ✅ Données pour créer un challenge SOLO
export interface CreateSoloChallengeData {
  mode: 'solo';
  goal: ChallengeGoal;
  activityTypes: ActivityTypeKey[];
  title: string;
  icon: string;
}

// ✅ Données pour créer un challenge DUO
export interface CreateDuoChallengeData {
  mode: 'duo';
  partnerId: string;
  goal: ChallengeGoal;
  activityTypes: ActivityTypeKey[];
  title: string;
  icon: string;
}

// ✅ Union type pour la création
export type CreateChallengeData = CreateSoloChallengeData | CreateDuoChallengeData;

// ✅ Mise à jour (même structure)
export interface UpdateChallengeData {
  goal: ChallengeGoal;
  activityTypes: ActivityTypeKey[];
  title: string;
  icon: string;
}