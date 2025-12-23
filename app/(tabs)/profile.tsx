// app/(tabs)/profile.tsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  FlatList,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { usePartner } from '../../context/PartnerContext';
import { useActivities } from '../../context/ActivityContext';
import { useChallenge } from '../../context/ChallengeContext';

import { ActivityForm } from '../../components/ActivityForm';
import { ActivityItem } from '../../components/ActivityItem';
import type { Activity } from '../../types/Activity';
import { theme } from '../../utils/theme';
import { confirmDestructive, showMessage } from '../../utils/dialogs';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, reloadUser } = useAuth();
  const {
    activeSlot,
    partnerLinks,
    incomingInvites,
    acceptIncomingInvite,
    refuseIncomingInvite,
    updatePartners,
    refreshIncomingInvites,
  } = usePartner();
  const { activities, removeActivity } = useActivities();
  const {
    currentChallenge,
    pendingInvitations,
    pendingSentChallenge,
    acceptInvitation,
    refuseInvitation,
    deleteChallenge,
    refreshInvitations,
  } = useChallenge();

  const [isFormVisible, setIsFormVisible] = useState(false);

  // Ensure received invites show up immediately when opening Profile.
  // IMPORTANT: context callbacks are not memoized, so depending on them can retrigger this effect constantly.
  const refreshFnsRef = useRef({ refreshIncomingInvites, refreshInvitations });
  useEffect(() => {
    refreshFnsRef.current = { refreshIncomingInvites, refreshInvitations };
  }, [refreshIncomingInvites, refreshInvitations]);

  useFocusEffect(
    React.useCallback(() => {
      refreshFnsRef.current.refreshIncomingInvites().catch(() => undefined);
      refreshFnsRef.current.refreshInvitations().catch(() => undefined);
    }, [])
  );

  const pulse = useRef(new Animated.Value(0.25)).current;

  const hasConfirmedPartnerForActiveSlot = useMemo(() => {
    if (activeSlot === 'solo') return false;
    const links = Array.isArray(partnerLinks) ? partnerLinks : [];
    return links.some((l: any) => l?.slot === activeSlot && l?.status === 'confirmed');
  }, [partnerLinks, activeSlot]);

  const shouldShowValidatedGreen =
    (activeSlot === 'p1' || activeSlot === 'p2') && hasConfirmedPartnerForActiveSlot;

  const ringColor = shouldShowValidatedGreen
    ? theme.colors.success
    : theme.colors.users.primary;

  const shouldAnimateRing = !shouldShowValidatedGreen;

  useEffect(() => {
    if (!shouldAnimateRing) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }

    pulse.setValue(0.25);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.25, duration: 1100, useNativeDriver: true }),
      ])
    );

    anim.start();
    return () => {
      anim.stop();
    };
  }, [pulse, shouldAnimateRing]);

  const sortedActivities = useMemo(() => {
    const list = Array.isArray(activities) ? [...activities] : [];
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activities]);

  const isCountedForChallenge = (activity: Activity) => {
    if (!currentChallenge || currentChallenge.status !== 'active') return false;
    if (!currentChallenge.startDate || !currentChallenge.endDate) return false;

    const t = new Date(activity.date).getTime();
    const start = new Date(currentChallenge.startDate).getTime();
    const end = new Date(currentChallenge.endDate).getTime();

    if (t < start || t > end) return false;
    const types = Array.isArray(currentChallenge.activityTypes) ? currentChallenge.activityTypes : [];
    return types.includes(activity.type);
  };

  const getUserInitial = () => {
    const nameSource = (user as any)?.username || user?.email?.split('@')[0];
    const initial = nameSource?.trim()?.charAt(0);
    return initial ? initial.toUpperCase() : 'U';
  };

  const linkedPartnerLabel = useMemo(() => {
    const links = Array.isArray(partnerLinks) ? partnerLinks : [];

    const pick = (slot: 'p1' | 'p2') =>
      links.find((l: any) => l?.slot === slot && l?.status === 'confirmed');

    const activeLink = activeSlot === 'p1' || activeSlot === 'p2' ? pick(activeSlot) : null;
    const fallbackLink = pick('p1') || pick('p2');
    const link = activeLink || fallbackLink;

    const partnerUsername = (link as any)?.partner?.username;
    const email = (link as any)?.partner?.email;
    const name = partnerUsername || (email ? email.split('@')[0] : null);
    return name ? `Partenaire : ${name}` : 'Choisir un partenaire';
  }, [partnerLinks, activeSlot]);

  const incomingPartnerInvitesPending = useMemo(() => {
    const all = Array.isArray(incomingInvites) ? incomingInvites : [];
    return all.filter((i: any) => i?.status === 'pending');
  }, [incomingInvites]);

  const pendingPartnerLinks = useMemo(() => {
    const links = Array.isArray(partnerLinks) ? partnerLinks : [];
    return (links as any[]).filter((l) => l?.status === 'pending' && (l?.slot === 'p1' || l?.slot === 'p2'));
  }, [partnerLinks]);

  const firstIncomingChallengeInvite = useMemo(() => {
    const list = Array.isArray(pendingInvitations) ? pendingInvitations : [];
    return list.length > 0 ? list[0] : null;
  }, [pendingInvitations]);

  const hasPendingBlock = Boolean(
    (incomingPartnerInvitesPending && incomingPartnerInvitesPending.length > 0) ||
      (pendingPartnerLinks && pendingPartnerLinks.length > 0) ||
      firstIncomingChallengeInvite ||
      (pendingSentChallenge && pendingSentChallenge.status === 'pending' && pendingSentChallenge.mode === 'duo')
  );

  const getInviteUserLabel = (u?: { username?: string; email?: string } | null) => {
    if (!u) return 'Utilisateur';
    if (u.username) return u.username;
    if (!u.email) return 'Utilisateur';
    return u.email.split('@')[0] || u.email;
  };

  const formatSlotLabel = (slot?: string) => {
    const s = String(slot || '').toUpperCase();
    return s === 'P1' || s === 'P2' ? s : 'P?';
  };

  const getPendingSentChallengePartnerName = () => {
    if (!pendingSentChallenge || pendingSentChallenge.mode !== 'duo') return 'Partenaire';
    const players = (pendingSentChallenge as any).players || [];
    const partner = players.find((p: any) => {
      const userId = typeof p.user === 'string' ? p.user : p.user?._id;
      return userId && user?._id && userId !== user._id;
    });
    const partnerUser = partner ? (typeof partner.user === 'string' ? null : partner.user) : null;
    return getInviteUserLabel(partnerUser);
  };

  const cancelSentPartnerInvite = async (slot: 'p1' | 'p2') => {
    const confirmed = await confirmDestructive({
      title: 'Annuler l’invitation',
      message: 'Annuler l’invitation partenaire en attente ?',
      confirmText: 'Annuler',
    });
    if (!confirmed) return;

    const links = Array.isArray(partnerLinks) ? partnerLinks : [];
    const p1 = (links as any[]).find((l) => l?.slot === 'p1')?.partnerId || null;
    const p2 = (links as any[]).find((l) => l?.slot === 'p2')?.partnerId || null;

    try {
      await updatePartners(slot === 'p1' ? null : p1, slot === 'p2' ? null : p2);
      showMessage({ title: '✅', message: 'Invitation annulée.' });
    } catch (e: any) {
      showMessage({ title: 'Erreur', message: e?.message || 'Impossible d’annuler' });
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <FlatList
          data={sortedActivities}
          keyExtractor={(item) => item._id || item.id}
          renderItem={({ item }) => (
            <View style={styles.activityCardWrapper}>
              <ActivityItem
                activity={item}
                onDelete={removeActivity}
                highlight={isCountedForChallenge(item)}
                variant="subtle"
                showUserBadge={false}
              />
            </View>
          )}
          ListHeaderComponent={
            <View>
              <View style={styles.header}>
                <View style={styles.headerTopRow}>
                  <View style={styles.headerTitleRow}>
                    <Ionicons name="person-outline" size={22} color={theme.colors.text.high} />
                    <Text style={styles.title}>Profil</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.settingsIconButton}
                    onPress={() => router.push('/settings')}
                    accessibilityRole="button"
                    accessibilityLabel="Ouvrir les paramètres"
                  >
                    <Ionicons name="settings-outline" size={18} color={theme.colors.text.high} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.subtitle}>Compte, mode actif et toutes tes activités.</Text>
              </View>

              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderText}>Compte</Text>
              </View>

              <TouchableOpacity
                style={styles.profileCard}
                onPress={() => router.push('/partner-selection')}
                accessibilityRole="button"
              >
                {/* Dynamic active-mode ring */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.activeModeRing,
                    { borderColor: ringColor, opacity: pulse },
                  ]}
                />
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>{getUserInitial()}</Text>
                </View>

                <View style={styles.profileInfo}>
                  <View style={styles.profileTopRow}>
                    <Text style={styles.profileTitle}>Compte</Text>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.text.tertiary} />
                  </View>

                  <Text style={styles.profileSub}>{`Mode actif : ${activeSlot.toUpperCase()}`}</Text>
                  {activeSlot !== 'solo' && (
                    <Text style={styles.profilePartner}>{linkedPartnerLabel}</Text>
                  )}
                </View>
              </TouchableOpacity>

              {hasPendingBlock ? (
                <View>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeaderText}>À traiter</Text>
                  </View>

                  <View style={styles.pendingWrap}>
                    <View style={styles.pendingCard}>
                    <View style={styles.pendingHeaderRow}>
                      <Ionicons name="time-outline" size={18} color={theme.colors.warning} />
                      <Text style={styles.pendingTitle}>En attente</Text>
                    </View>

                    {incomingPartnerInvitesPending.length > 0 ? (
                      <View style={styles.pendingItem}>
                        {incomingPartnerInvitesPending.map((inv: any) => (
                          <View key={String(inv?._id)} style={styles.pendingRowItem}>
                            <View style={styles.pendingRowHeader}>
                              <Text style={[styles.pendingText, styles.pendingTextFlex]}>
                                Invitation partenaire reçue de {getInviteUserLabel(inv?.fromUser?.email)} ({formatSlotLabel(inv?.slot)}).
                              </Text>

                              <View style={styles.pendingActionsRow}>
                                <TouchableOpacity
                                  style={[styles.pendingActionButton, styles.pendingActionButtonDecline]}
                                  onPress={async () => {
                                    try {
                                      await refuseIncomingInvite(inv._id);
                                      showMessage({ title: '✅', message: 'Invitation refusée.' });
                                    } catch (e: any) {
                                      showMessage({ title: 'Erreur', message: e?.message || 'Impossible de refuser' });
                                    }
                                  }}
                                  accessibilityRole="button"
                                >
                                  <Ionicons name="close" size={14} color={theme.colors.text.tertiary} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={[styles.pendingActionButton, styles.pendingActionButtonAccept]}
                                  onPress={async () => {
                                    try {
                                      await acceptIncomingInvite(inv._id);
                                      showMessage({ title: '✅', message: 'Partenaire accepté.' });
                                    } catch (e: any) {
                                      showMessage({ title: 'Erreur', message: e?.message || 'Impossible d’accepter' });
                                    }
                                  }}
                                  accessibilityRole="button"
                                >
                                  <Ionicons name="checkmark" size={14} color={theme.colors.users.primary} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {pendingPartnerLinks.length > 0 ? (
                      <View style={styles.pendingItem}>
                        {pendingPartnerLinks.map((l: any) => (
                          <View key={String(l?.slot)} style={styles.pendingRowItem}>
                            <View style={styles.pendingRowHeader}>
                              <Text style={[styles.pendingText, styles.pendingTextFlex]}>
                                Invitation partenaire envoyée à {getInviteUserLabel(l?.partner?.email)} ({formatSlotLabel(l?.slot)}) en attente de confirmation.
                              </Text>

                              <TouchableOpacity
                                style={styles.pendingActionButton}
                                onPress={() => cancelSentPartnerInvite(l.slot)}
                                accessibilityRole="button"
                              >
                                <Ionicons name="close" size={14} color={theme.colors.text.tertiary} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {Array.isArray(pendingInvitations) && pendingInvitations.length > 0 ? (
                      <View style={styles.pendingItem}>
                        {pendingInvitations.map((inv: any) => {
                          const id = String(inv?._id || inv?.id);
                          return (
                            <View key={id} style={styles.pendingRowItem}>
                              <View style={styles.pendingRowHeader}>
                                <Text style={[styles.pendingText, styles.pendingTextFlex]}>
                                  Invitation de pacte reçue: {inv?.title || 'Pacte'}.
                                </Text>

                                <View style={styles.pendingActionsRow}>
                                  <TouchableOpacity
                                    style={[styles.pendingActionButton, styles.pendingActionButtonDecline]}
                                    onPress={async () => {
                                      try {
                                        await refuseInvitation(id);
                                        showMessage({ title: '✅', message: 'Invitation refusée.' });
                                      } catch (e: any) {
                                        showMessage({ title: 'Erreur', message: e?.message || 'Impossible de refuser' });
                                      }
                                    }}
                                    accessibilityRole="button"
                                  >
                                    <Ionicons name="close" size={14} color={theme.colors.text.tertiary} />
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    style={[styles.pendingActionButton, styles.pendingActionButtonAccept]}
                                    onPress={async () => {
                                      try {
                                        await acceptInvitation(id);
                                        showMessage({ title: '✅', message: 'Pacte accepté.' });
                                      } catch (e: any) {
                                        showMessage({ title: 'Erreur', message: e?.message || 'Impossible d’accepter' });
                                      }
                                    }}
                                    accessibilityRole="button"
                                  >
                                    <Ionicons name="checkmark" size={14} color={theme.colors.users.primary} />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}

                    {pendingSentChallenge?.status === 'pending' && pendingSentChallenge?.mode === 'duo' ? (
                      <View style={styles.pendingItem}>
                        <View style={styles.pendingRowHeader}>
                          <Text style={[styles.pendingText, styles.pendingTextFlex]}>
                            Invitation de pacte envoyée à {getPendingSentChallengePartnerName()} en attente de réponse.
                          </Text>

                          <TouchableOpacity
                            style={styles.pendingActionButton}
                            onPress={async () => {
                            const confirmed = await confirmDestructive({
                              title: 'Annuler le pacte',
                              message: 'Annuler l’invitation en attente ?',
                              confirmText: 'Annuler',
                            });
                            if (!confirmed) return;
                            try {
                              await deleteChallenge();
                              await reloadUser();
                              showMessage({ title: '✅', message: 'Invitation annulée.' });
                            } catch (e: any) {
                              showMessage({ title: 'Erreur', message: e?.message || 'Impossible d’annuler' });
                            }
                            }}
                            accessibilityRole="button"
                          >
                            <Ionicons name="close" size={14} color={theme.colors.text.tertiary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}
                    </View>
                  </View>
                </View>
              ) : null}

              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderText}>Activités</Text>
              </View>

              <View style={styles.activitiesTitleRow}>
                <Ionicons name="pulse" size={20} color={theme.colors.users.primary} />
                <Text style={styles.activitiesTitle}>Toutes mes activités</Text>
              </View>

              {sortedActivities.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Ajoute ici toutes tes activités !</Text>
                </View>
              )}
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>

      {/* FAB ajouter activité */}
      <TouchableOpacity style={styles.fab} onPress={() => setIsFormVisible(true)}>
        <LinearGradient
          colors={theme.gradients.countdown as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={28} color="#000" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Modal activité */}
      <Modal
        visible={isFormVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsFormVisible(false)}
      >
        <View style={styles.activityModalHeader}>
          <TouchableOpacity onPress={() => setIsFormVisible(false)}>
            <Ionicons name="close" size={28} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.activityModalTitle}>Nouvelle activité</Text>
          <View style={{ width: 28 }} />
        </View>
        <ActivityForm onClose={() => setIsFormVisible(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg.primary },

  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.text.high },
  subtitle: { marginTop: 6, fontSize: 13, color: theme.colors.text.secondary, maxWidth: '85%' },

  settingsIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bg.elevated,
  },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bg.elevated,
    marginHorizontal: 20,
    marginBottom: 16,
    position: 'relative',
  },
  activeModeRing: {
    position: 'absolute',
    left: -2,
    right: -2,
    top: -2,
    bottom: -2,
    borderRadius: 18,
    borderWidth: 2,
  },
  profileAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: theme.colors.users.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileAvatarText: { color: '#000', fontSize: 24, fontWeight: '800' },
  profileInfo: { flex: 1 },
  profileTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileTitle: { color: theme.colors.text.high, fontSize: 15, fontWeight: '800' },
  profileSub: { color: theme.colors.text.secondary, marginTop: 4, fontWeight: '600' },
  profilePartner: { color: theme.colors.text.tertiary, marginTop: 4, fontWeight: '700' },

  pendingWrap: {
    marginHorizontal: 20,
    marginBottom: 14,
  },
  pendingCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bg.elevated,
    padding: 14,
    gap: 12,
  },
  pendingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingTitle: {
    color: theme.colors.text.high,
    fontWeight: '900',
    fontSize: 14,
  },
  pendingItem: {
    gap: 10,
  },
  pendingRowItem: {
    gap: 10,
  },
  pendingText: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  pendingTextFlex: {
    flex: 1,
  },
  pendingRowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  pendingActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pendingActionButton: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bg.sunken,
  },
  pendingActionButtonAccept: {
    borderColor: theme.colors.users.primary,
  },
  pendingActionButtonDecline: {
    // Keep it sober: neutral border, icon is tertiary.
    borderColor: theme.colors.borderSubtle,
  },
  pendingPrimaryButton: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.users.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingPrimaryButtonText: {
    color: theme.colors.bg.primary,
    fontWeight: '900',
    fontSize: 13,
  },
  pendingSecondaryButton: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingSecondaryButtonText: {
    color: theme.colors.text.high,
    fontWeight: '900',
    fontSize: 13,
  },

  activitiesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    marginTop: 8,
    marginHorizontal: 20,
  },
  activitiesTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.text.primary },

  sectionHeaderRow: {
    marginHorizontal: 20,
    marginBottom: 10,
    marginTop: 6,
  },
  sectionHeaderText: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  listContent: {
    paddingBottom: Platform.select({ ios: 160, android: 150, web: 130, default: 150 }),
  },

  activityCardWrapper: {
    marginHorizontal: 20,
  },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, marginTop: 48 },
  emptyText: { fontSize: 16, fontWeight: '600', color: theme.colors.text.secondary, marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: theme.colors.text.tertiary },

  fab: {
    position: 'absolute',
    bottom: Platform.select({ ios: 130, android: 130, web: 120, default: 120 }),
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  fabGradient: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },

  activityModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.bg.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  activityModalTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.text.primary },
});
