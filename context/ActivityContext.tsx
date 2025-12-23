// context/ActivityContext.tsx

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Activity } from "../types/Activity";
import { activityService } from "../services/activityService";
import { useAuth } from "./AuthContext";
import { useChallenge } from "./ChallengeContext";
import { usePartner } from "./PartnerContext";

interface ActivityContextType {
  activities: Activity[];
  duoActivities: Activity[]; // Partner's activities for current duo slot
  addActivity: (activityData: Omit<Activity, "id">) => Promise<void>;
  removeActivity: (id: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

const ActivityContext = createContext<ActivityContextType | undefined>(
  undefined,
);

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [duoActivities, setDuoActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, token } = useAuth();
  const { refreshChallenge, currentChallenge } = useChallenge();
  const { activeSlot, partnerLinks } = usePartner();

  const clearError = () => setError(null);

  const loadActivities = useCallback(async () => {
    if (!token) {
      setActivities([]);
      setDuoActivities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const storedActivities = await activityService.getActivities(token);
      setActivities(storedActivities);

      // Shared activities:
      // - when a DUO slot is selected (p1/p2)
      // - OR when a DUO challenge is active (so Défis can show both players)
      const shouldFetchShared = (activeSlot === "p1" || activeSlot === "p2") || currentChallenge?.mode === "duo";
      if (shouldFetchShared) {
        const links = Array.isArray(partnerLinks) ? partnerLinks : [];

        const getConfirmedLinkForSlot = (slot: "p1" | "p2") =>
          links.find((p: any) => p?.slot === slot && p?.status === "confirmed");

        const link = (activeSlot === "p1" || activeSlot === "p2")
          ? getConfirmedLinkForSlot(activeSlot)
          : (getConfirmedLinkForSlot("p1") || getConfirmedLinkForSlot("p2"));

        const partnerId = (link as any)?.partnerId || null;
        const isConfirmed = (link as any)?.status === "confirmed";

        if (partnerId && isConfirmed) {
          try {
            const shared = await activityService.getSharedActivitiesWithPartner(token, partnerId);
            setDuoActivities(shared);
          } catch (sharedError) {
            console.warn(
              "[ActivityContext] Shared activities unavailable for current partner",
              sharedError,
            );
            setDuoActivities([]);
          }
        } else {
          setDuoActivities([]);
        }
      } else {
        setDuoActivities([]);
      }
    } catch (error) {
      console.error("Failed to load activities", error);
      setActivities([]);
      setDuoActivities([]);
    } finally {
      setLoading(false);
    }
  }, [token, activeSlot, partnerLinks, currentChallenge?.mode]);

  useEffect(() => {
    if (user) {
      loadActivities();
    } else {
      setActivities([]);
      setDuoActivities([]);
    }
  }, [user, loadActivities]);

  const addActivity = async (activityData: Omit<Activity, "id" | "_id">) => {
    if (!token) {
      setError("Vous devez être connecté pour ajouter une activité.");
      return;
    }

    // Optimistic update: Add activity to state immediately
    const tempId = `temp-${Date.now()}`;
    const newActivity: Activity = {
      ...activityData,
      _id: tempId,
      id: tempId,
      user: user!._id,
      date: new Date(activityData.date).toISOString(),
    };
    setActivities(prev => [newActivity, ...prev]);

    try {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('📤 [ActivityContext] Envoi activité au backend...');
      }
      const savedActivity = await activityService.addActivity(activityData, token);
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('✅ [ActivityContext] Activité sauvegardée:', savedActivity._id);
      }
      
      // Replace the temporary activity with the real one from the server
      setActivities(prev =>
        prev.map(a => (a._id === tempId ? savedActivity : a))
      );

      // Attendre un peu avant de rafraîchir (laisser MongoDB indexer)
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('⏱️ [ActivityContext] Attente 500ms avant refresh...');
      }
      setTimeout(() => {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log('🔄 [ActivityContext] Appel de refreshChallenge...');
        }
        refreshChallenge();
        // Recharger aussi les activités (solo + shared) pour que l'historique DUO reflète la nouvelle activité.
        loadActivities();
      }, 500);

    } catch (error: any) {
      console.error("❌ [ActivityContext] Failed to save activity", error);
      // Rollback the optimistic update on error
      setActivities(prev => prev.filter(a => a._id !== tempId));

      // Set a more specific error message from the backend response
      const errorMessage = error.response?.data?.message || "Impossible d'ajouter l'activité. Veuillez réessayer.";
      setError(errorMessage);
    }
  };

  const removeActivity = async (id: string) => {
    const originalActivities = [...activities];
    // Optimistic update
    setActivities(prev => prev.filter(a => a.id !== id && a._id !== id));

    if (!token) {
      setError("Vous devez être connecté pour supprimer une activité.");
      setActivities(originalActivities);
      return;
    }

    try {
      await activityService.deleteActivity(id, token);
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('🗑️ [ActivityContext] Activité supprimée, refresh dans 500ms...');
      }
      
      // Attendre un peu avant de rafraîchir
      setTimeout(() => {
        refreshChallenge();
      }, 500);

    } catch (error) {
      console.error("Failed to remove activity", error);
      setError("Impossible de supprimer l'activité. Veuillez réessayer.");
      setActivities(originalActivities);
    }
  };

  return (
    <ActivityContext.Provider
      value={{ activities, duoActivities, addActivity, removeActivity, loading, error, clearError }}
    >
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivities() {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error("useActivities must be used within an ActivityProvider");
  }
  return context;
}