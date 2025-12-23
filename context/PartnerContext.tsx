// context/PartnerContext.tsx

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import {
  PartnerInvite,
  PartnerLinksData,
  acceptPartnerInvite as apiAcceptPartnerInvite,
  getIncomingPartnerInvites as apiGetIncomingPartnerInvites,
  getPartnerLinks,
  refusePartnerInvite as apiRefusePartnerInvite,
  sendPartnerInvite as apiSendPartnerInvite,
  updatePartnerLinks,
  updateActiveSlot,
} from '../services/userService';
import { useAuth } from './AuthContext';

interface PartnerContextType {
  partnerLinks: PartnerLinksData['partnerLinks'];
  activeSlot: 'p1' | 'p2' | 'solo';
  hasSelectedSlot: boolean;
  incomingInvites: PartnerInvite[];
  loading: boolean;
  error: string | null;
  switchSlot: (slot: 'p1' | 'p2' | 'solo') => Promise<void>;
  updatePartners: (p1: string | null, p2: string | null) => Promise<void>;
  sendPartnerInvite: (slot: 'p1' | 'p2', partnerId: string) => Promise<void>;
  refreshIncomingInvites: () => Promise<void>;
  acceptIncomingInvite: (inviteId: string) => Promise<void>;
  refuseIncomingInvite: (inviteId: string) => Promise<void>;
  getActivePartner: () => string | null;
  clearError: () => void;
}

const PartnerContext = createContext<PartnerContextType | undefined>(undefined);

export const PartnerProvider = ({ children }: { children: ReactNode }) => {
  const { token, isAuthenticated } = useAuth();
  const [partnerLinks, setPartnerLinks] = useState<PartnerLinksData['partnerLinks']>([]);
  const [activeSlot, setActiveSlot] = useState<'p1' | 'p2' | 'solo'>('solo');
  const [hasSelectedSlot, setHasSelectedSlot] = useState(false);
  const [incomingInvites, setIncomingInvites] = useState<PartnerInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearError = () => setError(null);

  const loadPartnerLinks = async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);

    if (!token || !isAuthenticated) {
      setPartnerLinks([]);
      setActiveSlot('solo');
      setHasSelectedSlot(false);
      setIncomingInvites([]);
      setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);
      const data = await getPartnerLinks(token);
      setPartnerLinks(data.partnerLinks);
      setActiveSlot(data.activeSlot);
      setHasSelectedSlot(Boolean(data.hasSelectedSlot));
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('✅ [PartnerContext] Partner links loaded:', data);
      }
    } catch (err: any) {
      console.error('❌ [PartnerContext] Error loading partner links:', err);
      setPartnerLinks([]);
      setActiveSlot('solo');
      setHasSelectedSlot(false);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const refreshIncomingInvites = async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);

    if (!token || !isAuthenticated) {
      setIncomingInvites([]);
      return;
    }

    try {
      if (!silent) setLoading(true);
      const invites = await apiGetIncomingPartnerInvites(token);
      setIncomingInvites(invites);
    } catch {
      setIncomingInvites([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    // Always call once on auth/token changes, even when logged out,
    // so "loading" state is consistent and data is cleared.
    loadPartnerLinks();
    refreshIncomingInvites({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token]);

  // Polling: keep partnerLinks in sync so a pending slot turns confirmed after acceptance.
  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      loadPartnerLinks({ silent: true });
      refreshIncomingInvites({ silent: true });
    }, 15000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, token]);

  const switchSlot = async (slot: 'p1' | 'p2' | 'solo') => {
    if (!token) throw new Error('No token');

    try {
      setLoading(true);
      const data = await updateActiveSlot(token, slot);
      setActiveSlot(data.activeSlot);
      setPartnerLinks(data.partnerLinks);
      setHasSelectedSlot(Boolean(data.hasSelectedSlot));
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('✅ [PartnerContext] Slot switched to:', slot);
      }
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updatePartners = async (p1: string | null, p2: string | null) => {
    if (!token) throw new Error('No token');

    try {
      setLoading(true);
      const data = await updatePartnerLinks(token, p1, p2);
      setPartnerLinks(data.partnerLinks);
      if (typeof data.hasSelectedSlot === 'boolean') {
        setHasSelectedSlot(Boolean(data.hasSelectedSlot));
      }
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('✅ [PartnerContext] Partner links updated:', data);
      }
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendPartnerInvite = async (slot: 'p1' | 'p2', partnerId: string) => {
    if (!token) throw new Error('No token');

    try {
      setLoading(true);
      await apiSendPartnerInvite(token, slot, partnerId);
      await loadPartnerLinks();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const acceptIncomingInvite = async (inviteId: string) => {
    if (!token) throw new Error('No token');

    try {
      setLoading(true);
      await apiAcceptPartnerInvite(token, inviteId);
      // Ensure partnerLinks are updated immediately after acceptance.
      await loadPartnerLinks({ silent: true });
      await refreshIncomingInvites({ silent: true });
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const refuseIncomingInvite = async (inviteId: string) => {
    if (!token) throw new Error('No token');

    try {
      setLoading(true);
      await apiRefusePartnerInvite(token, inviteId);
      await refreshIncomingInvites();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getActivePartner = (): string | null => {
    if (activeSlot === 'solo') return null;
    const link = partnerLinks.find(p => p.slot === activeSlot);
    return link?.partnerId || null;
  };

  return (
    <PartnerContext.Provider
      value={{
        partnerLinks,
        activeSlot,
        hasSelectedSlot,
        incomingInvites,
        loading,
        error,
        switchSlot,
        updatePartners,
        sendPartnerInvite,
        refreshIncomingInvites,
        acceptIncomingInvite,
        refuseIncomingInvite,
        getActivePartner,
        clearError,
      }}
    >
      {children}
    </PartnerContext.Provider>
  );
};

export const usePartner = () => {
  const context = useContext(PartnerContext);
  if (!context) {
    throw new Error('usePartner must be used within PartnerProvider');
  }
  return context;
};
