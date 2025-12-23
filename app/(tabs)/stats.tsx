import React, { useEffect, useMemo, useState } from "react";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useActivities } from "../../context/ActivityContext";
import { useAuth } from "../../context/AuthContext";
import { usePartner } from "../../context/PartnerContext";
import { theme } from '../../utils/theme';
import { activityService } from "../../services/activityService";
import { challengeService } from "../../services/challengeService";
import { statsProcessor, ExtendedStats } from "../../services/statsProcessor";
import { ActivityTypeKey, activityConfig } from "../../utils/activityConfig";
import { useChallenge } from "../../context/ChallengeContext";
import type { Activity } from "../../types/Activity";
import type { Challenge } from "../../types/Challenge";

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes.toFixed(0)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h${mins > 0 ? ` ${mins}` : ''}`;
};

const formatKm = (km: number) => `${km.toFixed(1)} km`;

const formatSpeed = (kmh: number) => `${kmh.toFixed(1)} km/h`;

const formatShortDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

const safeDivide = (a: number, b: number) => (b > 0 ? a / b : 0);

type PeriodKey = 'current' | 'week' | 'month' | 'year';

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const getPeriodRange = (period: PeriodKey) => {
  const end = endOfDay(new Date());
  const start = startOfDay(new Date());
  if (period === 'current') return { start, end };
  if (period === 'week') start.setDate(start.getDate() - 7);
  if (period === 'month') start.setDate(start.getDate() - 30);
  if (period === 'year') start.setDate(start.getDate() - 365);
  return { start, end };
};

const calculateWeeksBetween = (start: Date, end: Date) => {
  const ms = Math.max(0, end.getTime() - start.getTime());
  const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1);
  return Math.max(1, days / 7);
};

const isCountedForChallenge = (activity: Activity, challenge: Challenge) => {
  const types = Array.isArray(challenge.activityTypes) ? challenge.activityTypes : [];
  if (types.length > 0 && !types.includes(activity.type as any)) return false;

  const start = startOfDay(new Date(challenge.startDate));
  const end = endOfDay(new Date(challenge.endDate));
  const t = new Date(activity.date).getTime();
  if (Number.isNaN(t)) return false;
  if (t < start.getTime() || t > end.getTime()) return false;

  const createdAtChallenge = challenge.createdAt ? new Date(challenge.createdAt) : start;
  const lowerBound = start.getTime() > createdAtChallenge.getTime() ? start : createdAtChallenge;
  const createdAtRaw = (activity as any)?.createdAt;
  if (createdAtRaw) {
    const ct = new Date(createdAtRaw).getTime();
    if (!Number.isNaN(ct) && ct < lowerBound.getTime()) return false;
  }

  return true;
};

const calculateWeeksInRange = (startIso?: string, endIso?: string) => {
  if (!startIso || !endIso) return 1;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  // Inclusive-ish: count days spanning the challenge and convert to weeks.
  const ms = Math.max(0, end.getTime() - start.getTime());
  const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1);
  return Math.max(1, days / 7);
};

const CompareRow = ({
  label,
  left,
  right,
  leftColor,
  rightColor,
}: {
  label: string;
  left: string;
  right?: string;
  leftColor: string;
  rightColor?: string;
}) => {
  const hasRight = typeof right === 'string';
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.rowValue, { color: leftColor }]} numberOfLines={1}>
        {left}
      </Text>
      {hasRight ? (
        <Text style={[styles.rowValue, { color: rightColor || theme.colors.text.high }]} numberOfLines={1}>
          {right}
        </Text>
      ) : null}
    </View>
  );
};

export default function StatsScreen() {
  const { activities, duoActivities } = useActivities();
  const { activeSlot, partnerLinks } = usePartner();
  const { user, token } = useAuth();
  const { currentChallenge, pendingSentChallenge } = useChallenge();
  const router = useRouter();
  const [challengeActivities, setChallengeActivities] = useState<Activity[]>([]);
  const [loadingChallengeActivities, setLoadingChallengeActivities] = useState(false);
  const [selectedType, setSelectedType] = useState<ActivityTypeKey | 'all'>('all');
  const [period, setPeriod] = useState<PeriodKey>('current');
  const [duoChallengeHistory, setDuoChallengeHistory] = useState<Challenge[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [soloChallengeHistory, setSoloChallengeHistory] = useState<Challenge[]>([]);
  const [loadingSoloHistory, setLoadingSoloHistory] = useState(false);
  const insets = useSafeAreaInsets();

  const meId = (user as any)?._id || (user as any)?.id;

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

  const getUserInitial = () => {
    const source = (user as any)?.firstname || (user as any)?.username || user?.email?.split('@')[0];
    const initial = source?.trim?.()?.charAt?.(0);
    return initial ? initial.toUpperCase() : 'U';
  };

  const getNameFromUser = (u?: { username?: string; email?: string } | null) => {
    if (!u) return 'Joueur';
    if (u.username) return u.username;
    if (!u.email) return 'Joueur';
    return u.email.split('@')[0] || u.email;
  };

  const getInitialFromEmail = (email?: string) => {
    const name = getNameFromUser(email ? { email } : null);
    const initial = name?.trim?.()?.charAt?.(0);
    return initial ? initial.toUpperCase() : '?';
  };

  // Reset type filter when slot/period changes (safest)
  useEffect(() => {
    setSelectedType('all');
  }, [activeSlot, period]);

  const otherPlayerEmail = useMemo(() => {
    if (!currentChallenge || currentChallenge.mode !== 'duo') return undefined;

    // 1) Preferred: populated players.user.email from the challenge payload
    const players = Array.isArray(currentChallenge.players) ? currentChallenge.players : [];
    const otherPlayer = players.find((p) => {
      const id = typeof p.user === 'string' ? p.user : p.user?._id;
      return meId && id && id.toString() !== meId.toString();
    });
    const emailFromChallenge = typeof otherPlayer?.user === 'string' ? undefined : otherPlayer?.user?.email;
    if (emailFromChallenge) return emailFromChallenge;

    // 2) Fallback: partnerLinks for the active duo slot (p1/p2)
    if (activeSlot === 'p1' || activeSlot === 'p2') {
      const link = (partnerLinks || []).find((l: any) => l?.slot === activeSlot);
      const emailFromLinks = (link as any)?.partner?.email;
      if (emailFromLinks) return emailFromLinks;
    }

    return undefined;
  }, [currentChallenge, meId, activeSlot, partnerLinks]);

  const periodLabel = useMemo(() => {
    if (period === 'current') return 'Pacte en cours';
    if (period === 'week') return 'Semaine';
    if (period === 'month') return 'Mois';
    return 'Année';
  }, [period]);

  // Fetch counted DUO activities (both players) from the dedicated backend endpoint.
  useEffect(() => {
    const shouldFetch = Boolean(token && currentChallenge && currentChallenge.status === 'active' && currentChallenge.mode === 'duo' && (activeSlot === 'p1' || activeSlot === 'p2'));
    if (!shouldFetch) {
      setChallengeActivities([]);
      return;
    }

    let cancelled = false;
    // Avoid full-screen flashing: only show the big loader when we have no cached data.
    setLoadingChallengeActivities(challengeActivities.length === 0);
    activityService
      .getCurrentDuoChallengeActivities(token as string)
      .then((list) => {
        if (cancelled) return;
        setChallengeActivities(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (cancelled) return;
        setChallengeActivities([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingChallengeActivities(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, currentChallenge, activeSlot, challengeActivities.length]);

  // Fetch DUO challenge history for the active slot (p1/p2)
  useEffect(() => {
    const shouldFetchHistory = Boolean(token && (activeSlot === 'p1' || activeSlot === 'p2'));
    if (!shouldFetchHistory) {
      setDuoChallengeHistory([]);
      setLoadingHistory(false);
      return;
    }

    let cancelled = false;
    setLoadingHistory(duoChallengeHistory.length === 0);

    challengeService
      .getDuoChallengeHistory(activeSlot as 'p1' | 'p2', partnerIdForActiveSlot)
      .then((list) => {
        if (cancelled) return;
        setDuoChallengeHistory(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (cancelled) return;
        setDuoChallengeHistory([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, activeSlot, partnerIdForActiveSlot, duoChallengeHistory.length]);

  // Fetch SOLO challenge history
  useEffect(() => {
    const shouldFetchSoloHistory = Boolean(token && activeSlot === 'solo');
    if (!shouldFetchSoloHistory) {
      setSoloChallengeHistory([]);
      setLoadingSoloHistory(false);
      return;
    }

    let cancelled = false;
    setLoadingSoloHistory(soloChallengeHistory.length === 0);

    challengeService
      .getSoloChallengeHistory()
      .then((list) => {
        if (cancelled) return;
        setSoloChallengeHistory(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (cancelled) return;
        setSoloChallengeHistory([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingSoloHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, activeSlot, soloChallengeHistory.length]);

  const countedSoloActivities = useMemo(() => {
    if (!currentChallenge || currentChallenge.status !== 'active') return [] as Activity[];
    if (currentChallenge.mode !== 'solo') return [] as Activity[];
    if (!Array.isArray(activities)) return [] as Activity[];

    const startDateNormalized = new Date(currentChallenge.startDate);
    startDateNormalized.setHours(0, 0, 0, 0);
    const endDateNormalized = new Date(currentChallenge.endDate);
    endDateNormalized.setHours(23, 59, 59, 999);
    const createdAtDate = currentChallenge.createdAt ? new Date(currentChallenge.createdAt) : startDateNormalized;
    const lowerBound = startDateNormalized > createdAtDate ? startDateNormalized : createdAtDate;
    const types = Array.isArray(currentChallenge.activityTypes) ? currentChallenge.activityTypes : [];

    return activities.filter((a) => {
      const t = new Date(a.date).getTime();
      if (Number.isNaN(t)) return false;
      if (t < startDateNormalized.getTime() || t > endDateNormalized.getTime()) return false;
      if (types.length === 0 || !types.includes(a.type)) return false;

      const createdAtRaw = (a as any)?.createdAt;
      if (createdAtRaw) {
        const ct = new Date(createdAtRaw).getTime();
        if (!Number.isNaN(ct) && ct < lowerBound.getTime()) return false;
      }
      return true;
    });
  }, [activities, currentChallenge]);

  const duoHistoryTypes = useMemo(() => {
    const set = new Set<ActivityTypeKey>();
    for (const ch of duoChallengeHistory) {
      const types = Array.isArray(ch.activityTypes) ? ch.activityTypes : [];
      for (const t of types) set.add(t);
    }
    return Array.from(set);
  }, [duoChallengeHistory]);

  const soloHistoryTypes = useMemo(() => {
    const set = new Set<ActivityTypeKey>();
    for (const ch of soloChallengeHistory) {
      const types = Array.isArray(ch.activityTypes) ? ch.activityTypes : [];
      for (const t of types) set.add(t);
    }
    return Array.from(set);
  }, [soloChallengeHistory]);

  const soloHistoryActivities = useMemo(() => {
    if (activeSlot !== 'solo') return [] as Activity[];
    if (period === 'current') return countedSoloActivities;

    const all = Array.isArray(activities) ? activities : [];
    if (all.length === 0) return [] as Activity[];
    if (!Array.isArray(soloChallengeHistory) || soloChallengeHistory.length === 0) return [] as Activity[];

    const { start, end } = getPeriodRange(period);

    const includedChallenges = soloChallengeHistory.filter((ch) => {
      const cs = new Date(ch.startDate);
      const ce = new Date(ch.endDate);
      if (Number.isNaN(cs.getTime()) || Number.isNaN(ce.getTime())) return false;
      return ce.getTime() >= start.getTime() && cs.getTime() <= end.getTime();
    });
    if (includedChallenges.length === 0) return [] as Activity[];

    return all.filter((a) => {
      const t = new Date(a.date).getTime();
      if (Number.isNaN(t)) return false;
      if (t < start.getTime() || t > end.getTime()) return false;
      for (const ch of includedChallenges) {
        if (isCountedForChallenge(a, ch)) return true;
      }
      return false;
    });
  }, [activeSlot, period, activities, soloChallengeHistory, countedSoloActivities]);

  const duoHistoryActivities = useMemo(() => {
    if (!(activeSlot === 'p1' || activeSlot === 'p2')) return [] as Activity[];

    // "Pacte en cours" => use server-counted list (exact scoring parity)
    if (period === 'current') {
      if (currentChallenge && currentChallenge.mode === 'duo' && currentChallenge.status === 'active') {
        return challengeActivities;
      }
      return [] as Activity[];
    }

    const all = Array.isArray(duoActivities) ? duoActivities : [];
    if (all.length === 0) return [] as Activity[];
    if (!Array.isArray(duoChallengeHistory) || duoChallengeHistory.length === 0) return [] as Activity[];

    const { start, end } = getPeriodRange(period);

    const includedChallenges = duoChallengeHistory.filter((ch) => {
      const cs = new Date(ch.startDate);
      const ce = new Date(ch.endDate);
      if (Number.isNaN(cs.getTime()) || Number.isNaN(ce.getTime())) return false;
      return ce.getTime() >= start.getTime() && cs.getTime() <= end.getTime();
    });

    if (includedChallenges.length === 0) return [] as Activity[];

    return all.filter((a) => {
      const t = new Date(a.date).getTime();
      if (Number.isNaN(t)) return false;
      if (t < start.getTime() || t > end.getTime()) return false;
      for (const ch of includedChallenges) {
        if (isCountedForChallenge(a, ch)) return true;
      }
      return false;
    });
  }, [activeSlot, duoActivities, duoChallengeHistory, period, currentChallenge, challengeActivities]);

  const datasetForThisSlot = useMemo(() => {
    if (activeSlot === 'solo') {
      if (period === 'current') {
        if (!currentChallenge || currentChallenge.status !== 'active') return [] as Activity[];
        if (currentChallenge.mode === 'duo') return challengeActivities;
        return countedSoloActivities;
      }
      return soloHistoryActivities;
    }
    // DUO history mode (p1/p2)
    return duoHistoryActivities;
  }, [activeSlot, period, currentChallenge, challengeActivities, countedSoloActivities, soloHistoryActivities, duoHistoryActivities]);

  const { left: leftLabel, right: rightLabel } = useMemo(() => {
    if (!currentChallenge || currentChallenge.mode !== 'duo') {
      return { left: 'Moi', right: undefined as string | undefined };
    }

    const players = Array.isArray(currentChallenge.players) ? currentChallenge.players : [];
    const otherPlayer = players.find((p) => {
      const id = typeof p.user === 'string' ? p.user : p.user?._id;
      return meId && id && id.toString() !== meId.toString();
    });

    const otherUser = typeof otherPlayer?.user === 'string' ? undefined : (otherPlayer as any)?.user;
    return { left: 'Moi', right: getNameFromUser(otherUser) };
  }, [currentChallenge, meId]);

  const leftColor = theme.colors.users.primary;
  const rightColor = theme.colors.users.secondary;

  const { leftActivities, rightActivities } = useMemo(() => {
    // DUO history: split by user id even if currentChallenge is null
    if (activeSlot === 'p1' || activeSlot === 'p2') {
      const left: Activity[] = [];
      const right: Activity[] = [];
      for (const a of datasetForThisSlot) {
        const uid = typeof a.user === 'string' ? a.user : (a.user as any)?._id;
        if (meId && uid && uid.toString() === meId.toString()) {
          left.push(a);
        } else {
          right.push(a);
        }
      }
      return { leftActivities: left, rightActivities: right };
    }

    if (!currentChallenge || currentChallenge.mode !== 'duo') {
      return { leftActivities: datasetForThisSlot, rightActivities: [] as Activity[] };
    }

    const left: Activity[] = [];
    const right: Activity[] = [];

    for (const a of datasetForThisSlot) {
      const uid = typeof a.user === 'string' ? a.user : (a.user as any)?._id;
      if (meId && uid && uid.toString() === meId.toString()) {
        left.push(a);
      } else {
        right.push(a);
      }
    }

    return { leftActivities: left, rightActivities: right };
  }, [datasetForThisSlot, activeSlot, currentChallenge, meId]);

  const filteredLeftActivities = useMemo(() => {
    if (selectedType === 'all') return leftActivities;
    return leftActivities.filter((a) => a.type === selectedType);
  }, [leftActivities, selectedType]);

  const filteredRightActivities = useMemo(() => {
    if (selectedType === 'all') return rightActivities;
    return rightActivities.filter((a) => a.type === selectedType);
  }, [rightActivities, selectedType]);

  const leftStats: ExtendedStats = useMemo(() => {
    return statsProcessor.calculateExtendedStats(filteredLeftActivities);
  }, [filteredLeftActivities]);

  const rightStats: ExtendedStats | null = useMemo(() => {
    if (activeSlot === 'p1' || activeSlot === 'p2') return statsProcessor.calculateExtendedStats(filteredRightActivities);
    if (!currentChallenge || currentChallenge.mode !== 'duo') return null;
    return statsProcessor.calculateExtendedStats(filteredRightActivities);
  }, [filteredRightActivities, currentChallenge, activeSlot]);

  const hasAnyData = datasetForThisSlot.length > 0;
  const showFullScreenLoading = (loadingChallengeActivities || loadingHistory || loadingSoloHistory) && !hasAnyData;
  const isRefreshing = Boolean(loadingChallengeActivities || loadingHistory || loadingSoloHistory);

  if (isLockedDuo) {
    return (
      <View style={styles.container}>
        <View style={styles.lockOverlay} pointerEvents="auto">
          <View style={styles.lockCard}>
            <Ionicons name="lock-closed-outline" size={22} color={theme.colors.text.high} />
            <Text style={styles.lockTitle}>Stats verrouillées</Text>
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
      </View>
    );
  }

  if (showFullScreenLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="stats-chart" size={48} color={theme.colors.users.primary} />
        <Text style={styles.loadingText}>Chargement des statistiques...</Text>
      </View>
    );
  }

  const contentContainerStyle = [
    styles.contentContainer,
    { paddingBottom: Math.max(styles.contentContainer.paddingBottom || 0, (insets.bottom || 0) + 120), flexGrow: 1 }
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={contentContainerStyle} showsVerticalScrollIndicator>
      {/* Header */}
      <View style={styles.header}>
          <View style={styles.avatarsStack}>
            <View style={[styles.avatar, styles.avatar1, { backgroundColor: theme.colors.users.primary, borderColor: theme.colors.users.primary }]}
            >
              <Text style={styles.avatarText}>{getUserInitial()}</Text>
            </View>

            {currentChallenge?.mode === 'duo' && (
              <View
                style={[
                  styles.avatar,
                  styles.avatar2,
                  { backgroundColor: theme.colors.users.secondary, borderColor: theme.colors.users.secondary },
                ]}
              >
                <Text style={styles.avatarText}>{getInitialFromEmail(otherPlayerEmail)}</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{activeSlot === 'solo' ? 'Stats du pacte' : 'Stats des pactes'}</Text>
            <Text style={styles.subtitle}>
              {activeSlot === 'solo'
                ? (currentChallenge ? currentChallenge.title : 'Aucun pacte solo actif')
                : `DUO • ${periodLabel} • activités comptées`}
            </Text>
            {activeSlot === 'solo' && currentChallenge && (
              <Text style={styles.subtitle}>
                {(currentChallenge.mode || '').toUpperCase()} • {formatShortDate(currentChallenge.startDate)} → {formatShortDate(currentChallenge.endDate)}
              </Text>
            )}
          </View>
          <View style={styles.refreshingSlot}>
            <Text style={[styles.refreshing, !isRefreshing && styles.refreshingHidden]}>Mise à jour…</Text>
          </View>
      </View>

      {/* Period selector (DUO history mode) */}
      {(activeSlot === 'p1' || activeSlot === 'p2' || activeSlot === 'solo') && (
        <View style={styles.periodSelector}>
          <TouchableOpacity onPress={() => setPeriod('current')} style={[styles.periodPill, period === 'current' && styles.periodPillActive]}>
            <Text style={[styles.periodPillText, period === 'current' && styles.periodPillTextActive]}>Pacte</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPeriod('week')} style={[styles.periodPill, period === 'week' && styles.periodPillActive]}>
            <Text style={[styles.periodPillText, period === 'week' && styles.periodPillTextActive]}>Semaine</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPeriod('month')} style={[styles.periodPill, period === 'month' && styles.periodPillActive]}>
            <Text style={[styles.periodPillText, period === 'month' && styles.periodPillTextActive]}>Mois</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPeriod('year')} style={[styles.periodPill, period === 'year' && styles.periodPillActive]}>
            <Text style={[styles.periodPillText, period === 'year' && styles.periodPillTextActive]}>Année</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Type selector */}
      {activeSlot === 'solo' && period === 'current' && currentChallenge && Array.isArray(currentChallenge.activityTypes) && currentChallenge.activityTypes.length > 1 && (
        <View style={styles.typeSelector}>
          <TouchableOpacity
            onPress={() => setSelectedType('all')}
            style={[
              styles.typePill,
              selectedType === 'all' && styles.typePillActive,
            ]}
          >
            <Text style={[styles.typePillText, selectedType === 'all' && styles.typePillTextActive]}>Tous</Text>
          </TouchableOpacity>
          {currentChallenge.activityTypes.map((t) => {
            const cfg = activityConfig[t as ActivityTypeKey];
            const IconComponent = cfg?.iconFamily === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;
            const active = selectedType === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setSelectedType(t)}
                style={[styles.typePill, active && styles.typePillActive]}
              >
                <IconComponent
                  name={cfg?.icon as any}
                  size={16}
                  color={active ? theme.colors.text.high : theme.colors.text.tertiary}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {activeSlot === 'solo' && period !== 'current' && soloHistoryTypes.length > 1 && (
        <View style={styles.typeSelector}>
          <TouchableOpacity
            onPress={() => setSelectedType('all')}
            style={[styles.typePill, selectedType === 'all' && styles.typePillActive]}
          >
            <Text style={[styles.typePillText, selectedType === 'all' && styles.typePillTextActive]}>Tous</Text>
          </TouchableOpacity>
          {soloHistoryTypes.map((t) => {
            const cfg = activityConfig[t as ActivityTypeKey];
            const IconComponent = cfg?.iconFamily === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;
            const active = selectedType === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setSelectedType(t)}
                style={[styles.typePill, active && styles.typePillActive]}
              >
                <IconComponent
                  name={cfg?.icon as any}
                  size={16}
                  color={active ? theme.colors.text.high : theme.colors.text.tertiary}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {(activeSlot === 'p1' || activeSlot === 'p2') && duoHistoryTypes.length > 1 && (
        <View style={styles.typeSelector}>
          <TouchableOpacity
            onPress={() => setSelectedType('all')}
            style={[styles.typePill, selectedType === 'all' && styles.typePillActive]}
          >
            <Text style={[styles.typePillText, selectedType === 'all' && styles.typePillTextActive]}>Tous</Text>
          </TouchableOpacity>
          {duoHistoryTypes.map((t) => {
            const cfg = activityConfig[t as ActivityTypeKey];
            const IconComponent = cfg?.iconFamily === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;
            const active = selectedType === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setSelectedType(t)}
                style={[styles.typePill, active && styles.typePillActive]}
              >
                <IconComponent
                  name={cfg?.icon as any}
                  size={16}
                  color={active ? theme.colors.text.high : theme.colors.text.tertiary}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {datasetForThisSlot.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Lance un pacte et enregistre des activités pour voir vos stats !</Text>
        </View>
      ) : (
        <>
          {(() => {
            const weeks = activeSlot === 'solo'
              ? calculateWeeksInRange(currentChallenge?.startDate, currentChallenge?.endDate)
              : (period === 'current' && currentChallenge
                  ? calculateWeeksInRange(currentChallenge.startDate, currentChallenge.endDate)
                  : (() => {
                      const { start, end } = getPeriodRange(period);
                      return calculateWeeksBetween(start, end);
                    })());
            const right = rightStats;

            const leftPerWeekActivities = safeDivide(leftStats.totalActivities, weeks);
            const leftPerWeekDistance = safeDivide(leftStats.totalDistance, weeks);
            const leftPerWeekElevation = safeDivide(leftStats.totalElevationGain, weeks);
            const leftPerWeekDuration = safeDivide(leftStats.totalDuration, weeks);

            const rightPerWeekActivities = right ? safeDivide(right.totalActivities, weeks) : 0;
            const rightPerWeekDistance = right ? safeDivide(right.totalDistance, weeks) : 0;
            const rightPerWeekElevation = right ? safeDivide(right.totalElevationGain, weeks) : 0;
            const rightPerWeekDuration = right ? safeDivide(right.totalDuration, weeks) : 0;

            const leftAvgDistancePerAct = safeDivide(leftStats.totalDistance, leftStats.totalActivities);
            const rightAvgDistancePerAct = right ? safeDivide(right.totalDistance, right.totalActivities) : 0;

            const leftAvgDurationPerAct = safeDivide(leftStats.totalDuration, leftStats.totalActivities);
            const rightAvgDurationPerAct = right ? safeDivide(right.totalDuration, right.totalActivities) : 0;

            const showRight = Boolean((activeSlot === 'p1' || activeSlot === 'p2') || (right && rightLabel));

            return (
              <>
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={styles.th} />
                    <Text style={[styles.th, { color: leftColor }]}>{leftLabel}</Text>
                    {showRight ? <Text style={[styles.th, { color: rightColor }]}>{rightLabel || 'Partenaire'}</Text> : null}
                  </View>

                  <View style={styles.sectionRow}>
                    <Text style={styles.sectionRowText}>Résumé (total)</Text>
                  </View>
                  <CompareRow label="Activités" left={`${leftStats.totalActivities}`} right={showRight ? `${right!.totalActivities}` : undefined} leftColor={leftColor} rightColor={rightColor} />
                  <CompareRow label="Distance" left={formatKm(leftStats.totalDistance)} right={showRight ? formatKm(right!.totalDistance) : undefined} leftColor={leftColor} rightColor={rightColor} />
                  <CompareRow label="Dénivelé" left={`${leftStats.totalElevationGain.toFixed(0)} m`} right={showRight ? `${right!.totalElevationGain.toFixed(0)} m` : undefined} leftColor={leftColor} rightColor={rightColor} />
                  <CompareRow label="Durée" left={formatDuration(leftStats.totalDuration)} right={showRight ? formatDuration(right!.totalDuration) : undefined} leftColor={leftColor} rightColor={rightColor} />

                  <View style={styles.sectionRow}>
                    <Text style={styles.sectionRowText}>Moyenne / semaine</Text>
                  </View>
                  <CompareRow label="Activités" left={leftPerWeekActivities.toFixed(1)} right={showRight ? rightPerWeekActivities.toFixed(1) : undefined} leftColor={leftColor} rightColor={rightColor} />
                  <CompareRow label="Distance" left={formatKm(leftPerWeekDistance)} right={showRight ? formatKm(rightPerWeekDistance) : undefined} leftColor={leftColor} rightColor={rightColor} />
                  <CompareRow label="Dénivelé" left={`${leftPerWeekElevation.toFixed(0)} m`} right={showRight ? `${rightPerWeekElevation.toFixed(0)} m` : undefined} leftColor={leftColor} rightColor={rightColor} />
                  <CompareRow label="Durée" left={formatDuration(leftPerWeekDuration)} right={showRight ? formatDuration(rightPerWeekDuration) : undefined} leftColor={leftColor} rightColor={rightColor} />

                  <View style={styles.sectionRow}>
                    <Text style={styles.sectionRowText}>Moyennes</Text>
                  </View>
                  <CompareRow label="Distance / activité" left={formatKm(leftAvgDistancePerAct)} right={showRight ? formatKm(rightAvgDistancePerAct) : undefined} leftColor={leftColor} rightColor={rightColor} />
                  <CompareRow label="Durée / activité" left={formatDuration(leftAvgDurationPerAct)} right={showRight ? formatDuration(rightAvgDurationPerAct) : undefined} leftColor={leftColor} rightColor={rightColor} />
                  <CompareRow label="Vitesse moyenne" left={formatSpeed(leftStats.averageSpeedKmh)} right={showRight ? formatSpeed(right!.averageSpeedKmh) : undefined} leftColor={leftColor} rightColor={rightColor} />
                </View>
              </>
            );
          })()}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg.primary,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.bg.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: theme.colors.text.secondary,
    fontSize: 16,
    marginTop: 16,
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 12,
    gap: 10,
  },
  avatarsStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar1: {
    zIndex: 2,
  },
  avatar2: {
    marginLeft: -12,
    zIndex: 1,
  },
  subtitle: {
    color: theme.colors.text.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  refreshing: {
    color: theme.colors.text.tertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  refreshingSlot: {
    width: 92,
    alignItems: 'flex-end',
  },
  refreshingHidden: {
    opacity: 0,
  },
  periodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    marginBottom: 10,
  },
  periodPill: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodPillActive: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg.cardSecondary,
  },
  periodPillText: {
    color: theme.colors.text.tertiary,
    fontSize: 12,
    fontWeight: '800',
  },
  periodPillTextActive: {
    color: theme.colors.text.high,
  },
  typeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    marginBottom: 10,
  },
  typePill: {
    height: 32,
    minWidth: 32,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  typePillActive: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg.cardSecondary,
  },
  typePillText: {
    color: theme.colors.text.tertiary,
    fontSize: 12,
    fontWeight: '700',
  },
  typePillTextActive: {
    color: theme.colors.text.high,
  },
  table: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    marginTop: 10,
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  th: {
    flex: 1,
    color: theme.colors.text.tertiary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  rowLabel: {
    flex: 1,
    color: theme.colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  rowValue: {
    flex: 1,
    color: theme.colors.text.high,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  sectionRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bg.cardSecondary,
  },
  sectionRowText: {
    color: theme.colors.text.high,
    fontSize: 13,
    fontWeight: '800',
  },
  typeBlock: {
    marginBottom: 10,
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  typeTitle: {
    color: theme.colors.text.high,
    fontSize: 13,
    fontWeight: '800',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.bg.primary,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: theme.colors.text.high,
    letterSpacing: 0.2,
  },
  pickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    position: 'relative',
  },
  picker: {
    flex: 1,
    color: theme.colors.text.primary,
  },
  pickerChevronWrap: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  pickerItem: {
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.bg.card,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 0,
    paddingHorizontal: 20,
  },
  emptyText: {
    color: theme.colors.text.secondary,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 0,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtext: {
    color: theme.colors.text.tertiary,
    fontSize: 13,
    marginTop: 0,
  },
  statsGrid: {
    flexDirection: "column",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: '100%',
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  statCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.text.high,
  },
  statUnit: {
    fontSize: 14,
    color: theme.colors.text.high,
    letterSpacing: 0.2,
  },
  statLabel: {
    fontSize: 14,
    color: theme.colors.text.label,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  highlightCard: {
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  highlightHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  highlightTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text.high,
    marginLeft: 8,
    letterSpacing: 0.2,
  },
  highlightContent: {
    alignItems: "center",
  },
  highlightValue: {
    fontSize: 30,
    fontWeight: "800",
    color: theme.colors.text.high,
  },
  highlightLabel: {
    fontSize: 14,
    color: theme.colors.text.label,
    marginTop: 4,
  },
  chartContainer: {
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text.high,
    marginLeft: 8,
  },
  barWrapper: {
    marginBottom: 12,
  },
  barLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  barLabel: {
    fontSize: 14,
    color: theme.colors.text.label,
    marginLeft: 8,
  },
  barContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  barBackground: {
    flex: 1,
    height: 16,
    backgroundColor: theme.colors.bg.sunken,
    borderRadius: 8,
    marginRight: 12,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: theme.colors.users.primary,
    borderRadius: 8,
  },
  barValue: {
    minWidth: 70,
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text.high,
    textAlign: "right",
  },
});