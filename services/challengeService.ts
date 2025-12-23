// services/challengeService.ts

import api from './api';
import type { Challenge, CreateChallengeData, UpdateChallengeData } from '../types/Challenge';

const unwrapData = <T>(payload: any): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as any).data as T;
  }
  return payload as T;
};

export const challengeService = {
  
  // Récupérer le challenge actif de l'utilisateur
  async getCurrentChallenge(slot?: 'solo' | 'p1' | 'p2'): Promise<Challenge | null> {
    try {
      const response = await api.get('/challenges/current', {
        params: slot ? { slot } : undefined,
      });
      const challenge = unwrapData<Challenge | null>(response.data);
      return challenge || null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error('❌ [challengeService] getCurrentChallenge error:', error.response?.data);
      throw error;
    }
  },

  // Historique des challenges DUO pour un slot (p1/p2)
  async getDuoChallengeHistory(slot: 'p1' | 'p2', partnerId?: string): Promise<Challenge[]> {
    try {
      const response = await api.get('/challenges/duo/history', {
        params: { slot, ...(partnerId ? { partnerId } : {}) },
      });
      const list = unwrapData<unknown>(response.data);
      return Array.isArray(list) ? (list as Challenge[]) : [];
    } catch (error: any) {
      console.error('❌ [challengeService] getDuoChallengeHistory error:', error.response?.data);
      return [];
    }
  },

  // Historique des challenges SOLO de l'utilisateur
  async getSoloChallengeHistory(): Promise<Challenge[]> {
    try {
      const response = await api.get('/challenges/solo/history');
      const list = unwrapData<unknown>(response.data);
      return Array.isArray(list) ? (list as Challenge[]) : [];
    } catch (error: any) {
      console.error('❌ [challengeService] getSoloChallengeHistory error:', error.response?.data);
      return [];
    }
  },

  // Récupérer les invitations en attente
  async getPendingInvitations(): Promise<Challenge[]> {
    try {
      const response = await api.get('/challenges/invitations');
      const invitations = unwrapData<unknown>(response.data);
      return Array.isArray(invitations) ? (invitations as Challenge[]) : [];
    } catch (error: any) {
      console.error('❌ [challengeService] getPendingInvitations error:', error.response?.data);
      // ✅ FIX: Ne pas crasher si erreur réseau, retourner tableau vide
      return [];
    }
  },

  // Récupérer l'invitation envoyée (pending) par l'utilisateur
  async getPendingSentChallenge(slot?: 'solo' | 'p1' | 'p2'): Promise<Challenge | null> {
    try {
      const response = await api.get('/challenges/pending-sent', {
        params: slot ? { slot } : undefined,
      });
      const pending = unwrapData<Challenge | null>(response.data);
      return pending || null;
    } catch (error: any) {
      const status: number | undefined = error?.response?.status;
      const contentType: string | undefined = error?.response?.headers?.['content-type'];
      const data = error?.response?.data;

      // 404 = route not available OR no resource; treat as "nothing pending".
      if (status === 404) return null;

      // Some environments return an Express HTML 404 page instead of JSON.
      if (typeof data === 'string') {
        if (data.includes('Cannot GET') || (contentType && contentType.includes('text/html'))) {
          return null;
        }
      }

      console.error('❌ [challengeService] getPendingSentChallenge error:', data);
      return null;
    }
  },

  // ✅ AMÉLIORÉ : Créer un challenge (SOLO ou DUO) avec meilleure validation
  async createChallenge(data: CreateChallengeData): Promise<Challenge> {
    try {
      console.log('📤 [challengeService] Création challenge:', JSON.stringify(data, null, 2));
      
      // ✅ NEW: Validation côté client avant envoi
      if (data.mode === 'duo') {
        if (!data.partnerId) {
          throw new Error('Un partenaire doit être sélectionné pour un challenge DUO');
        }
        if (data.partnerId === 'current-user-id') { // À remplacer par vraie vérification
          throw new Error('Vous ne pouvez pas vous inviter vous-même');
        }
      }
      
      const response = await api.post('/challenges', data);

      const created = unwrapData<Challenge>(response.data);
      console.log('✅ [challengeService] Challenge créé:', (created as any)?._id);
      return created;
    } catch (error: any) {
      console.error('❌ [challengeService] createChallenge error:', error.response?.data);
      
      // ✅ AMÉLIORÉ: Messages d'erreur plus clairs
      const errorMessage = error.response?.data?.message 
        || error.message 
        || 'Erreur lors de la création du challenge';
      
      throw new Error(errorMessage);
    }
  },

  // ✅ AMÉLIORÉ : Accepter une invitation DUO
  async acceptInvitation(challengeId: string): Promise<Challenge> {
    try {
      console.log('✅ [challengeService] Acceptation invitation:', challengeId);
      
      if (!challengeId) {
        throw new Error('ID du challenge manquant');
      }
      
      const response = await api.post(`/challenges/${challengeId}/accept`);

      const accepted = unwrapData<Challenge>(response.data);
      console.log('✅ [challengeService] Invitation acceptée:', (accepted as any)?._id);
      return accepted;
    } catch (error: any) {
      console.error('❌ [challengeService] acceptInvitation error:', error.response?.data);
      
      // ✅ AMÉLIORÉ: Gérer cas spécifiques
      const status = error.response?.status;
      const message = error.response?.data?.message;
      
      if (status === 409) {
        throw new Error('Vous avez déjà un challenge en cours');
      }
      if (status === 404) {
        throw new Error('Cette invitation n\'existe plus');
      }
      if (status === 400 && message?.includes('plus disponible')) {
        throw new Error('Cette invitation n\'est plus disponible');
      }
      
      throw new Error(message || 'Erreur lors de l\'acceptation de l\'invitation');
    }
  },

  // ✅ AMÉLIORÉ : Refuser une invitation DUO
  async refuseInvitation(challengeId: string): Promise<void> {
    try {
      console.log('❌ [challengeService] Refus invitation:', challengeId);
      
      if (!challengeId) {
        throw new Error('ID du challenge manquant');
      }
      
      await api.post(`/challenges/${challengeId}/refuse`);
      
      console.log('✅ [challengeService] Invitation refusée');
    } catch (error: any) {
      console.error('❌ [challengeService] refuseInvitation error:', error.response?.data);
      throw new Error(error.response?.data?.message || 'Erreur lors du refus de l\'invitation');
    }
  },

  // Mettre à jour un challenge
  async updateChallenge(data: UpdateChallengeData, slot?: 'solo' | 'p1' | 'p2'): Promise<Challenge> {
    try {
      console.log('📤 [challengeService] Mise à jour challenge:', JSON.stringify(data, null, 2));
      
      const response = await api.put('/challenges/current', data, {
        params: slot ? { slot } : undefined,
      });

      const updated = unwrapData<Challenge>(response.data);
      console.log('✅ [challengeService] Challenge mis à jour:', (updated as any)?._id);
      return updated;
    } catch (error: any) {
      console.error('❌ [challengeService] updateChallenge error:', error.response?.data);
      throw new Error(error.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  },

  // ✅ AMÉLIORÉ : Supprimer/Quitter un challenge
  async deleteChallenge(slot?: 'solo' | 'p1' | 'p2'): Promise<void> {
    try {
      console.log('🗑️ [challengeService] Suppression challenge...');
      
      await api.delete('/challenges/current', {
        params: slot ? { slot } : undefined,
      });
      
      console.log('✅ [challengeService] Challenge supprimé avec succès');
    } catch (error: any) {
      console.error('❌ [challengeService] deleteChallenge error:', error.response?.data);
      
      // ✅ AMÉLIORÉ: Gérer cas 404 (déjà supprimé)
      if (error.response?.status === 404) {
        console.warn('⚠️ Challenge déjà supprimé ou inexistant');
        return; // Ne pas throw, considérer comme succès
      }
      
      throw new Error(error.response?.data?.message || 'Erreur lors de la suppression du challenge');
    }
  },

  // ✅ AMÉLIORÉ : Rafraîchir la progression avec retry
  async refreshProgress(retryCount = 0, slot?: 'solo' | 'p1' | 'p2'): Promise<Challenge | null> {
    try {
      console.log('🔄 [challengeService] Rafraîchissement de la progression...');
      
      const response = await api.post('/challenges/refresh-progress', undefined, {
        params: slot ? { slot } : undefined,
      });

      const refreshed = unwrapData<Challenge | null>(response.data);
      console.log('✅ [challengeService] Progression rafraîchie:', (refreshed as any)?.players);
      return refreshed || null;
    } catch (error: any) {
      console.error('❌ [challengeService] refreshProgress error:', error.response?.data);
      
      // ✅ NEW: Retry logic pour erreurs réseau temporaires
      if (retryCount < 2 && (!error.response || error.response.status >= 500)) {
        console.log(`🔁 Retry ${retryCount + 1}/2...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.refreshProgress(retryCount + 1, slot);
      }
      
      if (error.response?.status === 404) {
        console.warn('⚠️ Pas de challenge actif');
        return null;
      }
      
      throw error;
    }
  },
};