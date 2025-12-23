// components/ActivityItem.tsx

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Activity } from '../types/Activity';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';  // ✅ AJOUTÉ MaterialCommunityIcons
import { activityConfig } from '../utils/activityConfig';
import { activityFormatters } from '../utils/activityFormatters';
import { Link } from 'expo-router';
import { theme } from '../utils/theme';
import { useAuth } from '../context/AuthContext';

interface ActivityItemProps {
  activity: Activity;
  onDelete: (id: string) => void;
  highlight?: boolean;
  variant?: 'default' | 'subtle';
  showUserBadge?: boolean;
  showDelete?: boolean;
  headerVariant?: 'default' | 'challenge';
}

export const ActivityItem: React.FC<ActivityItemProps> = ({
  activity,
  onDelete,
  highlight,
  variant = 'default',
  showUserBadge = true,
  showDelete = true,
  headerVariant = 'default',
}) => {
  const { user } = useAuth();
  const config = activityConfig[activity.type] || { icon: "help-circle-outline", label: "Activité", iconFamily: "Ionicons" };
  const activityId = activity._id || activity.id;
  const { date, time } = activityFormatters.formatDateTime(activity.date);

  const getActivityUserId = () => {
    if (typeof activity.user === 'string') return activity.user;
    if (activity.user && typeof activity.user === 'object' && activity.user._id) return activity.user._id;
    if (activity.userId) return activity.userId;
    return undefined;
  };

  const getActivityUserName = () => {
    if (activity.user && typeof activity.user === 'object') {
      const u: any = activity.user;
      if (u.username) return u.username;
      if (u.email) return u.email.split('@')[0];
    }
    return undefined;
  };

  const activityUserId = getActivityUserId();
  const isMyActivity = Boolean(activityUserId && user?._id && activityUserId === user._id);
  const userColor = isMyActivity ? theme.colors.users.primary : theme.colors.users.secondary;
  const userName = isMyActivity
    ? ((user as any)?.username || user?.email?.split('@')[0] || 'Moi')
    : (getActivityUserName() || 'Équipier');

  const IconComponent = config.iconFamily === 'MaterialCommunityIcons'
    ? MaterialCommunityIcons
    : Ionicons;

  const handleDelete = (e: any) => {
    e.preventDefault();

    if (Platform.OS === 'web') {
      if (confirm("Supprimer cette activité ?")) {
        onDelete(activityId);
      }
    } else {
      Alert.alert(
        "Supprimer l'activité",
        "Êtes-vous sûr ?",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Supprimer", style: "destructive", onPress: () => onDelete(activityId) },
        ]
      );
    }
  };

  const renderDetails = () => {
    const details: string[] = [activityFormatters.formatDuration(activity.duration)];

    if (activity.distance) {
      details.push(activityFormatters.formatDistance(activity.distance));
    }

    if (activity.elevationGain) {
      details.push(activityFormatters.formatElevation(activity.elevationGain));
    }

    if (activity.avgSpeed) {
      details.push(activityFormatters.formatSpeed(activity.avgSpeed));
    }

    if (activity.exercises && activity.exercises.length > 0) {
      details.push(`${activity.exercises.length} exercice${activity.exercises.length > 1 ? 's' : ''}`);
    }

    if (activity.laps) {
      details.push(`${activity.laps} longueurs`);
    }

    return details.join(' • ');
  };

  const isSubtle = variant === 'subtle';
  const borderLeftWidth = isSubtle ? 0 : 3;
  const borderLeftColor = isSubtle ? 'transparent' : userColor;
  const iconBg = isSubtle ? `${userColor}12` : `${userColor}25`;
  const badgeBg = isSubtle ? `${userColor}1A` : `${userColor}40`;
  const highlightColor = theme.colors.warning;
  const isChallengeHeader = headerVariant === 'challenge';

  const Card = (
    <Pressable>
      {isSubtle ? (
        <View
          style={[
            styles.container,
            styles.subtleContainer,
            { borderLeftColor, borderLeftWidth },
          ]}
        >
          {/* Icône */}
          <View style={[styles.activityIcon, { backgroundColor: iconBg }]}>
            <IconComponent
              name={config.icon as any}
              size={22}
              color={userColor}
            />
          </View>

          {/* Détails */}
          <View style={styles.detailsContainer}>
            <View style={[styles.header, isChallengeHeader && styles.headerChallenge]}>
              <Text style={styles.title}>{activity.title}</Text>

              {isChallengeHeader ? (
                <View style={styles.rightStack}>
                  {showUserBadge && (
                    <View style={[styles.userBadge, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.badgeText, { color: userColor }]}>
                        {userName.toUpperCase()}
                      </Text>
                    </View>
                  )}

                  {highlight && (
                    <Ionicons
                      name="flash"
                      size={13}
                      color={highlightColor}
                      style={[styles.countedIcon, styles.countedIconSubtle, styles.countedIconBelow]}
                    />
                  )}
                </View>
              ) : (
                <>
                  {showUserBadge && (
                    <View style={[styles.userBadge, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.badgeText, { color: userColor }]}>
                        {userName.toUpperCase()}
                      </Text>
                    </View>
                  )}

                  {highlight && (
                    <Ionicons
                      name="flash"
                      size={13}
                      color={highlightColor}
                      style={[styles.countedIcon, styles.countedIconSubtle]}
                    />
                  )}
                </>
              )}
            </View>

            <Text style={styles.details}>{renderDetails()}</Text>
            <Text style={styles.dateTime}>{date} à {time}</Text>

            {activity.exercises && activity.exercises.length > 0 && (
              <Text style={styles.exercises}>
                {activity.exercises.slice(0, 2).map(ex => ex.name).join(', ')}
                {activity.exercises.length > 2 && ` +${activity.exercises.length - 2}`}
              </Text>
            )}
          </View>

          {/* Bouton supprimer (uniquement sur mes activités) */}
          {showDelete && isMyActivity && (
            <TouchableOpacity
              onPress={handleDelete}
              style={[styles.deleteButton, styles.deleteButtonSubtle]}
            >
              <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <LinearGradient
          colors={theme.gradients.card}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.container,
            { borderLeftColor, borderLeftWidth },
          ]}
        >
        {/* Icône */}
        <View style={[styles.activityIcon, { backgroundColor: iconBg }]}>
          <IconComponent
            name={config.icon as any}
            size={24}
            color={userColor}
          />
        </View>

        {/* Détails */}
        <View style={styles.detailsContainer}>
          <View style={[styles.header, isChallengeHeader && styles.headerChallenge]}>
            <Text style={styles.title}>{activity.title}</Text>

            {isChallengeHeader ? (
              <View style={styles.rightStack}>
                {showUserBadge && (
                  <View style={[styles.userBadge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.badgeText, { color: userColor }]}>
                      {userName.toUpperCase()}
                    </Text>
                  </View>
                )}

                {highlight && (
                  <Ionicons
                    name="flash"
                    size={14}
                    color={highlightColor}
                    style={[styles.countedIcon, styles.countedIconBelow]}
                  />
                )}
              </View>
            ) : (
              <>
                {showUserBadge && (
                  <View style={[styles.userBadge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.badgeText, { color: userColor }]}>
                      {userName.toUpperCase()}
                    </Text>
                  </View>
                )}

                {highlight && (
                  <Ionicons
                    name="flash"
                    size={14}
                    color={highlightColor}
                    style={styles.countedIcon}
                  />
                )}
              </>
            )}
          </View>

          <Text style={styles.details}>{renderDetails()}</Text>
          <Text style={styles.dateTime}>{date} à {time}</Text>

          {activity.exercises && activity.exercises.length > 0 && (
            <Text style={styles.exercises}>
              {activity.exercises.slice(0, 2).map(ex => ex.name).join(', ')}
              {activity.exercises.length > 2 && ` +${activity.exercises.length - 2}`}
            </Text>
          )}
        </View>

        {/* Bouton supprimer (uniquement sur mes activités) */}
        {showDelete && isMyActivity && (
          <TouchableOpacity
            onPress={handleDelete}
            style={styles.deleteButton}
          >
            <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
          </TouchableOpacity>
        )}
        </LinearGradient>
      )}
    </Pressable>
  );

  return (
    <Link href={`/activities/${activityId}`} asChild>
      {Card}
    </Link>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 14,
  },
  subtleContainer: {
    backgroundColor: theme.colors.bg.elevated,
    borderColor: theme.colors.borderSubtle,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerChallenge: {
    alignItems: 'flex-start',
  },
  rightStack: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  countedIcon: {
    marginLeft: 2,
  },
  countedIconBelow: {
    marginLeft: 0,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  countedIconSubtle: {
    opacity: 0.75,
  },
  title: {
    color: theme.colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  userBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  details: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  dateTime: {
    color: theme.colors.text.tertiary,
    fontSize: 11,
    marginTop: 4,
  },
  exercises: {
    color: theme.colors.text.tertiary,
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonSubtle: {
    borderColor: theme.colors.borderSubtle,
  },
});