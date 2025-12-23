import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Type Definitions ---
interface User {
  _id: string;
  username?: string;
  email: string;
  createdAt: string;
}

export interface PartnerLink {
  slot: 'p1' | 'p2';
  partnerId: string;
  partner?: { username?: string; email: string; totalDiamonds: number; _id: string };
  status: 'pending' | 'confirmed';
}

export interface PartnerLinksData {
  partnerLinks: PartnerLink[];
  activeSlot: 'p1' | 'p2' | 'solo';
  hasSelectedSlot?: boolean;
}

export interface PartnerInvite {
  _id: string;
  fromUser: { _id: string; username?: string; email: string; totalDiamonds?: number };
  toUser: string;
  slot: 'p1' | 'p2';
  status: 'pending' | 'accepted' | 'refused' | 'cancelled';
  createdAt: string;
}

export const updateMyUsername = async (token: string, username: string): Promise<User> => {
  try {
    const response = await api.put(
      '/users/username',
      { username },
      { headers: { Authorization: `Bearer ${token}` } },
    );

    // Endpoint returns { success, data: { user } }
    const updated = response?.data?.data?.user;
    return updated;
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Erreur lors de la mise à jour du pseudo');
  }
};

/**
 * Get all registered users
 * @returns {Promise<User[]>} A list of all users
 */
export const getAllUsers = async (): Promise<User[]> => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      throw new Error('No token found');
    }

    const response = await api.get<User[]>('/users', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error: any) {
    throw error.response?.data || error.message;
  }
};

/**
 * Get partner links (P1, P2) for current user
 */
export const getPartnerLinks = async (token: string): Promise<PartnerLinksData> => {
  try {
    const response = await api.get('/users/partner-links', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data;
  } catch (error: any) {
    const status = error?.response?.status;
    const message = error?.response?.data || error?.message;
    console.error('❌ [userService] getPartnerLinks error:', { status, message });
    return { partnerLinks: [], activeSlot: 'solo', hasSelectedSlot: false };
  }
};

/**
 * Update partner links (P1, P2 slots)
 */
export const updatePartnerLinks = async (
  token: string,
  p1: string | null,
  p2: string | null
): Promise<PartnerLinksData> => {
  try {
    const response = await api.put(
      '/users/partner-links',
      { p1, p2 },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  } catch (error: any) {
    console.error('❌ [userService] updatePartnerLinks error:', error.response?.data);
    throw new Error(error.response?.data?.message || 'Erreur lors de la mise à jour des partenaires');
  }
};

/**
 * Update active slot (p1, p2, solo)
 */
export const updateActiveSlot = async (
  token: string,
  activeSlot: 'p1' | 'p2' | 'solo'
): Promise<PartnerLinksData> => {
  try {
    const response = await api.put(
      '/users/active-slot',
      { activeSlot },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  } catch (error: any) {
    console.error('❌ [userService] updateActiveSlot error:', error.response?.data);
    throw new Error(error.response?.data?.message || 'Erreur lors du changement de slot');
  }
};

/**
 * Send a partner invite for a slot (p1/p2)
 */
export const sendPartnerInvite = async (
  token: string,
  slot: 'p1' | 'p2',
  partnerId: string,
): Promise<PartnerInvite> => {
  try {
    const response = await api.post(
      '/users/partner-invites',
      { slot, partnerId },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data.data.invite;
  } catch (error: any) {
    console.error('❌ [userService] sendPartnerInvite error:', error.response?.data);
    throw new Error(error.response?.data?.message || 'Erreur lors de l\'envoi de l\'invitation');
  }
};

/**
 * List incoming pending partner invites
 */
export const getIncomingPartnerInvites = async (token: string): Promise<PartnerInvite[]> => {
  try {
    const response = await api.get('/users/partner-invites/incoming', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data.invites;
  } catch (error: any) {
    console.error('❌ [userService] getIncomingPartnerInvites error:', error.response?.data);
    return [];
  }
};

export const acceptPartnerInvite = async (token: string, inviteId: string): Promise<void> => {
  try {
    await api.post(
      `/users/partner-invites/${inviteId}/accept`,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch (error: any) {
    console.error('❌ [userService] acceptPartnerInvite error:', error.response?.data);
    throw new Error(error.response?.data?.message || 'Erreur lors de l\'acceptation');
  }
};

export const refusePartnerInvite = async (token: string, inviteId: string): Promise<void> => {
  try {
    await api.post(
      `/users/partner-invites/${inviteId}/refuse`,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch (error: any) {
    console.error('❌ [userService] refusePartnerInvite error:', error.response?.data);
    throw new Error(error.response?.data?.message || 'Erreur lors du refus');
  }
};
