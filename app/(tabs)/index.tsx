// app/(tabs)/index.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Modal,
  Alert,
  ScrollView,
  Platform
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityItem } from "../../components/ActivityItem";
import { useActivities } from "../../context/ActivityContext";
import { useAuth } from "../../context/AuthContext";
import { useChallenge } from "../../context/ChallengeContext";
import type { Activity } from "../../types/Activity";
import { WeeklyCard } from '../../components/WeeklyCard';
import { ChallengeDetailModal } from '../../components/WeeklyChallenge/ChallengeDetailModal';
import { ChallengeForm } from '../../components/WeeklyChallenge/ChallengeForm';
import { InvitationBadge } from '../../components/InvitationBadge';
import { InvitationsModal } from '../../components/InvitationsModal';
import { theme } from '../../utils/theme';
import { usePartner } from "../../context/PartnerContext";

export default function HomeScreen() {
  const { activities, duoActivities, removeActivity, error, clearError } = useActivities();
  const { user } = useAuth();
  const { currentChallenge, pendingSentChallenge } = useChallenge();
  const { activeSlot, partnerLinks } = usePartner();
  const router = useRouter();

  const partnerIdForActiveSlot = useMemo(() => {
    if (!(activeSlot === 'p1' || activeSlot === 'p2')) return undefined;
    const link = (partnerLinks || []).find((l: any) => l?.slot === activeSlot);
    const id = (link as any)?.partnerId || (link as any)?.partner?._id || (link as any)?.partner?.id;
    return id ? String(id) : undefined;
  }, [activeSlot, partnerLinks]);

  const activeSlotLink = useMemo(() => {
    if (!(activeSlot === 'p1' || activeSlot === 'p2')) return null;
    return (partnerLinks || []).find((l: any) => l?.slot === activeSlot) || null;
  }, [activeSlot, partnerLinks]);

  const isPartnerLinkPending = Boolean((activeSlotLink as any)?.partnerId && (activeSlotLink as any)?.status === 'pending');
  const isPendingSentDuoChallenge = Boolean(pendingSentChallenge && pendingSentChallenge.status === 'pending' && pendingSentChallenge.mode === 'duo');

  const lockReason: 'missingPartner' | 'pendingPartner' | 'pendingChallenge' | null = (() => {
    if (!(activeSlot === 'p1' || activeSlot === 'p2')) return null;
    if (!partnerIdForActiveSlot) return 'missingPartner';
    if (isPartnerLinkPending) return 'pendingPartner';
    if (isPendingSentDuoChallenge) return 'pendingChallenge';
    return null;
  })();

  const isLockedDuo = Boolean(lockReason);
  
  const [showChallengeForm, setShowChallengeForm] = useState(false);
  // default mode for the create challenge form (solo | duo)
  const [createDefaultMode, setCreateDefaultMode] = useState<'solo' | 'duo'>('solo');
  const [showChallengeDetail, setShowChallengeDetail] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);
  useEffect(() => {
    if (error) {
      Alert.alert("Erreur", error, [{ text: "OK", onPress: clearError }]);
    }
  }, [error, clearError]);

  const displayedActivities = useMemo(() => {
    // Slot-aware history:
    // - solo: user's activities
    // - p1/p2: shared activities returned by /activities/shared/:partnerId (includes both users)
    const map = new Map<string, Activity>();

    const upsert = (a: Activity) => {
      const id = a._id || a.id;
      if (!id) return;
      map.set(id, a);
    };

    // ✅ Source of truth for this screen is the active slot.
    // This ensures the UI switches correctly when moving solo <-> duo and when switching P1 <-> P2.
    const base = (activeSlot === 'solo' ? activities : duoActivities) || [];
    base.forEach(upsert);

    return Array.from(map.values()).sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return db - da;
    });
  }, [activities, duoActivities, activeSlot]);

  const handleCreateChallengeSuccess = (result?: { mode: 'solo' | 'duo'; partnerName?: string; invitationPending?: boolean }) => {
    setShowChallengeForm(false);

    if (result?.mode === 'duo' && result.invitationPending) {
      return;
    }

    Alert.alert('✅ Succès', 'Pacte créé avec succès !');
  };

  const getUserInitial = () => {
    const nameSource = user?.username || user?.email?.split('@')[0];
    const initial = nameSource?.trim()?.charAt(0);
    return initial ? initial.toUpperCase() : 'U';
  };

  const getPartnerName = () => {
    // Priorité: slot actif (p1/p2)
    if (activeSlot !== 'solo') {
      const link = partnerLinks.find((p) => p.slot === activeSlot);
      const partnerUsername = (link as any)?.partner?.username;
      if (partnerUsername) return partnerUsername;
      const email = (link as any)?.partner?.email;
      if (email) return email.split('@')[0];
    }

    // Si slot solo mais challenge DUO actif, extraire l'autre joueur
    if (currentChallenge?.mode === 'duo' && user?._id) {
      const meId = user._id?.toString();
      const opponent = currentChallenge.players?.find((pl) => {
        const pid = typeof pl.user === 'string' ? pl.user : pl.user?._id;
        return pid && pid.toString() !== meId;
      });
      const opponentUsername = typeof opponent?.user === 'string'
        ? undefined
        : (opponent as any)?.user?.username;
      if (opponentUsername) return opponentUsername;

      const opponentEmail = typeof opponent?.user === 'string' ? opponent.user : opponent?.user?.email;
      if (opponentEmail) return opponentEmail.split('@')[0];
    }

    return 'Partenaire';
  };

  const isCountedForChallenge = useCallback((activity: Activity) => {
    if (!currentChallenge || currentChallenge.status !== 'active') return false;
    if (!currentChallenge.startDate || !currentChallenge.endDate) return false;

    // Match backend logic (server/services/challengeService.js):
    // - normalize start/end to full-day bounds
    // - require activity.createdAt >= max(startDateNormalized, challenge.createdAt)
    const startDateNormalized = new Date(currentChallenge.startDate);
    startDateNormalized.setHours(0, 0, 0, 0);

    const endDateNormalized = new Date(currentChallenge.endDate);
    endDateNormalized.setHours(23, 59, 59, 999);

    const createdAtDate = currentChallenge.createdAt
      ? new Date(currentChallenge.createdAt)
      : startDateNormalized;

    const lowerBound = startDateNormalized > createdAtDate ? startDateNormalized : createdAtDate;

    const activityTime = new Date(activity.date).getTime();
    if (Number.isNaN(activityTime)) return false;
    if (activityTime < startDateNormalized.getTime() || activityTime > endDateNormalized.getTime()) {
      return false;
    }

    const types = Array.isArray(currentChallenge.activityTypes) ? currentChallenge.activityTypes : [];
    if (types.length === 0) return false;
    if (!types.includes(activity.type)) return false;

    // createdAt may not be typed/returned everywhere; if missing, keep backward-compatible behavior.
    const activityCreatedAtRaw = (activity as any)?.createdAt;
    if (activityCreatedAtRaw) {
      const createdAtTime = new Date(activityCreatedAtRaw).getTime();
      if (!Number.isNaN(createdAtTime) && createdAtTime < lowerBound.getTime()) {
        return false;
      }
    }

    return true;
  }, [currentChallenge]);

  const countedActivities = useMemo(() => {
    if (!currentChallenge || currentChallenge.status !== 'active') return [] as Activity[];
    return displayedActivities.filter((a) => isCountedForChallenge(a));
  }, [displayedActivities, currentChallenge, isCountedForChallenge]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView edges={['top']}>
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarsStack}>
              <LinearGradient
                colors={theme.gradients.countdown as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.avatar, styles.avatar1]}
              >
                <Text style={styles.avatarText}>{getUserInitial()}</Text>
              </LinearGradient>
              
              {(activeSlot !== 'solo' || currentChallenge?.mode === 'duo') && (
                <LinearGradient
                  colors={[theme.colors.users.secondary, theme.colors.error]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.avatar, styles.avatar2]}
                >
                  <Text style={styles.avatarText}>
                    {getPartnerName()?.[0]?.toUpperCase() || '?'}
                  </Text>
                </LinearGradient>
              )}

              {!currentChallenge && activeSlot === 'solo' && (
                <View style={[styles.avatar, styles.avatar2, styles.avatarEmpty]}>
                  <Ionicons name="person-add-outline" size={20} color={theme.colors.text.muted} />
                </View>
              )}
            </View>

            {currentChallenge?.mode === 'duo' && (
              <View style={styles.headerInfo}>
                <Text style={styles.teamName}>
                  {getPartnerName()}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.headerRight}>
            {/* ✅ COMPTEUR DIAMANTS */}
            <View style={styles.diamondCounter}>
              <Text style={styles.diamondCount}>{user?.totalDiamonds || 0}</Text>
              <Text style={styles.diamondIcon}>💎</Text>
            </View>

            <TouchableOpacity 
              style={styles.iconBtn}
              onPress={() => router.push('/users')}
            >
              <Ionicons name="people-outline" size={18} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* ScrollView */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Carte challenge */}
        <WeeklyCard 
          onChallengePress={() => setShowChallengeDetail(true)}
          onCreateChallenge={(mode?: 'solo' | 'duo') => {
            // Mode is locked to the active slot:
            // - solo slot -> solo challenge only
            // - p1/p2 slot -> duo challenge only
            const lockedMode = activeSlot === 'solo' ? 'solo' : 'duo';
            setCreateDefaultMode(lockedMode);
            setShowChallengeForm(true);
          }}
        />

        {/* Badge invitations */}
        <InvitationBadge onPress={() => setShowInvitations(true)} />

        {/* Activités du pacte (utilisées pour le score) */}
        <View style={styles.activitiesTitleRow}>
          <Ionicons name="trophy-outline" size={20} color={theme.colors.users.primary} />
          <Text style={styles.activitiesTitle}>Activités du pacte</Text>
        </View>

        {!currentChallenge || currentChallenge.status !== 'active' ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucun pacte actif</Text>
            <Text style={styles.emptySubtext}>Crée un pacte pour voir les activités comptabilisées</Text>
          </View>
        ) : countedActivities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucune activité comptabilisée</Text>
            <Text style={styles.emptySubtext}>Ajoute une activité compatible avec le pacte</Text>
          </View>
        ) : (
          <View>
            {countedActivities.map((a) => (
              <ActivityItem
                key={a._id || a.id}
                activity={a}
                onDelete={removeActivity}
                // highlight -> affichage d'un petit éclair dans la carte
                highlight={true}
                showDelete={false}
                headerVariant="challenge"
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal détail pacte */}
      <ChallengeDetailModal 
        visible={showChallengeDetail}
        onClose={() => setShowChallengeDetail(false)}
      />

      {/* Modal création pacte */}
      <Modal
        visible={showChallengeForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowChallengeForm(false)}
      >
        <View style={styles.challengeModalHeader}>
          <TouchableOpacity onPress={() => setShowChallengeForm(false)}>
            <Ionicons name="close" size={28} color={theme.colors.text.high} />
          </TouchableOpacity>
          <Text style={styles.challengeModalTitle}>Nouveau pacte</Text>
          <View style={{ width: 28 }} />
        </View>
        <ChallengeForm 
          mode="create"
          defaultMode={createDefaultMode}
          onSuccess={handleCreateChallengeSuccess}
          onCancel={() => setShowChallengeForm(false)}
        />
      </Modal>

      {/* Modal invitations */}
      <InvitationsModal
        visible={showInvitations}
        onClose={() => setShowInvitations(false)}
      />

      {isLockedDuo ? (
        <View style={styles.lockOverlay} pointerEvents="auto">
          <View style={styles.lockCard}>
            <Ionicons name="lock-closed-outline" size={22} color={theme.colors.text.high} />
            <Text style={styles.lockTitle}>Pactes verrouillés</Text>
            <Text style={styles.lockSubtitle}>
              {lockReason === 'missingPartner'
                ? `Ton mode actif est ${activeSlot.toUpperCase()} mais aucun partenaire n’est lié. Va dans Profil puis Paramètres pour inviter / lier un partenaire.`
                : lockReason === 'pendingPartner'
                  ? `Invitation partenaire (${activeSlot.toUpperCase()}) en attente de confirmation.`
                  : `Invitation de pacte en attente de réponse.`}
            </Text>

            <View style={styles.lockButtonsRow}>
              <TouchableOpacity style={styles.lockSecondaryButton} onPress={() => router.push('/profile')}>
                <Ionicons name="person-circle-outline" size={18} color={theme.colors.text.high} />
                <Text style={styles.lockSecondaryButtonText}>Profil</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg.primary,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarsStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatar1: {
    borderColor: theme.colors.users.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 2,
  },
  avatar2: {
    marginLeft: -12,
    zIndex: 1,
  },
  avatarEmpty: {
    backgroundColor: theme.colors.bg.elevated,
    borderColor: theme.colors.borderSubtle,
    shadowOpacity: 0,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  headerInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  teamSubtitle: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  diamondCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.bg.sunken,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  diamondCount: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text.primary,
  },
  diamondIcon: {
    fontSize: 16,
  },
  iconBtn: {
    width: 36,
    height: 36,
    backgroundColor: theme.colors.bg.sunken,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.select({
      ios: 140,
      android: 130,
      web: 110,
    }),
  },
  activitiesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    marginTop: 8,
  },
  activitiesTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
  },
  challengeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.bg.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  challengeModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },

  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.bg.primary,
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 50,
  },
  lockCard: {
    backgroundColor: theme.colors.bg.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  lockTitle: {
    color: theme.colors.text.high,
    fontSize: 18,
    fontWeight: '800',
  },
  lockSubtitle: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  lockButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  lockPrimaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.users.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  lockPrimaryButtonText: {
    color: theme.colors.bg.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  lockSecondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg.cardSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  lockSecondaryButtonText: {
    color: theme.colors.text.high,
    fontSize: 14,
    fontWeight: '800',
  },
});