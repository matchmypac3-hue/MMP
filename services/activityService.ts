// services/activityService.ts

import api from "./api";
import { Activity } from "../types/Activity";
import { AxiosError } from "axios";

export const activityService = {
  getActivities: async (token: string): Promise<Activity[]> => {
    try {
      console.log('🔐 [activityService] getActivities token:', token ? 'present' : 'absent');
      const response = await api.get("/activities");
      return response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.message;
      console.error('❌ [activityService] Failed to get activities', { status, message });
      throw error;
    }
  },

  getSharedActivitiesWithPartner: async (
    token: string,
    partnerId: string,
  ): Promise<Activity[]> => {
    try {
      console.log('🔐 [activityService] getSharedActivities token:', token ? 'present' : 'absent', 'partnerId:', partnerId);
      const response = await api.get(`/activities/shared/${partnerId}`);
      return response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.message;
      console.error('❌ [activityService] Failed to get shared activities', { status, message });
      throw error;
    }
  },

  getCurrentDuoChallengeActivities: async (token: string): Promise<Activity[]> => {
    try {
      console.log('🔐 [activityService] getDuoChallengeActivities token:', token ? 'present' : 'absent');
      const response = await api.get('/activities/duo/current');
      return response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.message;
      console.error('❌ [activityService] Failed to get duo challenge activities', { status, message });
      throw error;
    }
  },

  addActivity: async (
    activityData: Omit<Activity, "id" | "_id">,
    token: string,
  ): Promise<Activity> => {
    try {
      console.log('🔐 [activityService] addActivity token:', token ? 'present' : 'absent');
      const response = await api.post("/activities", activityData);
      return response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.message;
      console.error('❌ [activityService] Failed to add activity', { status, message });
      throw error;
    }
  },

  deleteActivity: async (id: string, token: string): Promise<void> => {
    try {
      console.log('🔐 [activityService] deleteActivity token:', token ? 'present' : 'absent', 'id:', id);
      await api.delete(`/activities/${id}`);
      console.log("✅ ACTIVITÉ SUPPRIMÉE:", id);
    } catch (error: any) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.message;
      console.error('❌ [activityService] Failed to delete activity', { status, message });
      throw error;
    }
  },
};