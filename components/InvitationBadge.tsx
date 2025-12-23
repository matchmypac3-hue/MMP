// components/InvitationBadge.tsx

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useChallenge } from '../context/ChallengeContext';

interface InvitationBadgeProps {
  onPress: () => void;
}

export function InvitationBadge({ onPress }: InvitationBadgeProps) {
  const { pendingInvitations } = useChallenge();

  if (pendingInvitations.length === 0) return null;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <LinearGradient
        colors={['#FF8A80', '#FF6B6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <Ionicons name="mail" size={20} color="#fff" />
          <Text style={styles.text}>
            {pendingInvitations.length} invitation{pendingInvitations.length > 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingInvitations.length}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    position: 'relative',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF6B6B',
  },
});