// components/WeeklyChallenge/ChallengeForm.tsx

import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  StyleSheet,
  ActivityIndicator 
} from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useChallenge } from '../../context/ChallengeContext';
import { activityConfig, ActivityTypeKey } from '../../utils/activityConfig';
import { theme } from '../../utils/theme';
import { ChallengeGoalType, ChallengeMode } from '../../types/Challenge';
import { usePartner } from '../../context/PartnerContext';

interface ChallengeFormProps {
  mode?: 'create' | 'edit';
  defaultMode?: ChallengeMode; // 'solo' or 'duo' preselection when creating
  onSuccess?: (result?: { mode: ChallengeMode; partnerName?: string; invitationPending?: boolean }) => void;
  onCancel?: () => void;
}

const ICONS = [
  'trophy-outline',
  'flag-outline',
  'star-outline',
  'medal-outline',
  'fitness-outline',
  'flash-outline',
  'rocket-outline',
  'flame-outline',
];

export function ChallengeForm({ 
  mode = 'create', 
  defaultMode,
  onSuccess, 
  onCancel 
}: ChallengeFormProps) {
  const { currentChallenge, createChallenge, updateChallenge } = useChallenge();
  const { activeSlot, partnerLinks } = usePartner();

  // In create mode, the challenge mode is locked to the active slot:
  // - solo slot => solo challenge only
  // - p1/p2 slot => duo challenge only (partner comes from slot)
  const lockedCreateMode: ChallengeMode | null =
    mode === 'create' ? (activeSlot === 'solo' ? 'solo' : 'duo') : null;

  const [challengeMode, setChallengeMode] = useState<ChallengeMode>(
    lockedCreateMode ?? defaultMode ?? 'solo',
  );
  
  const [selectedTypes, setSelectedTypes] = useState<ActivityTypeKey[]>([]);
  const [goalType, setGoalType] = useState<ChallengeGoalType>('distance');
  const [goalValue, setGoalValue] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('trophy-outline');
  const [loading, setLoading] = useState(false);

  const slotPartner = useMemo(() => {
    if (activeSlot === 'solo') return null;
    return partnerLinks.find((p) => p.slot === activeSlot) || null;
  }, [activeSlot, partnerLinks]);

  useEffect(() => {
    if (mode !== 'create') return;
    if (!lockedCreateMode) return;
    setChallengeMode(lockedCreateMode);
  }, [mode, lockedCreateMode]);

  useEffect(() => {
    if (mode === 'edit' && currentChallenge) {
      setChallengeMode(currentChallenge.mode);
      setSelectedTypes(currentChallenge.activityTypes as ActivityTypeKey[]);
      setSelectedIcon(currentChallenge.icon || 'trophy-outline');
      
      if (currentChallenge.goal) {
        setGoalType(currentChallenge.goal.type);
        setGoalValue(currentChallenge.goal.value.toString());
      }
    }
  }, [mode, currentChallenge]);

  const toggleActivityType = (type: ActivityTypeKey) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type]
    );
  };

  const handleSubmit = async () => {
    if (selectedTypes.length === 0) {
      Alert.alert('Erreur', 'Sélectionnez au moins un type d\'activité');
      return;
    }

    if (challengeMode === 'duo') {
      const partner = slotPartner;

      if (!partner?.partnerId) {
        Alert.alert('Erreur', 'Aucun partenaire configuré pour ce slot (P1/P2)');
        return;
      }

      if (partner.status !== 'confirmed') {
        Alert.alert('En attente', 'Votre partenaire doit confirmer l\'invitation avant de lancer un pacte DUO.');
        return;
      }
    }

    const value = parseFloat(goalValue);
    if (!value || value <= 0) {
      Alert.alert('Erreur', 'Valeur d\'objectif invalide');
      return;
    }

    try {
      setLoading(true);
      
      let title = '';
      if (goalType === 'distance') {
        title = `${value} km`;
      } else if (goalType === 'duration') {
        const h = Math.floor(value / 60);
        const m = value % 60;
        title = h > 0 ? `${h}h${m > 0 ? m + 'min' : ''}` : `${m}min`;
      } else {
        title = `${value} activité${value > 1 ? 's' : ''}`;
      }

      if (mode === 'edit') {
        await updateChallenge({
          activityTypes: selectedTypes,
          goal: { type: goalType, value: value },
          title,
          icon: selectedIcon,
        });
      } else {
        const challengeData: any = {
          mode: challengeMode,
          activityTypes: selectedTypes,
          goal: { type: goalType, value: value },
          title,
          icon: selectedIcon,
        };

        if (challengeMode === 'duo') {
          if (slotPartner?.partnerId) {
            challengeData.partnerId = slotPartner.partnerId;
          }
        }

        await createChallenge(challengeData);
      }

      if (mode === 'create' && challengeMode === 'duo') {
        const partner: any = slotPartner?.partner;
        const partnerName = partner?.username || partner?.email?.split('@')[0] || 'Partenaire';

        onSuccess?.({
          mode: 'duo',
          partnerName,
          invitationPending: true,
        });
      } else {
        onSuccess?.({ mode: challengeMode });
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getPartnerEmail = () => {
    const partner = slotPartner;
    if (!partner?.partnerId) return 'Aucun partenaire (configurer P1/P2)';
    const p: any = partner?.partner;
    const display = p?.username || p?.email || 'Partenaire';
    if (partner.status === 'pending') return `${display} (en attente)`;
    return display;
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      
      {/* Mode (locked to slot) */}
      {mode === 'create' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MODE</Text>
          <View style={styles.modeSelector}>
            <View style={[styles.modeButton, styles.modeButtonActive]}>
              <Ionicons
                name={challengeMode === 'solo' ? 'person-outline' : 'people-outline'}
                size={24}
                color={theme.colors.users.primary}
              />
              <Text style={[styles.modeButtonText, styles.modeButtonTextActive]}>
                {challengeMode === 'solo' ? 'Solo' : 'Duo'}
              </Text>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.users.primary} />
            </View>
          </View>
        </View>
      )}

      {/* Sélection partenaire (DUO) */}
      {mode === 'create' && challengeMode === 'duo' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PARTENAIRE</Text>

          <View style={styles.partnerSelector}>
            <View style={styles.partnerSelectorLeft}>
              <Ionicons
                name={slotPartner?.partnerId ? 'people-outline' : 'alert-circle-outline'}
                size={20}
                color={slotPartner?.partnerId ? theme.colors.users.primary : theme.colors.warning}
              />
              <Text style={styles.partnerSelectorText}>{getPartnerEmail()}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Types d'activités */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TYPES D’ACTIVITÉS</Text>
        <View style={styles.typesGrid}>
          {Object.entries(activityConfig).map(([key, config]) => {
            const IconComponent = config.iconFamily === 'MaterialCommunityIcons' 
              ? MaterialCommunityIcons 
              : Ionicons;
            const isSelected = selectedTypes.includes(key as ActivityTypeKey);
            
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.typeButton,
                  isSelected && styles.typeButtonActive
                ]}
                onPress={() => toggleActivityType(key as ActivityTypeKey)}
              >
                <IconComponent 
                  name={config.icon as any} 
                  size={18} 
                  color={isSelected 
                    ? theme.colors.text.primary 
                    : theme.colors.text.muted
                  } 
                />
                <Text style={[
                  styles.typeButtonText,
                  isSelected && styles.typeButtonTextActive
                ]}>
                  {config.label}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={16} color={theme.colors.users.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Objectif */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TYPE D’OBJECTIF (UN SEUL CHOIX)</Text>

        <TouchableOpacity 
          style={[
            styles.goalOption,
            goalType === 'distance' && styles.goalOptionActive
          ]}
          onPress={() => setGoalType('distance')}
        >
          <View style={styles.goalHeader}>
            <Ionicons 
              name={goalType === 'distance' ? "radio-button-on" : "radio-button-off"} 
              size={24} 
              color={goalType === 'distance' ? theme.colors.users.primary : theme.colors.text.muted} 
            />
            <Text style={styles.goalLabel}>Distance (km)</Text>
          </View>
          {goalType === 'distance' && (
            <TextInput
              style={styles.goalInput}
              value={goalValue}
              onChangeText={setGoalValue}
              keyboardType="numeric"
              placeholder="Ex: 50"
              placeholderTextColor={theme.colors.text.muted}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.goalOption,
            goalType === 'duration' && styles.goalOptionActive
          ]}
          onPress={() => setGoalType('duration')}
        >
          <View style={styles.goalHeader}>
            <Ionicons 
              name={goalType === 'duration' ? "radio-button-on" : "radio-button-off"} 
              size={24} 
              color={goalType === 'duration' ? theme.colors.users.primary : theme.colors.text.muted} 
            />
            <Text style={styles.goalLabel}>Durée (minutes)</Text>
          </View>
          {goalType === 'duration' && (
            <TextInput
              style={styles.goalInput}
              value={goalValue}
              onChangeText={setGoalValue}
              keyboardType="numeric"
              placeholder="Ex: 300"
              placeholderTextColor={theme.colors.text.muted}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.goalOption,
            goalType === 'count' && styles.goalOptionActive
          ]}
          onPress={() => setGoalType('count')}
        >
          <View style={styles.goalHeader}>
            <Ionicons 
              name={goalType === 'count' ? "radio-button-on" : "radio-button-off"} 
              size={24} 
              color={goalType === 'count' ? theme.colors.users.primary : theme.colors.text.muted} 
            />
            <Text style={styles.goalLabel}>Nombre d’activités</Text>
          </View>
          {goalType === 'count' && (
            <TextInput
              style={styles.goalInput}
              value={goalValue}
              onChangeText={setGoalValue}
              keyboardType="numeric"
              placeholder="Ex: 5"
              placeholderTextColor={theme.colors.text.muted}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Icône */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ICÔNE</Text>
        <View style={styles.iconsRow}>
          {ICONS.map((icon) => (
            <TouchableOpacity
              key={icon}
              style={[
                styles.iconButton,
                selectedIcon === icon && styles.iconButtonActive
              ]}
              onPress={() => setSelectedIcon(icon)}
            >
              <Ionicons 
                name={icon as any} 
                size={24} 
                color={selectedIcon === icon ? theme.colors.users.primary : theme.colors.text.muted} 
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Boutons */}
      <View style={styles.buttonRow}>
        {onCancel && (
          <TouchableOpacity 
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            disabled={loading}
          >
            <Text style={styles.buttonCancelText}>Annuler</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.button, styles.submitButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <LinearGradient
            colors={theme.gradients.countdown}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitGradient}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'edit' ? 'Enregistrer' : 
                  challengeMode === 'duo' ? 'Envoyer l\'invitation' : 'Créer le pacte'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg.primary,
    padding: 20,
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
  modeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: theme.colors.bg.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  modeButtonActive: {
    borderColor: theme.colors.users.primary,
    backgroundColor: `${theme.colors.users.primary}10`,
  },
  modeButtonText: {
    fontSize: 16,
    color: theme.colors.text.muted,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: theme.colors.users.primary,
    fontWeight: '700',
  },
  partnerSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.bg.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  partnerSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  partnerSelectorText: {
    fontSize: 15,
    color: theme.colors.text.primary,
    fontWeight: '500',
  },
  partnerListContainer: {
    backgroundColor: theme.colors.bg.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    overflow: 'hidden',
  },
  partnerListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  partnerListTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  partnerList: {
    maxHeight: 240,
  },
  partnerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  partnerItemActive: {
    backgroundColor: `${theme.colors.users.primary}08`,
  },
  partnerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  partnerAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  partnerInfo: {
    flex: 1,
  },
  partnerEmail: {
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: '600',
  },
  partnerDiamonds: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  emptyPartnerList: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 12,
  },
  typesGrid: {
    gap: 10,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.bg.card,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  typeButtonActive: {
    borderColor: theme.colors.users.primary,
    backgroundColor: `${theme.colors.users.primary}10`,
  },
  typeButtonText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text.muted,
  },
  typeButtonTextActive: {
    color: theme.colors.text.primary,
    fontWeight: '600',
  },
  goalOption: {
    marginBottom: 12,
    backgroundColor: theme.colors.bg.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    gap: 12,
  },
  goalOptionActive: {
    borderColor: theme.colors.users.primary,
    backgroundColor: `${theme.colors.users.primary}08`,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goalLabel: {
    fontSize: 14,
    color: theme.colors.text.primary,
    fontWeight: '500',
  },
  goalInput: {
    backgroundColor: theme.colors.bg.input,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  iconButtonActive: {
    borderColor: theme.colors.users.primary,
    backgroundColor: `${theme.colors.users.primary}10`,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 40,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cancelButton: {
    backgroundColor: theme.colors.bg.input,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  submitButton: {},
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
});