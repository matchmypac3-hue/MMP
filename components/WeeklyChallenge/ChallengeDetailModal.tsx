// components/WeeklyChallenge/ChallengeDetailModal.tsx

import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect, useMemo } from 'react';
import { useChallenge } from '../../context/ChallengeContext';
import { useActivities } from '../../context/ActivityContext';
import { useAuth } from '../../context/AuthContext';
import { activityConfig } from '../../utils/activityConfig';
import { activityFormatters } from '../../utils/activityFormatters';
import { ChallengeForm } from './ChallengeForm';
import { theme } from '../../utils/theme';
import { GradientText } from '../GradientText';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';  // ✅ Doit avoir les deux
import { confirmDestructive, showMessage } from '../../utils/dialogs';
import { activityService } from '../../services/activityService';
import { ActivityItem } from '../ActivityItem';

interface ChallengeDetailModalProps {
  visible: boolean;
  onClose: () => void;
}

const RADIUS = 16;

export function ChallengeDetailModal({ visible, onClose }: ChallengeDetailModalProps) {
  const { currentChallenge, deleteChallenge } = useChallenge();
  const { activities, removeActivity } = useActivities();
  const { token } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [challengeActivities, setChallengeActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // ⭐ Historique du challenge
  // - DUO: utiliser l'endpoint dédié /activities/duo/current (retourne les activités des 2 joueurs)
  // - SOLO: filtrer localement (sur mes activités) sur la période + types + createdAt >= max(startDate, challenge.createdAt)
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!visible || !currentChallenge) {
        setChallengeActivities([]);
        return;
      }

      if (currentChallenge.mode === 'duo') {
        if (!token) {
          setChallengeActivities([]);
          return;
        }

        try {
          setLoadingActivities(true);
          const data = await activityService.getCurrentDuoChallengeActivities(token);
          if (!cancelled) {
            setChallengeActivities(Array.isArray(data) ? data : []);
          }
        } catch {
          if (!cancelled) setChallengeActivities([]);
        } finally {
          if (!cancelled) setLoadingActivities(false);
        }
        return;
      }

      // SOLO
      const weekStart = new Date(currentChallenge.startDate);
      const weekEnd = new Date(currentChallenge.endDate);
      const createdAtCutoff = currentChallenge.createdAt
        ? new Date(currentChallenge.createdAt)
        : null;
      const cutoff = createdAtCutoff && createdAtCutoff > weekStart ? createdAtCutoff : weekStart;

      const filtered = (activities || []).filter((activity: any) => {
        const activityDate = new Date(activity.date);
        const activityCreatedAt = activity.createdAt ? new Date(activity.createdAt) : activityDate;
        return (
          activityDate >= weekStart &&
          activityDate < weekEnd &&
          activityCreatedAt >= cutoff &&
          currentChallenge.activityTypes.includes(activity.type)
        );
      });

      setChallengeActivities(filtered);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [visible, currentChallenge, activities, token]);

  const challengeStats = useMemo(() => {
    return {
      count: challengeActivities.length,
      totalDistance: challengeActivities.reduce((sum, a) => sum + (a.distance || 0), 0),
      totalDuration: challengeActivities.reduce((sum, a) => sum + (a.duration || 0), 0),
      totalElevation: challengeActivities.reduce((sum, a) => sum + (a.elevationGain || 0), 0),
    };
  }, [challengeActivities]);

  if (!currentChallenge) return null;

  const { title, icon, activityTypes, goal, progress } = currentChallenge;
  const safeActivityTypes: string[] = Array.isArray(activityTypes) ? activityTypes : [];

  const formatGoalValue = (value: number, type: string) => {
    switch (type) {
      case 'distance':
        return `${value} km`;
      case 'duration':
        return activityFormatters.formatDuration(value);
      case 'count':
        return `${value} activité${value > 1 ? 's' : ''}`;
      default:
        return value.toString();
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmDestructive({
      title: 'Supprimer le pacte',
      message: 'Êtes-vous sûr ?',
      confirmText: 'Supprimer',
    });

    if (!confirmed) return;

    try {
      await deleteChallenge();
      onClose();
    } catch (error: any) {
      showMessage({ title: 'Erreur', message: error.message });
    }
  };

  const handleEditSuccess = () => {
    setIsEditing(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.container}>
          {/* En-tête */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {isEditing ? 'Modifier le pacte' : 'Détails du pacte'}
            </Text>
          </View>

          <ScrollView 
            style={styles.content} 
            contentContainerStyle={{ paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
          >
            {isEditing ? (
              <ChallengeForm
                mode="edit"
                onSuccess={handleEditSuccess}
                onCancel={() => setIsEditing(false)}
              />
            ) : (
              <>
                {/* Titre + Icône */}
                <View style={styles.titleSection}>
                  <View style={styles.titleIconWrap}>
                    <Ionicons name={icon as any} size={30} color={theme.colors.users.primary} />
                  </View>
                  <Text style={styles.title}>{title}</Text>
                </View>

                {/* Types d'activités */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>ACTIVITÉS CONCERNÉES</Text>
                  <View style={styles.card}>
                    <View style={styles.typesRow}>
                      {safeActivityTypes.map((type: string) => {
                        const config = activityConfig[type as keyof typeof activityConfig];
                        if (!config) return null;
                        const IconComponent = config.iconFamily === 'MaterialCommunityIcons' 
                          ? MaterialCommunityIcons 
                          : Ionicons;
                        
                        return (
                          <View key={type} style={styles.typeChip}>
                            <IconComponent
                              name={config.icon as any}
                              size={16}
                              color={theme.colors.text.label}
                            />
                            <Text style={styles.typeText}>{config.label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Objectif */}
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>OBJECTIF</Text>
                  <View style={styles.card}>
                    <Text style={styles.objectiveValue}>
                      {goal ? formatGoalValue(goal.value, goal.type) : ''}
                    </Text>
                    <Text style={styles.objectiveHint}>Avant lundi</Text>
                  </View>
                </View>

                {/* Progression */}
                {progress && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>PROGRESSION</Text>

                    <View style={styles.card}>
                      {/* Barre */}
                      <View style={styles.progressBar}>
                        <LinearGradient
                          colors={
                            progress.isCompleted
                              ? theme.gradients.exception
                              : theme.gradients.progress
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(progress.percentage, 100)}%`,
                            },
                          ]}
                        />
                      </View>

                      {/* Stats */}
                      <View style={styles.progressRow}>
                        <Text style={styles.progressText}>
                          {formatGoalValue(progress.current, goal.type)}
                        </Text>
                        <GradientText
                          colors={
                            progress.isCompleted
                              ? theme.gradients.exception
                              : theme.gradients.progress
                          }
                          style={styles.progressPercent}
                        >
                          {`${progress.percentage.toFixed(0)}%`}
                        </GradientText>
                      </View>

                      {progress.isCompleted && (
                        <LinearGradient
                          colors={[
                            `${theme.colors.users.victory}20`,
                            `${theme.colors.users.victory}10`,
                          ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.completedBanner}
                        >
                          <Ionicons
                            name="trophy"
                            size={20}
                            color={theme.colors.users.victory}
                          />
                          <Text style={styles.completedText}>Pacte réussi</Text>
                        </LinearGradient>
                      )}
                    </View>
                  </View>
                )}

                {/* ⭐ Stats des activités du challenge */}
                {(loadingActivities || challengeActivities.length > 0) && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>STATISTIQUES DE LA SEMAINE</Text>

                    <View style={styles.statsContainer}>
                      <View style={styles.statRow}>
                        <View style={styles.statLeft}>
                          <Ionicons name="list-outline" size={20} color={theme.colors.text.label} />
                          <Text style={styles.statLabelText}>Activités</Text>
                        </View>
                        <Text style={styles.statValue}>{challengeStats.count}</Text>
                      </View>

                      {challengeStats.totalDistance > 0 && (
                        <View style={styles.statRow}>
                          <View style={styles.statLeft}>
                            <Ionicons name="navigate-outline" size={20} color={theme.colors.text.label} />
                            <Text style={styles.statLabelText}>Distance totale</Text>
                          </View>
                          <Text style={styles.statValue}>{challengeStats.totalDistance.toFixed(1)} km</Text>
                        </View>
                      )}

                      {challengeStats.totalDuration > 0 && (
                        <View style={styles.statRow}>
                          <View style={styles.statLeft}>
                            <Ionicons name="time-outline" size={20} color={theme.colors.text.label} />
                            <Text style={styles.statLabelText}>Temps total</Text>
                          </View>
                          <Text style={styles.statValue}>
                            {Math.floor(challengeStats.totalDuration / 60)}h{' '}
                            {Math.round(challengeStats.totalDuration % 60)}min
                          </Text>
                        </View>
                      )}

                      {challengeStats.totalElevation > 0 && (
                        <View style={styles.statRow}>
                          <View style={styles.statLeft}>
                            <Ionicons name="trending-up-outline" size={20} color={theme.colors.text.label} />
                            <Text style={styles.statLabelText}>Dénivelé cumulé</Text>
                          </View>
                          <Text style={styles.statValue}>{Math.floor(challengeStats.totalElevation)} m</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Historique des activités */}
                {(loadingActivities || challengeActivities.length > 0) && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>HISTORIQUE</Text>
                    <View style={styles.card}>
                      {loadingActivities ? (
                        <Text style={styles.emptyHint}>Chargement des activités…</Text>
                      ) : (
                        <View style={{ gap: 10 }}>
                          {challengeActivities
                            .slice()
                            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map((activity: any) => (
                              <ActivityItem
                                key={activity._id || activity.id}
                                activity={activity}
                                onDelete={removeActivity}
                                highlight
                              />
                            ))}
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* ✅ BOUTONS STATIQUES À LA FIN */}
                <View style={styles.actionsSection}>
                  <TouchableOpacity style={styles.actionButton} onPress={onClose}>
                    <Ionicons name="arrow-back" size={22} color={theme.colors.text.primary} />
                    <Text style={styles.actionButtonText}>Retour</Text>
                  </TouchableOpacity>

                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => setIsEditing(true)}>
                      <Ionicons name="pencil-outline" size={22} color={theme.colors.text.secondary} />
                      <Text style={styles.actionButtonText}>Modifier</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={handleDelete}>
                      <Ionicons name="trash-outline" size={22} color="#FF6B6B" />
                      <Text style={[styles.actionButtonText, { color: '#FF6B6B' }]}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg.primary,
  },
  container: {
    flex: 1,
  },

  header: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },

  content: {
    flex: 1,
    padding: 20,
    paddingBottom: 40,
  },

  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  titleIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: theme.colors.bg.card,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text.primary,
    flex: 1,
    letterSpacing: 0.2,
  },

  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    color: theme.colors.text.muted,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },

  card: {
    backgroundColor: theme.colors.bg.card,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    padding: 16,
  },

  typesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: theme.colors.bg.primary,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  typeText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    fontWeight: '600',
  },

  objectiveValue: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text.primary,
    marginBottom: 6,
  },
  objectiveHint: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },

  progressBar: {
    height: 10,
    backgroundColor: theme.colors.bg.primary,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  progressText: {
    fontSize: 15,
    color: theme.colors.text.secondary,
    fontWeight: '700',
  },
  progressPercent: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'right',
  },

  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.users.victory,
  },
  completedText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.users.victory,
  },

  statsContainer: {
    backgroundColor: theme.colors.bg.card,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    overflow: 'hidden',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  statLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statLabelText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text.primary,
  },

  emptyHint: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ✅ BOUTONS STATIQUES (plus de position absolute)
  actionsSection: {
    marginTop: 32,
    gap: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.bg.card,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 12,
    flex: 1,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
});