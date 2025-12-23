// components/WeeklyCard.tsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useWeekCountdown } from '../hooks/useWeekCountdown';
import { useChallenge } from '../context/ChallengeContext';
import { useAuth } from '../context/AuthContext';
import { usePartner } from '../context/PartnerContext';
import { theme } from '../utils/theme';
import { Diamond } from './Diamond';
import { GradientText } from './GradientText';
import { activityConfig } from '../utils/activityConfig';
import { confirmDestructive, showMessage } from '../utils/dialogs';

interface WeeklyCardProps {
  onChallengePress: () => void;
  onCreateChallenge: (mode?: 'solo' | 'duo') => void;
}

export function WeeklyCard({ onChallengePress, onCreateChallenge }: WeeklyCardProps) {
  const { days, hours, minutes, seconds } = useWeekCountdown();
  const { currentChallenge, deleteChallenge } = useChallenge();
  const { user, reloadUser } = useAuth();
  const { activeSlot, partnerLinks } = usePartner();

  const activeSlotLink = useMemo(() => {
    if (activeSlot === 'solo') return null;
    return (partnerLinks || []).find((l) => l.slot === activeSlot) || null;
  }, [activeSlot, partnerLinks]);

  const isPartnerSlotPending =
    activeSlot !== 'solo' && Boolean(activeSlotLink?.partnerId) && activeSlotLink?.status === 'pending';

  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);

   // ✅ AJOUTEZ CE LOG DE DEBUG
  useEffect(() => {
    console.log('🔍 [WeeklyCard] currentChallenge:', currentChallenge ? {
      id: currentChallenge._id,
      mode: currentChallenge.mode,
      status: currentChallenge.status,
      creator: currentChallenge.creator
    } : 'null');
  }, [currentChallenge]);


  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: expanded ? 1 : 0,
      duration: 380,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: false,
    }).start();
  }, [expanded, expandAnim]);

  const animatedHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(contentHeight, 1)],
  });
  const animatedOpacity = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const translateY = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 0],
  });

  const onMeasureContent = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h && Math.abs(h - contentHeight) > 1) {
      setContentHeight(h);
    }
  };

  const DIAMOND_SIZE = 75;
  const MAX_DIAMONDS_PER_PLAYER = 4;

  const myPlayer = useMemo(() => {
    if (!currentChallenge) return null;
    const players = Array.isArray(currentChallenge.players) ? currentChallenge.players : [];
    return players.find(p => {
      const userId = typeof p.user === 'string' ? p.user : p.user._id;
      return userId === user?._id;
    });
  }, [currentChallenge, user]);

  const partnerPlayer = useMemo(() => {
    if (!currentChallenge || currentChallenge.mode !== 'duo') return null;
    const players = Array.isArray(currentChallenge.players) ? currentChallenge.players : [];
    return players.find(p => {
      const userId = typeof p.user === 'string' ? p.user : p.user._id;
      return userId !== user?._id;
    });
  }, [currentChallenge, user]);

  const myProgress = myPlayer?.progress ?? 0;
  const myGoal = currentChallenge?.goal?.value ?? 1;
  const myCompleted = myPlayer?.completed ?? false;

  const partnerProgress = partnerPlayer?.progress ?? 0;
  const partnerCompleted = partnerPlayer?.completed ?? false;

  const getDiamondsFromProgress = (progress: number) => {
    const goal = Math.max(myGoal, 1);
    const percent = Math.min((Math.max(progress, 0) / goal) * 100, 100);
    return Math.min(Math.max(Math.floor(percent / 25), 0), MAX_DIAMONDS_PER_PLAYER);
  };

  const myDiamondsCount = currentChallenge?.mode === 'duo'
    ? getDiamondsFromProgress(myProgress)
    : 0;
  const partnerDiamondsCount = currentChallenge?.mode === 'duo'
    ? getDiamondsFromProgress(partnerProgress)
    : 0;

  const duoTotalPercent = (() => {
    if (currentChallenge?.mode !== 'duo') return 0;
    const goal = Math.max(myGoal, 1);
    const combined = Math.max(myProgress, 0) + Math.max(partnerProgress, 0);
    const denom = goal * 2;
    return Math.round(Math.min((combined / denom) * 100, 100));
  })();

  const progressPercent = Math.min((myProgress / myGoal) * 100, 100);
  const myDiamondCountSolo = Math.floor(progressPercent / 12.5);
  const totalPercent = Math.round(progressPercent);
  const isComplete = myCompleted;

  // ✅ Bonus si LES 2 ont terminé
  const bonusUnlocked = currentChallenge?.mode === 'duo' && myCompleted && partnerCompleted;
  
  const challengeFinished = (() => {
    if (!currentChallenge) return false;
    const terminalStatuses = ['completed', 'failed', 'cancelled'];
    const isTerminalStatus = terminalStatuses.includes(currentChallenge.status);
    const isTimeOver = currentChallenge.endDate && new Date(currentChallenge.endDate) < new Date();
    const anyPlayerCompleted = myCompleted || partnerCompleted;
    const soloProgressDone = currentChallenge.progress?.isCompleted || totalPercent >= 100;
    return isTerminalStatus || isTimeOver || anyPlayerCompleted || soloProgressDone;
  })();

  // Teinte d'urgence pour le compte à rebours si challenge actif avec < 24h restantes
  const challengeEndsInMs = currentChallenge?.endDate
    ? new Date(currentChallenge.endDate).getTime() - Date.now()
    : null;
  const isUrgentCountdown = Boolean(
    currentChallenge?.status === 'active' &&
    typeof challengeEndsInMs === 'number' &&
    challengeEndsInMs > 0 &&
    challengeEndsInMs <= 24 * 60 * 60 * 1000
  );
  const countdownColors = isUrgentCountdown
    ? ([theme.colors.error, theme.colors.users.secondary] as const)
    : theme.gradients.neutral;

  const duoIsComplete = duoTotalPercent >= 100;

  const getDiamondPositions = (count: number) => {
    const positions: { top: number; left: number }[] = [];
    const containerSize = 300;
    const centerX = containerSize / 2;
    const centerY = containerSize / 2;
    const radius = 110;
    const offset = DIAMOND_SIZE / 2;
    const angleStep = (2 * Math.PI) / count;
    const startAngle = -Math.PI / 2;

    for (let i = 0; i < count; i++) {
      const angle = startAngle + i * angleStep;
      const x = centerX + radius * Math.cos(angle) - offset;
      const y = centerY + radius * Math.sin(angle) - offset;
      positions.push({ top: y, left: x });
    }
    return positions;
  };

  const diamondPositions = useMemo(() => getDiamondPositions(8), []);

  const formatGoalValue = (value: number, type: string) => {
    switch (type) {
      case 'distance':
        return `${value} km`;
      case 'duration': {
        const h = Math.floor(value / 60);
        const m = value % 60;
        return h > 0 ? `${h}h${m > 0 ? m.toString().padStart(2, '0') : ''}` : `${m}min`;
      }
      case 'count':
        return `${value} activité${value > 1 ? 's' : ''}`;
      default:
        return String(value);
    }
  };

  const getPartnerName = () => {
    if (!partnerPlayer) return 'Partenaire';
    const partnerUser = typeof partnerPlayer.user === 'string' 
      ? { email: 'Partenaire' } 
      : partnerPlayer.user;
    const u: any = partnerUser;
    return u.username || u.email?.split('@')[0] || 'Partenaire';
  };


  const getMyName = () => {
    return (user as any)?.username || user?.email?.split('@')[0] || 'Vous';
  };

  const getChallengeTitle = () => {
    return `Challenge ${currentChallenge?.mode === 'duo' ? 'Duo' : 'Solo'}`;
  };

  const getActivityVerb = () => {
    const types = currentChallenge?.activityTypes || [];
    if (types.length === 0) return 'bouger';
    if (types.length > 1) return 'faire en activités multiples';

    const primary = types[0];
    const verbMap: Record<string, string> = {
      running: 'courir',
      cycling: 'pédaler',
      walking: 'marcher',
      swimming: 'nager',
      workout: "t'entraîner",
      yoga: 'pratiquer',
    };
    return verbMap[primary] || 'bouger';
  };

  const handleQuitChallenge = async () => {
    const confirmed = await confirmDestructive({
      title: 'Quitter le challenge',
      message: 'Les diamants seront ajoutés à votre compteur.',
      confirmText: 'Quitter',
    });

    if (!confirmed) return;

    try {
      await deleteChallenge();
      await reloadUser();
      showMessage({ title: '✅', message: 'Challenge quitté, diamants ajoutés !' });
    } catch (error: any) {
      showMessage({ title: 'Erreur', message: error.message });
    }
  };

  const handleNewChallenge = async () => {
    try {
      await deleteChallenge();
      await reloadUser();  // ✅ Recharger les diamants
      onCreateChallenge('duo');
    } catch (error: any) {
      showMessage({ title: 'Erreur', message: error.message });
    }
  };

  const ACTIVITY_COLOR = theme.colors.users.primary;

  const ChallengeInner = () => (
    <View style={styles.challengeContentInner}>
      {currentChallenge?.status === 'pending' && currentChallenge?.mode === 'duo' && (
        <View style={styles.pendingBanner}>
          <Ionicons name="time-outline" size={18} color={theme.colors.warning} />
          <Text style={styles.pendingText}>En attente d’acceptation de {getPartnerName()}</Text>
        </View>
      )}

      <Text style={styles.objectiveText}>
        <Text style={styles.objectiveValue}>
          {currentChallenge?.goal ? formatGoalValue(currentChallenge.goal.value, currentChallenge.goal.type) : ''}
        </Text>
        {' '}à {getActivityVerb()} avant lundi !
      </Text>

      {currentChallenge?.mode === 'duo' && partnerPlayer && (
        <View style={styles.duoProgressContainer}>
          <View style={styles.playerProgress}>
            <View style={styles.playerHeader}>
              <Text style={styles.playerName}>Vous</Text>
              <Text style={styles.playerDiamonds}>💎 {myDiamondsCount}</Text>
            </View>
            <View style={styles.progressBarSmall}>
              <LinearGradient
                colors={myCompleted ? [theme.colors.success, theme.colors.success] : [theme.colors.users.primary, theme.colors.users.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressFillSmall,
                  { width: `${Math.min((myProgress / myGoal) * 100, 100)}%` }
                ]}
              />
            </View>
            <Text style={styles.playerProgressText}>
              {formatGoalValue(myProgress, currentChallenge.goal.type)} / {formatGoalValue(myGoal, currentChallenge.goal.type)}
            </Text>
          </View>

          <View style={styles.playerProgress}>
            <View style={styles.playerHeader}>
              <Text style={styles.playerName}>{getPartnerName()}</Text>
              <Text style={styles.playerDiamonds}>💎 {partnerDiamondsCount}</Text>
            </View>
            <View style={styles.progressBarSmall}>
              <LinearGradient
                colors={partnerCompleted ? [theme.colors.success, theme.colors.success] : [theme.colors.users.secondary, theme.colors.users.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressFillSmall,
                  { width: `${Math.min((partnerProgress / myGoal) * 100, 100)}%` }
                ]}
              />
            </View>
            <Text style={styles.playerProgressText}>
              {formatGoalValue(partnerProgress, currentChallenge.goal.type)} / {formatGoalValue(myGoal, currentChallenge.goal.type)}
            </Text>
          </View>

          {bonusUnlocked && !challengeFinished ? (
            <View style={styles.bonusBanner}>
              <Ionicons name="gift" size={18} color={theme.colors.users.victory} />
              <Text style={styles.bonusText}>🎉 Bonus débloqué ! Diamants doublés</Text>
            </View>
          ) : myCompleted && !partnerCompleted ? (
            <View style={styles.bonusWarning}>
              <Ionicons name="hourglass-outline" size={16} color={theme.colors.warning} />
              <Text style={styles.bonusWarningText}>Bonus en attente de {getPartnerName()}</Text>
            </View>
          ) : !myCompleted && partnerCompleted ? (
            <View style={styles.bonusEncourage}>
              <Ionicons name="rocket-outline" size={16} color={theme.colors.users.secondary} />
              <Text style={styles.bonusEncourageText}>{getPartnerName()} a terminé ! À vous de jouer 💪</Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.activityChipsContainer}>
        {Array.isArray(currentChallenge?.activityTypes) && currentChallenge.activityTypes.map((type, index) => {
          const config = (activityConfig as any)[type];
          const IconComponent = config?.iconFamily === 'MaterialCommunityIcons' 
            ? MaterialCommunityIcons 
            : Ionicons;
          
          return (
            <View key={index} style={styles.activityChip}>
              <LinearGradient
                colors={[`${ACTIVITY_COLOR}25`, `${ACTIVITY_COLOR}10`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.activityChipGradient}
              >
                <View style={[styles.activityChipIconContainer, { backgroundColor: `${ACTIVITY_COLOR}20` }]}>
                  <IconComponent
                    name={config?.icon as any}
                    size={14}
                    color={ACTIVITY_COLOR}
                  />
                </View>
                <Text style={[styles.activityChipText, { color: ACTIVITY_COLOR }]}>
                  {config?.label}
                </Text>
              </LinearGradient>
            </View>
          );
        })}
      </View>
    </View>
  );

  return (
    <LinearGradient
      colors={theme.gradients.card}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.countdownSection}>
        <Text style={styles.countdownLabel}>PROCHAINE SEMAINE DANS</Text>
        <View style={styles.countdownRow}>
          <View style={styles.timeUnit}>
            <GradientText colors={countdownColors} style={styles.timeValue}>
              {days.toString().padStart(2, '0')}
            </GradientText>
            <Text style={styles.timeLabel}>JOURS</Text>
          </View>
          <View style={styles.timeUnit}>
            <GradientText colors={countdownColors} style={styles.timeValue}>
              {hours.toString().padStart(2, '0')}
            </GradientText>
            <Text style={styles.timeLabel}>HEURES</Text>
          </View>
          <View style={styles.timeUnit}>
            <GradientText colors={countdownColors} style={styles.timeValue}>
              {minutes.toString().padStart(2, '0')}
            </GradientText>
            <Text style={styles.timeLabel}>MINUTES</Text>
          </View>
          <View style={styles.timeUnit}>
            <GradientText colors={countdownColors} style={styles.timeValue}>
              {seconds.toString().padStart(2, '0')}
            </GradientText>
            <Text style={styles.timeLabel}>SECONDES</Text>
          </View>
        </View>
      </View>

      <View style={styles.separator} />

      {currentChallenge ? (
        <View style={styles.challengeSection}>
          <View style={styles.challengeCard}>
            <TouchableOpacity
              style={styles.challengeCardHeader}
              onPress={() => setExpanded(v => !v)}
              activeOpacity={0.85}
            >
              <View style={styles.headerTitleContainer}>
                <Text style={styles.challengeTitle}>
                  {getChallengeTitle()}
                </Text>
                {currentChallenge?.goal && (
                  <Text style={styles.headerGoalText}>
                    {formatGoalValue(currentChallenge.goal.value, currentChallenge.goal.type)}
                  </Text>
                )}
                <View style={styles.headerChipsContainer}>
                  {Array.isArray(currentChallenge?.activityTypes) && currentChallenge.activityTypes.map((type, index) => {
                    const config = (activityConfig as any)[type];
                    const IconComponent = config?.iconFamily === 'MaterialCommunityIcons' 
                      ? MaterialCommunityIcons 
                      : Ionicons;
                    return (
                      <View key={index} style={styles.headerChip}>
                        <IconComponent
                          name={config?.icon as any}
                          size={11}
                          color={theme.colors.text.label}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            </TouchableOpacity>

            <View style={styles.measure} onLayout={onMeasureContent}>
              <ChallengeInner />
            </View>

            <Animated.View
              style={[
                styles.challengeContentAnimated,
                { height: animatedHeight, opacity: animatedOpacity },
              ]}
            >
              <Animated.View style={{ flex: 1, transform: [{ translateY }] }}>
                <ChallengeInner />
              </Animated.View>
            </Animated.View>

            {/* ✅ BOUTONS FIN DE CHALLENGE (toujours visibles) */}
            {challengeFinished && (
              <View style={[styles.finishedActions, styles.finishedActionsStatic]}>
                <TouchableOpacity 
                  style={styles.newChallengeButton}
                  onPress={handleNewChallenge}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={theme.gradients.countdown as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.newChallengeGradient}
                  >
                    <Ionicons name="refresh-circle-outline" size={18} color="#000" />
                    <Text style={styles.newChallengeButtonText}>Relancer</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.quitButton}
                  onPress={handleQuitChallenge}
                  activeOpacity={0.85}
                >
                  <Ionicons name="close" size={18} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* DIAMANTS */}
          <View style={styles.diamondsContainer}>
            {currentChallenge?.mode === 'duo' ? (
              <>
                {/* ✅ Diamants VIOLET si les 2 ont terminé, sinon CYAN */}
                {[0, 1, 2, 3].map((index) => {
                  const positions = [
                    { top: 10, left: 82.5 },
                    { top: 10, left: 142.5 },
                    { top: 52.5, left: 20 },
                    { top: 52.5, left: 205 },
                  ];
                  const isActive = index < myDiamondsCount;
                  const color = bonusUnlocked ? theme.colors.users.victory : theme.colors.rewards.diamond;
                  return (
                    <View key={`my-${index}`} style={[styles.diamondSlot, positions[index]]}>
                      <Diamond 
                        color={color} 
                        size={DIAMOND_SIZE} 
                        active={isActive} 
                      />
                    </View>
                  );
                })}

                {/* ✅ Diamants VIOLET si les 2 ont terminé, sinon CORAIL */}
                {[0, 1, 2, 3].map((index) => {
                  const positions = [
                    { top: 167.5, left: 20 },
                    { top: 167.5, left: 205 },
                    { top: 210, left: 82.5 },
                    { top: 210, left: 142.5 },
                  ];
                  const isActive = index < partnerDiamondsCount;
                  const color = bonusUnlocked ? theme.colors.users.victory : theme.colors.users.secondary;
                  return (
                    <View key={`partner-${index}`} style={[styles.diamondSlot, positions[index]]}>
                      <Diamond 
                        color={color} 
                        size={DIAMOND_SIZE} 
                        active={isActive} 
                      />
                    </View>
                  );
                })}

                {/* ✅ Centre : % toujours (pas de violet) */}
                <TouchableOpacity 
                  style={[styles.centerCircle, (duoIsComplete || bonusUnlocked) && styles.centerCircleComplete]}
                  onPress={onChallengePress}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[theme.colors.bg.cardSecondary, theme.colors.bg.elevated] as const}
                    style={styles.centerBackground}
                  >
                    <View style={styles.centerContent}>
                      <GradientText
                        colors={(duoIsComplete || bonusUnlocked) ? theme.gradients.exception : theme.gradients.progress}
                        style={styles.centerPercentage}
                      >
                        {String(duoTotalPercent) + '%'}
                      </GradientText>
                      <Text style={styles.centerLabel}>DÉTAILS</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              // MODE SOLO
              <>
                {diamondPositions.map((pos, index) => {
                  const isActive = index < myDiamondCountSolo;
                  const color = isComplete ? theme.colors.users.victory : theme.colors.rewards.diamond;
                  return (
                    <View key={index} style={[styles.diamondSlot, pos]}>
                      <Diamond color={color} size={DIAMOND_SIZE} active={isActive} />
                    </View>
                  );
                })}

                <TouchableOpacity 
                  style={[styles.centerCircle, isComplete && styles.centerCircleComplete]}
                  onPress={onChallengePress}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={isComplete 
                      ? ([theme.colors.bg.elevated, theme.colors.bg.cardSecondary] as const)
                      : ([theme.colors.bg.cardSecondary, theme.colors.bg.elevated] as const)}
                    style={styles.centerBackground}
                  >
                    {isComplete ? (
                      <View style={styles.centerContent}>
                        <Text style={styles.centerIcon}>💎</Text>
                        <Text style={styles.centerLabelComplete}>COMPLET</Text>
                      </View>
                    ) : (
                      <View style={styles.centerContent}>
                        <GradientText colors={theme.gradients.progress} style={styles.centerPercentage}>
                          {String(totalPercent) + '%'}
                        </GradientText>
                        <Text style={styles.centerLabel}>DÉTAILS</Text>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ✅ LÉGENDE (sauf si bonus débloqué) */}
          {currentChallenge?.mode === 'duo' && partnerPlayer && !bonusUnlocked && (
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.users.primary }]} />
                <Text style={styles.legendText}>{getMyName()}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.users.secondary }]} />
                <Text style={styles.legendText}>{getPartnerName()}</Text>
              </View>
            </View>
          )}

        </View>
      ) : (
        <View>
          <TouchableOpacity
            style={[styles.createChallengeButton, isPartnerSlotPending && styles.createChallengeButtonDisabled]}
            onPress={() => onCreateChallenge(activeSlot === 'solo' ? 'solo' : 'duo')}
            activeOpacity={0.7}
            disabled={isPartnerSlotPending}
          >
            <View style={styles.createChallengeGradient}>
              <Ionicons name="add-circle" size={24} color={theme.colors.users.primary} />
              <Text style={styles.createChallengeButtonText}>Créer un pacte</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  countdownSection: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  countdownLabel: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: 1,
  },
  countdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    gap: 8,
  },
  timeUnit: {
    alignItems: 'center',
    flex: 1,
  },
  timeValue: {
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
  },
  timeLabel: {
    fontSize: 10,
    color: theme.colors.text.tertiary,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginVertical: 20,
  },
  challengeSection: {
    paddingTop: 0,
  },
  challengeCard: {
    backgroundColor: theme.colors.bg.elevated,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderRadius: 18,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  challengeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  challengeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text.high,
    letterSpacing: 0.2,
  },
  headerGoalText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text.label,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bg.sunken,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 1,
    gap: 12,
    flexWrap: 'wrap',
  },
  headerChipsContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 2,
    marginLeft: 'auto',
    marginRight: 0,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    maxWidth: '55%',
  },
  headerChip: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: theme.colors.bg.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  challengeContentAnimated: {
    overflow: 'hidden',
  },
  challengeContentInner: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'flex-start',
  },
  measure: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
    pointerEvents: 'none',
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    alignSelf: 'stretch',
  },
  pendingText: {
    fontSize: 13,
    color: '#ffd700',
    fontWeight: '700',
    letterSpacing: 0.2,
    flex: 1,
  },
  pendingSentWrap: {
    marginTop: 10,
  },
  pendingCancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.35)',
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
  },
  pendingCancelText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffd700',
    letterSpacing: 0.2,
  },
  objectiveText: {
    fontSize: 16,
    color: theme.colors.text.high,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 22,
  },
  objectiveValue: {
    fontSize: 16,
    color: theme.colors.users.primary,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  duoProgressContainer: {
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 4,
  },
  playerProgress: {
    gap: 6,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  playerDiamonds: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  progressBarSmall: {
    height: 6,
    backgroundColor: theme.colors.bg.primary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFillSmall: {
    height: '100%',
    borderRadius: 3,
  },
  playerProgressText: {
    fontSize: 11,
    color: theme.colors.text.tertiary,
    fontWeight: '500',
  },
  bonusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${theme.colors.users.victory}20`,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.users.victory,
    alignSelf: 'stretch',
  },
  bonusText: {
    fontSize: 13,
    color: theme.colors.users.victory,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 18,
    flex: 1,
  },
  bonusWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'stretch',
  },
  bonusWarningText: {
    fontSize: 11,
    color: '#ffd700',
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  bonusEncourage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${theme.colors.users.secondary}20`,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${theme.colors.users.secondary}40`,
    alignSelf: 'stretch',
  },
  bonusEncourageText: {
    fontSize: 13,
    color: theme.colors.users.secondary,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 18,
    flex: 1,
  },
  activityChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityChip: {
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  activityChipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
  },
  activityChipIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  diamondsContainer: {
    width: 300,
    height: 300,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 12,
    position: 'relative',
  },
  diamondSlot: {
    position: 'absolute',
    width: 75,
    height: 75,
  },
  centerCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 85,
    height: 85,
    marginLeft: -42.5,
    marginTop: -42.5,
    borderRadius: 42.5,
    overflow: 'hidden',
    borderWidth: 3,
    // Progress (no glow)
    borderColor: `${theme.colors.accent.progress}80`,
    shadowOpacity: 0,
    elevation: 0,
  },
  centerCircleComplete: {
    // Exception: only at 100% / bonus moments
    borderColor: `${theme.colors.accent.exception}B0`,
    shadowColor: theme.colors.accent.exception,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  centerBackground: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    alignItems: 'center',
    gap: 2,
  },
  centerPercentage: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  centerLabel: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  centerIcon: {
    fontSize: 30,
    lineHeight: 34,
  },
  centerLabelComplete: {
    fontSize: 8,
    color: '#fff',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  legendText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  finishedActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  finishedActionsStatic: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 4,
  },
  quitButton: {
    width: 52,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg.sunken,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  newChallengeButton: {
    flex: 4,
    borderRadius: 14,
    overflow: 'hidden',
  },
  newChallengeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingVertical: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  newChallengeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  createChallengeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  createChallengeText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  createChallengeButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.users.primary,
    backgroundColor: theme.colors.bg.elevated,
  },
  createChallengeButtonDisabled: {
    opacity: 0.6,
  },
  createChallengeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.bg.elevated,
  },
  createChallengeButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text.high,
  },
});