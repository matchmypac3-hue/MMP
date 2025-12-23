// app/activities/[id].tsx

import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Alert } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useActivities } from "../../context/ActivityContext";
import { activityConfig } from "../../utils/activityConfig";
import { activityFormatters } from "../../utils/activityFormatters";
import { calculateSpeed } from "../../utils/speedCalculator";
import { theme } from "../../utils/theme";
import { useEffect, useState } from "react";
import { Activity } from "../../types/Activity";

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { activities, duoActivities, removeActivity } = useActivities();
  const [activity, setActivity] = useState<Activity | null>(null);

  const isMyActivity = (a: Activity | null) => {
    if (!a) return false;
    const uid = (typeof a.user === 'string')
      ? a.user
      : (a.user && typeof a.user === 'object' ? (a.user as any)?._id : undefined);
    return Boolean(uid && (activities || []).some((mine) => {
      const mineId = mine._id || mine.id;
      const aId = a._id || a.id;
      return mineId && aId && mineId === aId;
    }));
  };

  useEffect(() => {
    const needle = Array.isArray(id) ? id[0] : id;
    const foundActivity =
      activities.find(a => a._id === needle || a.id === needle) ||
      duoActivities.find(a => a._id === needle || a.id === needle) ||
      null;
    setActivity(foundActivity);
  }, [id, activities, duoActivities]);

  const handleDelete = () => {
    if (!isMyActivity(activity)) return;

    Alert.alert(
      'Supprimer l\'activité',
      'Êtes-vous sûr de vouloir supprimer cette activité ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            const activityId = activity?._id || activity?.id;
            if (activityId) {
              removeActivity(activityId);
              router.back();
            }
          }
        }
      ]
    );
  };

  if (!activity) {
    return (
      <View style={styles.container}>
        <Stack.Screen 
          options={{ 
            title: "Chargement...",
            headerStyle: { backgroundColor: theme.colors.bg.primary },
            headerTintColor: theme.colors.text.primary,
          }} 
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.users.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </View>
    );
  }

  const config = activityConfig[activity.type];
  const { date, time } = activityFormatters.formatDateTime(activity.date);
  const speedData = calculateSpeed(activity.distance, activity.duration, activity.type);
  
  const IconComponent = config.iconFamily === 'MaterialCommunityIcons' 
    ? MaterialCommunityIcons 
    : Ionicons;

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: "Détails",
          headerStyle: { backgroundColor: theme.colors.bg.primary },
          headerTintColor: theme.colors.text.primary,
          headerRight: () =>
            isMyActivity(activity) ? (
              <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                <Ionicons name="trash-outline" size={24} color={theme.colors.error} />
              </TouchableOpacity>
            ) : null,
        }} 
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Card avec icône et titre */}
        <LinearGradient
          colors={theme.gradients.card}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerCard}
        >
          <View style={styles.iconContainer}>
            <IconComponent 
              name={config.icon as any} 
              size={40}
              color={theme.colors.users.primary} 
            />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.typeLabel}>{config.label}</Text>
            <Text style={styles.activityTitle} numberOfLines={2}>
              {activity.title}
            </Text>
          </View>
        </LinearGradient>

        {/* Date et Heure */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>QUAND</Text>
          <View style={styles.dateTimeContainer}>
            <View style={styles.dateTimeItem}>
              <Ionicons name="calendar-outline" size={20} color={theme.colors.users.primary} />
              <Text style={styles.dateTimeText}>{date}</Text>
            </View>
            <View style={styles.dateTimeItem}>
              <Ionicons name="time-outline" size={20} color={theme.colors.users.primary} />
              <Text style={styles.dateTimeText}>{time}</Text>
            </View>
          </View>
        </View>

        {/* Stats en liste */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>STATISTIQUES</Text>
          
          <View style={styles.statsContainer}>
            {/* Durée */}
            <View style={styles.statRow}>
              <View style={styles.statLeft}>
                <Ionicons name="time-outline" size={22} color={theme.colors.users.primary} />
                <Text style={styles.statLabelText}>Durée</Text>
              </View>
              <Text style={styles.statValue}>
                {activityFormatters.formatDuration(activity.duration)}
              </Text>
            </View>

            {/* Distance */}
            {activity.distance && (
              <View style={styles.statRow}>
                <View style={styles.statLeft}>
                  <Ionicons name="navigate-outline" size={22} color={theme.colors.users.primary} />
                  <Text style={styles.statLabelText}>Distance</Text>
                </View>
                <Text style={styles.statValue}>
                  {activity.distance.toFixed(2)} km
                </Text>
              </View>
            )}

            {/* Vitesse/Allure */}
            {speedData && (
              <View style={styles.statRow}>
                <View style={styles.statLeft}>
                  <Ionicons name="speedometer-outline" size={22} color={theme.colors.users.primary} />
                  <Text style={styles.statLabelText}>{speedData.label}</Text>
                </View>
                <Text style={[styles.statValue, styles.speedHighlight]}>
                  {speedData.value}
                </Text>
              </View>
            )}

            {/* Dénivelé */}
            {activity.elevationGain && (
              <View style={styles.statRow}>
                <View style={styles.statLeft}>
                  <Ionicons name="trending-up-outline" size={22} color={theme.colors.users.primary} />
                  <Text style={styles.statLabelText}>Dénivelé</Text>
                </View>
                <Text style={styles.statValue}>
                  {activity.elevationGain} m
                </Text>
              </View>
            )}

            {/* Bassin */}
            {activity.poolLength && (
              <View style={styles.statRow}>
                <View style={styles.statLeft}>
                  <Ionicons name="resize-outline" size={22} color={theme.colors.users.primary} />
                  <Text style={styles.statLabelText}>Longueur bassin</Text>
                </View>
                <Text style={styles.statValue}>
                  {activity.poolLength} m
                </Text>
              </View>
            )}

            {/* Longueurs */}
            {activity.laps && (
              <View style={styles.statRow}>
                <View style={styles.statLeft}>
                  <Ionicons name="repeat-outline" size={22} color={theme.colors.users.primary} />
                  <Text style={styles.statLabelText}>Longueurs</Text>
                </View>
                <Text style={styles.statValue}>
                  {activity.laps}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Exercices de musculation */}
        {activity.exercises && activity.exercises.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>EXERCICES ({activity.exercises.length})</Text>
            {activity.exercises.map((exercise, index) => (
              <LinearGradient
                key={index}
                colors={[`${theme.colors.users.primary}10`, `${theme.colors.users.primary}05`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.exerciseCard}
              >
                <View style={styles.exerciseHeader}>
                  <Ionicons name="fitness-outline" size={20} color={theme.colors.users.primary} />
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                </View>
                <View style={styles.exerciseDetailsRow}>
                  {exercise.sets && (
                    <View style={styles.exerciseDetailItem}>
                      <Text style={styles.exerciseDetailValue}>{exercise.sets}</Text>
                      <Text style={styles.exerciseDetailLabel}>séries</Text>
                    </View>
                  )}
                  {exercise.reps && (
                    <View style={styles.exerciseDetailItem}>
                      <Text style={styles.exerciseDetailValue}>{exercise.reps}</Text>
                      <Text style={styles.exerciseDetailLabel}>rép.</Text>
                    </View>
                  )}
                  {exercise.weight && (
                    <View style={styles.exerciseDetailItem}>
                      <Text style={styles.exerciseDetailValue}>{exercise.weight}</Text>
                      <Text style={styles.exerciseDetailLabel}>kg</Text>
                    </View>
                  )}
                </View>
              </LinearGradient>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Ionicons 
            name={activity.source === 'manual' ? 'create-outline' : 'watch-outline'} 
            size={16} 
            color={theme.colors.text.tertiary} 
          />
          <Text style={styles.footerText}>
            {activity.source === 'manual' ? 'Ajoutée manuellement' : 'Suivie automatiquement'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: theme.colors.text.secondary,
    fontSize: 16,
    marginTop: 16,
  },
  headerButton: {
    marginRight: 8,
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginTop: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${theme.colors.users.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  activityTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    color: theme.colors.text.muted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  dateTimeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.bg.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  dateTimeText: {
    fontSize: 15,
    color: theme.colors.text.primary,
    fontWeight: '600',
  },
  statsContainer: {
    backgroundColor: theme.colors.bg.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    overflow: 'hidden',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  statLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statLabelText: {
    fontSize: 15,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  speedHighlight: {
    color: theme.colors.users.primary,
  },
  exerciseCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: `${theme.colors.users.primary}20`,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text.primary,
    flex: 1,
  },
  exerciseDetailsRow: {
    flexDirection: "row",
    gap: 16,
  },
  exerciseDetailItem: {
    alignItems: 'center',
  },
  exerciseDetailValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.users.primary,
  },
  exerciseDetailLabel: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 8,
  },
  footerText: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
    fontStyle: "italic",
  },
});