// components/WeeklyChallenge/ChallengeCard.tsx

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChallenge } from '../../context/ChallengeContext';

interface ChallengeCardProps {
  onPress: () => void;
}

export function ChallengeCard({ onPress }: ChallengeCardProps) {
  const { currentChallenge } = useChallenge();

  if (!currentChallenge) return null;

  const { title, icon, progress } = currentChallenge;

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Ionicons name={icon as any || 'trophy-outline'} size={24} color="#ffd700" />
        <Text style={styles.title}>{title}</Text>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>

      {progress && (
        <>
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, { 
                width: `${Math.min(progress.percentage, 100)}%`,
                backgroundColor: progress.isCompleted ? '#4caf50' : '#ffd700'
              }]} 
            />
          </View>

          <View style={styles.stats}>
            <Text style={styles.percentage}>
              {progress.percentage.toFixed(0)}%
            </Text>
            {progress.isCompleted && (
              <View style={styles.badge}>
                <Ionicons name="checkmark-circle" size={16} color="#4caf50" />
                <Text style={styles.badgeText}>Terminé</Text>
              </View>
            )}
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  percentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffd700',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: '500',
  },
});