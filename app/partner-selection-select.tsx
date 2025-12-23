import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePartner } from '../context/PartnerContext';
import { useAuth } from '../context/AuthContext';
import { getAllUsers } from '../services/userService';
import { confirmDestructive, showMessage } from '../utils/dialogs';
import { theme } from '../utils/theme';

interface UserOption {
  _id: string;
  username?: string;
  email: string;
  name: string;
}

type PartnerSlot = 'p1' | 'p2';

const isPartnerSlot = (value: unknown): value is PartnerSlot => value === 'p1' || value === 'p2';

export default function PartnerSelectionSelectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const slotParam = Array.isArray(params.slot) ? params.slot[0] : params.slot;

  const { user } = useAuth();
  const {
    partnerLinks,
    incomingInvites,
    sendPartnerInvite,
    acceptIncomingInvite,
    refuseIncomingInvite,
    switchSlot,
    updatePartners,
  } = usePartner();

  const slot: PartnerSlot | null = isPartnerSlot(slotParam) ? slotParam : null;

  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const slotLink = useMemo(() => {
    if (!slot) return null;
    return partnerLinks.find((l) => l.slot === slot) || null;
  }, [partnerLinks, slot]);

  const slotLabel = slot?.toUpperCase() ?? '—';
  const slotColor = slot === 'p2' ? theme.colors.users.secondary : theme.colors.users.primary;

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await getAllUsers();
        const filtered = users
          .filter((u: any) => u._id !== user?._id)
          .map((u: any) => ({
            _id: u._id,
            username: u.username,
            email: u.email,
            name: u.username || (u.email || '').split('@')[0] || 'Utilisateur',
          }));
        setAllUsers(filtered);
      } catch (error: any) {
        console.error('❌ [partner-selection-select] Error loading users:', error);
        showMessage({ title: 'Erreur', message: 'Impossible de charger les utilisateurs' });
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, [user]);

  const pendingInvites = useMemo(() => {
    return incomingInvites.filter((i) => i.status === 'pending');
  }, [incomingInvites]);

  const handleSendInvite = async () => {
    if (!slot) {
      showMessage({ title: 'Erreur', message: 'Slot invalide' });
      return;
    }

    if (slotLink) {
      const isPending = slotLink.status === 'pending';
      const message = isPending
        ? 'Une invitation est déjà en attente pour ce slot. Annule-la d\'abord.'
        : 'Ce partenaire est confirmé. Quitte-le d\'abord pour ré-inviter.';
      showMessage({ title: 'Info', message });
      return;
    }

    if (!selectedPartnerId) {
      showMessage({ title: 'Info', message: 'Sélectionne un partenaire.' });
      return;
    }

    const otherSlotLink = partnerLinks.find(
      (l) => l.partnerId === selectedPartnerId && l.slot !== slot,
    );
    if (otherSlotLink) {
      const statusLabel = otherSlotLink.status === 'pending' ? 'en attente' : 'confirmé';
      showMessage({
        title: 'Info',
        message: `Ce partenaire est déjà ${statusLabel} sur l'autre slot.`,
      });
      return;
    }

    try {
      setConfirming(true);
      await sendPartnerInvite(slot, selectedPartnerId);
      await switchSlot(slot);
      router.replace('/(tabs)/profile');
    } catch (error: any) {
      showMessage({ title: 'Erreur', message: error?.message || "Erreur lors de l'envoi" });
    } finally {
      setConfirming(false);
    }
  };

  const handleAccept = async (inviteId: string, inviteSlot: PartnerSlot) => {
    try {
      await acceptIncomingInvite(inviteId);
      await switchSlot(inviteSlot);
      router.replace('/(tabs)/profile');
    } catch (e: any) {
      showMessage({ title: 'Erreur', message: e?.message || "Impossible d'accepter" });
    }
  };

  const handleRefuse = async (inviteId: string) => {
    try {
      await refuseIncomingInvite(inviteId);
    } catch (e: any) {
      showMessage({ title: 'Erreur', message: e?.message || 'Impossible de refuser' });
    }
  };

  const handleClearSlot = async () => {
    if (!slot) return;
    const currentP1 = partnerLinks.find((l) => l.slot === 'p1')?.partnerId || null;
    const currentP2 = partnerLinks.find((l) => l.slot === 'p2')?.partnerId || null;

    const isPending = slotLink?.status === 'pending';
    const message = isPending
      ? "Annuler l’invitation en attente pour ce slot ?"
      : 'Quitter ce partenaire et libérer le slot ?';

    const confirmed = await confirmDestructive({
      title: 'Confirmer',
      message,
      confirmText: 'Oui',
      cancelText: 'Annuler',
    });

    if (!confirmed) return;

    try {
      setConfirming(true);
      const nextP1 = slot === 'p1' ? null : currentP1;
      const nextP2 = slot === 'p2' ? null : currentP2;
      await updatePartners(nextP1, nextP2);
      setSelectedPartnerId(null);
      console.log('✅ [partner-selection-select] Slot libéré, retour au profil.');
      // Forcer le rafraîchissement avant de revenir
      setTimeout(() => router.replace('/partner-selection'), 300);
    } catch (e: any) {
      showMessage({ title: 'Erreur', message: e?.message || 'Impossible de libérer le slot' });
    } finally {
      setConfirming(false);
    }
  };

  if (!slot) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Text style={styles.title}>Sélection partenaire</Text>
          <Text style={styles.subtitle}>Slot invalide.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/partner-selection')}>
            <Text style={styles.backText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={styles.header}>
          <Text style={styles.title}>Slot {slotLabel}</Text>
          <Text style={styles.subtitle}>Choisis un partenaire pour inviter (ou réponds à une invitation).</Text>
        </View>

        {/* Incoming invites */}
        {pendingInvites.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>INVITATIONS REÇUES</Text>
            {pendingInvites.map((invite) => (
              <View key={invite._id} style={styles.inviteCard}>
                <View style={styles.inviteInfo}>
                  <Text style={styles.inviteTitle}>{invite.fromUser?.username || invite.fromUser?.email}</Text>
                  <Text style={styles.inviteSub}>Slot: {invite.slot.toUpperCase()}</Text>
                </View>
                <View style={styles.inviteActions}>
                  <TouchableOpacity
                    style={[styles.inviteButton, styles.inviteAccept]}
                    onPress={() => handleAccept(invite._id, invite.slot)}
                  >
                    <Text style={styles.inviteButtonText}>Accepter</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.inviteButton, styles.inviteRefuse]}
                    onPress={() => handleRefuse(invite._id)}
                  >
                    <Text style={styles.inviteButtonText}>Refuser</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Slot status */}
        {slotLink && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>STATUT DU SLOT</Text>
            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>
                {((slotLink as any)?.partner?.username || slotLink.partner?.email || 'Partenaire')}
              </Text>
              <Text style={styles.statusSub}>
                {slotLink.status === 'pending' ? 'Invitation envoyée (en attente)' : 'Confirmé'}
              </Text>
              <Text style={styles.statusSubSmall}>
                {slotLink.status === 'pending'
                  ? 'Tu peux annuler puis ré-inviter quelqu’un d’autre.'
                  : 'Tu peux quitter ce partenaire pour libérer le slot.'}
              </Text>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={handleClearSlot}
                disabled={confirming}
              >
                <Ionicons name="close-circle" size={18} color="#ff6b6b" />
                <Text style={styles.clearBtnText}>
                  {slotLink.status === 'pending' ? 'Annuler l’invitation' : 'Quitter ce partenaire'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* User selection */}
        {!slotLink && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>UTILISATEURS</Text>

            {loadingUsers ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={slotColor} />
              </View>
            ) : (
              <View style={styles.userList}>
                {allUsers.map((u) => (
                  <TouchableOpacity
                    key={u._id}
                    style={[styles.userItem, selectedPartnerId === u._id && styles.userItemSelected]}
                    onPress={() => setSelectedPartnerId(u._id)}
                  >
                    <View style={styles.userInfo}>
                      <View
                        style={[
                          styles.avatar,
                          selectedPartnerId === u._id && { backgroundColor: slotColor },
                        ]}
                      >
                        <Text style={styles.avatarText}>{u.name[0]?.toUpperCase?.() ?? '?'}</Text>
                      </View>
                      <Text style={styles.userName}>{u.name}</Text>
                    </View>
                    {selectedPartnerId === u._id && (
                      <Ionicons name="checkmark-circle" size={22} color={slotColor} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.confirmButton, confirming && styles.confirmButtonDisabled]}
              onPress={handleSendInvite}
              disabled={confirming}
            >
              <View style={[styles.confirmGradient, { backgroundColor: slotColor }]}>
                {confirming ? (
                  <ActivityIndicator color={theme.colors.text.high} />
                ) : (
                  <Text style={styles.confirmText}>Envoyer l’invitation</Text>
                )}
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },
  content: { flex: 1 },
  contentInner: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.text.high },
  subtitle: { marginTop: 6, fontSize: 13, color: theme.colors.text.secondary },

  section: { marginTop: 16 },
  sectionLabel: {
    fontSize: 11,
    color: theme.colors.text.muted,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },

  center: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },

  statusCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bg.elevated,
  },
  statusTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text.high },
  statusSub: { marginTop: 4, fontSize: 12, color: theme.colors.text.secondary, fontWeight: '600' },
  statusSubSmall: { marginTop: 6, fontSize: 12, color: theme.colors.text.secondary },

  clearBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${theme.colors.error}66`,
    backgroundColor: `${theme.colors.error}14`,
  },
  clearBtnText: { color: theme.colors.error, fontWeight: '800' },

  userList: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bg.elevated,
    overflow: 'hidden',
  },
  userItem: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  userItemSelected: { backgroundColor: `${theme.colors.accent.action}14` },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: theme.colors.text.primary, fontWeight: '800' },
  userName: { fontSize: 15, color: theme.colors.text.high, fontWeight: '700' },

  inviteCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bg.elevated,
    marginBottom: 10,
  },
  inviteInfo: { marginBottom: 10 },
  inviteTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text.high },
  inviteSub: { marginTop: 2, fontSize: 12, color: theme.colors.text.secondary },
  inviteActions: { flexDirection: 'row', gap: 10 },
  inviteButton: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  inviteAccept: { backgroundColor: `${theme.colors.accent.action}33` },
  inviteRefuse: { backgroundColor: 'rgba(255, 107, 107, 0.18)' },
  inviteButtonText: { color: theme.colors.text.high, fontWeight: '800' },

  confirmButton: { marginTop: 12, borderRadius: 16, overflow: 'hidden' },
  confirmButtonDisabled: { opacity: 0.7 },
  confirmGradient: { paddingVertical: 14, alignItems: 'center' },
  confirmText: { color: theme.colors.bg.primary, fontWeight: '900', fontSize: 15 },

  backButton: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bg.elevated,
    alignSelf: 'flex-start',
  },
  backText: { color: theme.colors.text.high, fontWeight: '800' },
});
