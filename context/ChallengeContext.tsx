// app/context/ChallengeContext.tsx

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { challengeService } from '../services/challengeService';
import type { Challenge, CreateChallengeData, UpdateChallengeData } from '../types/Challenge';
import { useAuth } from './AuthContext';
import { usePartner } from './PartnerContext';

interface ChallengeContextType {
  currentChallenge: Challenge | null;
  pendingInvitations: Challenge[];
  pendingSentChallenge: Challenge | null;
  loading: boolean;
  error: string | null;
  createChallenge: (data: CreateChallengeData) => Promise<void>;
  acceptInvitation: (challengeId: string) => Promise<void>;
  refuseInvitation: (challengeId: string) => Promise<void>;
  updateChallenge: (data: UpdateChallengeData) => Promise<void>;
  deleteChallenge: () => Promise<void>;
  refreshChallenge: () => Promise<void>;
  refreshInvitations: () => Promise<void>;
  refreshAll: () => Promise<void>;
  clearError: () => void;
}

const ChallengeContext = createContext<ChallengeContextType | undefined>(undefined);

export const ChallengeProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, reloadUser, user } = useAuth();
  const { activeSlot, partnerLinks, switchSlot, hasSelectedSlot } = usePartner();
  const userId: string | undefined = (user as any)?._id || (user as any)?.id;
  const [rawChallenge, setRawChallenge] = useState<Challenge | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<Challenge[]>([]);
  const [pendingSentChallenge, setPendingSentChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncingSlotRef = useRef(false);
  const prevSlotRef = useRef<typeof activeSlot>(activeSlot);

  const debugLog = (...args: any[]) => {
    // Keep logs in dev only; polling logs every 3s can cause visible jank/flashing.
    // eslint-disable-next-line no-undef
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  };

  const getPlayerUserId = (p: any) => {
    const u = p?.user;
    const id = typeof u === 'string' ? u : u?._id;
    return id ? String(id) : '';
  };

  const getChallengeSignature = (c: Challenge | null) => {
    if (!c) return 'null';

    const anyC: any = c;
    const base = [anyC._id, anyC.status, anyC.mode].join('|');

    // Important: server-side reads may mutate `updatedAt` (and even persist) without any
    // meaningful UI change. We intentionally do NOT include `updatedAt` here.

    const flags = [
      anyC.bonusEarned ? '1' : '0',
      anyC.bonusAwarded ? '1' : '0',
    ].join('');

    if (anyC.mode === 'solo') {
      const progress = anyC.progress || {};
      const pCurrent = progress.current ?? null;
      const pPct = progress.percentage ?? null;
      // Fallback: players[0].progress is sometimes used.
      const playerProgress = Array.isArray(anyC.players) ? anyC.players?.[0]?.progress : null;
      return `${base}|${flags}|solo|${pCurrent}|${pPct}|${playerProgress}`;
    }

    const players = Array.isArray(anyC.players) ? anyC.players : [];
    const duoSig = players
      .map((p: any) => ({
        id: getPlayerUserId(p),
        progress: p?.progress ?? null,
        diamonds: p?.diamonds ?? null,
        completed: p?.completed ? 1 : 0,
      }))
      .sort((x: any, y: any) => x.id.localeCompare(y.id))
      .map((p: any) => `${p.id}:${p.progress}:${p.diamonds}:${p.completed}`)
      .join(',');

    return `${base}|${flags}|duo|${duoSig}`;
  };

  const isSameChallenge = (a: Challenge | null, b: Challenge | null) => {
    if (a === b) return true;
    return getChallengeSignature(a) === getChallengeSignature(b);
  };

  const isSameChallengeList = (a: Challenge[], b: Challenge[]) => {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      const ai: any = a[i];
      const bi: any = b[i];
      if (ai?._id !== bi?._id) return false;
      if (ai?.status !== bi?.status) return false;
      if (ai?.mode !== bi?.mode) return false;
    }
    return true;
  };

  // Slot-aware view of the challenge:
  // - SOLO slot: only display SOLO challenges
  // - P1/P2 slots: only display DUO challenges
  // This prevents "je suis en solo mais je vois le défi P1" across the app.
  const currentChallenge = useMemo(() => {
    if (!rawChallenge) return null;
    if (activeSlot === 'solo') return rawChallenge.mode === 'solo' ? rawChallenge : null;
    return rawChallenge.mode === 'duo' ? rawChallenge : null;
  }, [rawChallenge, activeSlot]);

  const isChallengeVisibleForSlot = (challenge: Challenge | null, slot: typeof activeSlot) => {
    if (!challenge) return false;
    if (slot === 'solo') return challenge.mode === 'solo';
    return challenge.mode === 'duo';
  };

  const deriveDesiredSlotFromChallenge = (challenge: Challenge | null): typeof activeSlot | null => {
    if (!challenge || !userId) return null;

    if (challenge.mode === 'solo') return 'solo';

    // DUO: try to pick the slot (p1/p2) matching the other player.
    const players = Array.isArray((challenge as any).players) ? (challenge as any).players : [];
    const otherPlayer = players.find((p: any) => {
      const pid = typeof p?.user === 'string' ? p.user : p?.user?._id;
      return pid && pid.toString() !== userId.toString();
    });
    const otherId = typeof otherPlayer?.user === 'string' ? otherPlayer.user : otherPlayer?.user?._id;
    if (!otherId) return null;

    const link = (partnerLinks || []).find(
      (l: any) => l?.partnerId?.toString?.() === otherId.toString()
    );
    const slot = link?.slot;
    if (slot === 'p1' || slot === 'p2') return slot;
    return null;
  };

  const syncSlotToChallenge = async (challenge: Challenge | null, options?: { force?: boolean }) => {
    if (!challenge || !userId) return;
    if (syncingSlotRef.current) return;

    const force = Boolean(options?.force);

    // Default behavior: respect explicit user choice (slot selection).
    // Force=true is used for explicit user actions (e.g. accepting a DUO invite)
    // where showing the correct slot immediately is expected.
    if (!force && hasSelectedSlot) return;

    const desiredSlot = deriveDesiredSlotFromChallenge(challenge);
    if (!desiredSlot) return;
    if (desiredSlot === activeSlot) return;

    try {
      syncingSlotRef.current = true;
      await switchSlot(desiredSlot);
    } catch (e) {
      // Best-effort: keep state usable even if slot sync fails.
      console.warn('⚠️ [ChallengeContext] Impossible de synchroniser le slot avec le challenge:', e);
    } finally {
      syncingSlotRef.current = false;
    }
  };

  const loadChallenge = async () => {
    if (!isAuthenticated) {
      setRawChallenge(prev => (prev === null ? prev : null));
      setPendingSentChallenge(prev => (prev === null ? prev : null));
      setLoading(false);
      return;
    }

    try {
      // Before the user explicitly selects a slot, fetch the current challenge without slot filtering.
      // This allows the app to auto-sync to the correct slot (solo vs duo) during first-time setup.
      const challenge = await challengeService.getCurrentChallenge(hasSelectedSlot ? activeSlot : undefined);
      
      // ✅ NE MONTRER QUE LES CHALLENGES ACTIFS
      // Les challenges pending reçus s'affichent dans les invitations.
      // Les challenges pending envoyés sont gérés via pendingSentChallenge.
      if (challenge && challenge.status === 'pending') {
        debugLog('⚠️ [ChallengeContext] Challenge pending ignoré, voir les invitations');
        setRawChallenge(prev => (prev === null ? prev : null));
        return;
      }
      
      debugLog('🔍 [ChallengeContext] loadChallenge résultat:', challenge ? `Challenge ${(challenge as any)._id}` : 'Null');
      setRawChallenge(prev => (isSameChallenge(prev, challenge) ? prev : challenge));

      // Best-effort: keep slot coherent during the initial setup phase.
      await syncSlotToChallenge(challenge as any);

      // Si un challenge actif est trouvé, il n'y a plus d'invitation envoyée en attente.
      if (challenge) {
        setPendingSentChallenge(prev => (prev === null ? prev : null));
      }
    } catch (err: any) {
      if (err.response?.status !== 404) {
        console.error('❌ [ChallengeContext] Erreur chargement challenge:', err);
      }
      setRawChallenge(null);
    }
  };

  const loadPendingSent = async () => {
    if (!isAuthenticated) {
      setPendingSentChallenge(prev => (prev === null ? prev : null));
      return;
    }

    // If a challenge is visible for this slot, there should be no pending-sent invite.
    // (Avoid suppressing pending-sent when the backend returns a mismatch unexpectedly.)
    if (isChallengeVisibleForSlot(rawChallenge, activeSlot)) {
      setPendingSentChallenge(prev => (prev === null ? prev : null));
      return;
    }

    try {
      // Do NOT slot-filter this request: an invitation sent from P1/P2 shouldn't disappear
      // when the user temporarily views SOLO (or vice versa).
      const pending = await challengeService.getPendingSentChallenge(undefined);
      setPendingSentChallenge(prev => (isSameChallenge(prev, pending) ? prev : pending));
    } catch {
      setPendingSentChallenge(prev => (prev === null ? prev : null));
    }
  };

  const loadInvitations = async () => {
    if (!isAuthenticated) {
      setPendingInvitations(prev => (prev.length === 0 ? prev : []));
      return;
    }

    try {
      const invitationsRaw = await challengeService.getPendingInvitations();
      const invitations = Array.isArray(invitationsRaw) ? invitationsRaw : [];
      
      // ✅ Extraire l'ID de l'utilisateur actuel
      const currentUserId: string | undefined = (user as any)?._id || (user as any)?.id;
      
      // ✅ FILTRER : Garder uniquement les invitations REÇUES
      const receivedInvitations = invitations.filter(inv => {
        const creator = (inv as any).creator;
        const creatorId: string = typeof creator === 'string' ? creator : creator?._id;
        
        // Ne garder que si l'user N'EST PAS le créateur
        return currentUserId && creatorId !== currentUserId.toString();
      });
      
      if (receivedInvitations.length > pendingInvitations.length) {
        debugLog(`📬 [ChallengeContext] Nouvelle invitation reçue ! (${receivedInvitations.length})`);
      }
      
      debugLog(`📬 [ChallengeContext] ${receivedInvitations.length} invitation(s) reçue(s)`);
      setPendingInvitations(prev => (isSameChallengeList(prev, receivedInvitations) ? prev : receivedInvitations));
    } catch (err: any) {
      console.error('❌ [ChallengeContext] Erreur chargement invitations:', err);
      setPendingInvitations(prev => (prev.length === 0 ? prev : []));
    }
  };

  const refreshAll = async () => {
    debugLog('🔄 [ChallengeContext] Rafraîchissement complet...');
    setLoading(true);
    try {
      await Promise.all([
        loadChallenge(),
        loadInvitations(),
        loadPendingSent(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Polling automatique (15s par défaut, plus rapide quand une invitation DUO est en attente)
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const hasPendingSentDuo = Boolean(pendingSentChallenge && pendingSentChallenge.status === 'pending' && pendingSentChallenge.mode === 'duo');
    const intervalMs = hasPendingSentDuo ? 3000 : 15000;
    debugLog(`🔄 [ChallengeContext] Polling activé (${intervalMs}ms)`);

    intervalRef.current = setInterval(() => {
      // Polling should be quiet; frequent logs can cause UI jank.
      loadChallenge();
      loadInvitations();
      loadPendingSent();
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, userId, pendingSentChallenge?._id, pendingSentChallenge?.status, activeSlot]);

  // Refresh au retour sur l'app
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isAuthenticated && userId) {
        debugLog('📱 [ChallengeContext] App revenue au premier plan, rafraîchissement...');
        loadChallenge();
        loadInvitations();
        loadPendingSent();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, userId]);

  // Chargement initial
  useEffect(() => {
    if (isAuthenticated && userId) {
      refreshAll();
    }
  }, [isAuthenticated, userId, activeSlot]);

  // Clear slot-scoped state immediately when switching slots (especially p1 <-> p2)
  // to avoid showing a DUO challenge from the wrong slot while the new fetch is in-flight.
  useEffect(() => {
    if (!isAuthenticated) return;

    if (prevSlotRef.current !== activeSlot) {
      prevSlotRef.current = activeSlot;
      setRawChallenge(null);
      setPendingSentChallenge(null);
    }
  }, [activeSlot, isAuthenticated]);

  // Ensure no stale challenge/invites remain in memory after logout.
  useEffect(() => {
    if (isAuthenticated) return;

    setRawChallenge(null);
    setPendingInvitations([]);
    setPendingSentChallenge(null);
    setError(null);
    setLoading(false);
  }, [isAuthenticated]);

  const createChallenge = async (data: CreateChallengeData) => {
    try {
      setLoading(true);
      setError(null);
      
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('📤 [ChallengeContext] Création challenge:', data.mode);
      }
      const newChallenge = await challengeService.createChallenge(data);
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('✅ [ChallengeContext] Challenge créé:', newChallenge._id);
      }
      
      if (data.mode === 'duo') {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log('📤 [ChallengeContext] Invitation DUO envoyée, pas de challenge actif pour le créateur');
        }
        
        setRawChallenge(null);
        setPendingSentChallenge(newChallenge);

        // Best-effort: make the pending DUO invite visible in the expected slot.
        // (Will no-op if we can't infer the correct slot.)
        await syncSlotToChallenge(newChallenge as any, { force: true });
        
        setTimeout(async () => {
          await loadInvitations();
          await loadPendingSent();
        }, 500);
        
      } else {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log('✅ [ChallengeContext] Challenge SOLO actif immédiatement');
        }
        setRawChallenge(newChallenge);
        setPendingSentChallenge(null);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Erreur lors de la création';
      console.error('❌ [ChallengeContext] Erreur création:', errorMessage);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const acceptInvitation = async (challengeId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('✅ [ChallengeContext] Acceptation invitation:', challengeId);
      }
      const acceptedChallenge = await challengeService.acceptInvitation(challengeId);

      // Accepting a DUO invite is an explicit user action; force slot to match the accepted challenge
      // so the challenge becomes visible immediately.
      await syncSlotToChallenge(acceptedChallenge as any, { force: true });
      
      setRawChallenge(acceptedChallenge);
      setPendingInvitations(prev => prev.filter(inv => inv._id !== challengeId));
      
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('✅ [ChallengeContext] Challenge DUO activé !');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Erreur lors de l\'acceptation';
      console.error('❌ [ChallengeContext] Erreur acceptation:', errorMessage);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const refuseInvitation = async (challengeId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('❌ [ChallengeContext] Refus invitation:', challengeId);
      }
      await challengeService.refuseInvitation(challengeId);
      
      setPendingInvitations(prev => prev.filter(inv => inv._id !== challengeId));
      
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('❌ [ChallengeContext] Invitation refusée');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Erreur lors du refus';
      console.error('❌ [ChallengeContext] Erreur refus:', errorMessage);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateChallenge = async (data: UpdateChallengeData) => {
    try {
      setLoading(true);
      setError(null);
      
      const updated = await challengeService.updateChallenge(data, activeSlot);
      setRawChallenge(updated);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Erreur lors de la mise à jour';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const deleteChallenge = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('🗑️ [ChallengeContext] Suppression challenge');
      }
      await challengeService.deleteChallenge(activeSlot);
      setRawChallenge(null);
      setPendingSentChallenge(null);
      
      await reloadUser();
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('✅ [ChallengeContext] Challenge supprimé');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Erreur lors de la suppression';
      console.error('❌ [ChallengeContext] Erreur suppression:', errorMessage);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const refreshChallenge = async () => {
    try {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('🔄 [ChallengeContext] refreshChallenge APPELÉ');
      }
      const refreshed = await challengeService.refreshProgress(0, activeSlot);
      
      if (refreshed && refreshed.status === 'pending' && refreshed.mode === 'duo') {
        const creator = (refreshed as any).creator;
        const challengeCreatorId: string = typeof creator === 'string' ? creator : creator?._id;
        const currentUserId: string | undefined = (user as any)?._id || (user as any)?.id;
        
        if (currentUserId && challengeCreatorId === currentUserId.toString()) {
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.log('⚠️ [ChallengeContext] Challenge pending ignoré dans refreshChallenge');
          }
          return;
        }
      }
      
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('📊 [ChallengeContext] Données refresh reçues');
      }
      setRawChallenge(refreshed);
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('✅ [ChallengeContext] State mis à jour');
      }
      
      if (refreshed?.mode === 'duo' && refreshed?.bonusEarned && !refreshed?.bonusAwarded) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log('🎉 [ChallengeContext] BONUS DÉBLOQUÉ !');
        }
        setTimeout(() => {
          loadChallenge();
        }, 1000);
      }
    } catch (err: any) {
      console.error('❌ [ChallengeContext] Erreur refresh:', err);
    }
  };

  const refreshInvitations = async () => {
    await loadInvitations();
  };

  const clearError = () => setError(null);

  return (
    <ChallengeContext.Provider
      value={{
        currentChallenge,
        pendingInvitations,
        pendingSentChallenge,
        loading,
        error,
        createChallenge,
        acceptInvitation,
        refuseInvitation,
        updateChallenge,
        deleteChallenge,
        refreshChallenge,
        refreshInvitations,
        refreshAll,
        clearError,
      }}
    >
      {children}
    </ChallengeContext.Provider>
  );
};

export const useChallenge = () => {
  const context = useContext(ChallengeContext);
  if (!context) {
    throw new Error('useChallenge must be used within ChallengeProvider');
  }
  return context;
};