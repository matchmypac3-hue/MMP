// components/InvitationsModal.tsx

import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useChallenge } from '../context/ChallengeContext';
import { activityConfig } from '../utils/activityConfig';
import { activityFormatters } from '../utils/activityFormatters';
import { theme } from '../utils/theme';
import { Challenge } from '../types/Challenge';

interface InvitationsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function InvitationsModal({ visible, onClose }: InvitationsModalProps) {
  const { pendingInvitations, acceptInvitation, refuseInvitation } = useChallenge();

  const handleAccept = async (challenge: Challenge) => {
    try {
      await acceptInvitation(challenge._id);
      Alert.alert('✅ Invitation acceptée', 'Le challenge commence maintenant !');
      onClose();
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    }
  };

  const handleRefuse = async (challenge: Challenge) => {
    Alert.alert(
      'Refuser l\'invitation',
      'Êtes-vous sûr ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            try {
              await refuseInvitation(challenge._id);
              Alert.alert('Invitation refusée');
            } catch (error: any) {
              Alert.alert('Erreur', error.message);
            }
          }
        }
      ]
    );
  };

  const getCreatorName = (challenge: Challenge) => {
    const creator = challenge.players.find(p => {
      const userId = typeof p.user === 'string' ? p.user : p.user._id;
      return userId === challenge.creator;
    });
    
    if (!creator) return 'Utilisateur inconnu';
    const creatorUser = typeof creator.user === 'string' 
      ? { email: 'Utilisateur' } 
      : creator.user;
    const u: any = creatorUser;
    return u.username || u.email?.split('@')[0] || 'Utilisateur';
  };

  const formatGoalValue = (value: number, type: string) => {
    switch (type) {
      case 'distance': return `${value} km`;
      case 'duration': return activityFormatters.formatDuration(value);
      case 'count': return `${value} activité${value > 1 ? 's' : ''}`;
      default: return String(value);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              Invitations ({pendingInvitations.length})
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {pendingInvitations.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="mail-open-outline" size={64} color={theme.colors.text.tertiary} />
                <Text style={styles.emptyText}>Aucune invitation</Text>
                <Text style={styles.emptySubtext}>Vous serez notifié quand quelqu’un vous invite</Text>
              </View>
            ) : (
              pendingInvitations.map((challenge) => (
                <LinearGradient
                  key={challenge._id}
                  colors={theme.gradients.card}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.invitationCard}
                >
                  {/* Header */}
                  <View style={styles.invitationHeader}>
                    <View style={styles.invitationIconContainer}>
                      <Ionicons name={challenge.icon as any} size={24} color={theme.colors.users.primary} />
                    </View>
                    <View style={styles.invitationHeaderText}>
                      <Text style={styles.invitationFrom}>
                        <Text style={styles.invitationFromBold}>{getCreatorName(challenge)}</Text>
                        {' '}vous invite
                      </Text>
                      <Text style={styles.invitationTitle}>{challenge.title}</Text>
                    </View>
                  </View>

                  {/* Détails */}
                  <View style={styles.invitationDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="flag-outline" size={16} color={theme.colors.text.secondary} />
                      <Text style={styles.detailText}>
                        Objectif : {formatGoalValue(challenge.goal.value, challenge.goal.type)}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar-outline" size={16} color={theme.colors.text.secondary} />
                      <Text style={styles.detailText}>
                        Jusqu’au {new Date(challenge.endDate).toLocaleDateString('fr-FR', { 
                          day: 'numeric', 
                          month: 'short' 
                        })}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      {challenge.activityTypes.map((type, idx) => {
                        const config = activityConfig[type];
                        const IconComponent = config?.iconFamily === 'MaterialCommunityIcons' 
                          ? MaterialCommunityIcons 
                          : Ionicons;
                        return (
                          <View key={idx} style={styles.activityTypeIcon}>
                            <IconComponent
                              name={config?.icon as any}
                              size={14}
                              color={theme.colors.text.secondary}
                            />
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.invitationActions}>
                    <TouchableOpacity
                      style={styles.refuseButton}
                      onPress={() => handleRefuse(challenge)}
                    >
                      <Ionicons name="close-circle-outline" size={20} color="#ff6b6b" />
                      <Text style={styles.refuseButtonText}>Refuser</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => handleAccept(challenge)}
                    >
                      <LinearGradient
                        colors={theme.gradients.countdown}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.acceptGradient}
                      >
                        <Ionicons name="checkmark-circle-outline" size={20} color="#000" />
                        <Text style={styles.acceptButtonText}>Accepter</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              ))
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
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
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
    marginTop: 8,
    textAlign: 'center',
  },
  invitationCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  invitationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  invitationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${theme.colors.users.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitationHeaderText: {
    flex: 1,
  },
  invitationFrom: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 4,
  },
  invitationFromBold: {
    fontWeight: '700',
    color: theme.colors.users.primary,
  },
  invitationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  invitationDetails: {
    gap: 10,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  activityTypeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 12,
  },
  refuseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: theme.colors.bg.input,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  refuseButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ff6b6b',
  },
  acceptButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  acceptGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
});