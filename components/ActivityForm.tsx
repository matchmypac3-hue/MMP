// components/ActivityForm.tsx

import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Activity } from "../types/Activity";
import { useActivities } from "../context/ActivityContext";
import { useChallenge } from "../context/ChallengeContext";
import { formConfig, ActivityTypeKey } from "../utils/formConfig";
import { activityConfig } from "../utils/activityConfig";
import { theme } from "../utils/theme";

interface ActivityFormProps {
  onClose: () => void;
}

type Exercise = {
  name: string;
  sets?: string;
  reps?: string;
  weight?: string;
};

export const ActivityForm: React.FC<ActivityFormProps> = ({ onClose }) => {
  const { addActivity } = useActivities();
  const { refreshChallenge } = useChallenge();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [type, setType] = useState<ActivityTypeKey>("running");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [elevation, setElevation] = useState("");
  const [poolLength, setPoolLength] = useState("");
  const [laps, setLaps] = useState("");
  
  const [activityDate, setActivityDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [exercises, setExercises] = useState<Exercise[]>([
    { name: "", sets: "", reps: "", weight: "" },
  ]);

  const handleExerciseChange = (index: number, field: keyof Exercise, value: string) => {
    const newExercises = [...exercises];
    newExercises[index][field] = value;
    setExercises(newExercises);
  };

  const addExercise = () => {
    setExercises([...exercises, { name: "", sets: "", reps: "", weight: "" }]);
  };

  const removeExercise = (index: number) => {
    const newExercises = exercises.filter((_, i) => i !== index);
    setExercises(newExercises);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setActivityDate(selectedDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const newDate = new Date(activityDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setActivityDate(newDate);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert('Le titre est requis');
      return;
    }
    
    const durationNum = parseInt(duration, 10);
    if (!duration || isNaN(durationNum) || durationNum <= 0) {
      alert('La durée doit être un nombre positif');
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const activityData: Partial<Activity> = {
        title: title.trim(),
        type,
        source: 'manual',
        duration: durationNum,
        date: activityDate.toISOString(),
      };

      if (distance && ['running', 'cycling', 'walking', 'swimming'].includes(type)) {
        const distNum = parseFloat(distance);
        if (!isNaN(distNum) && distNum > 0) {
          activityData.distance = distNum;
        }
      }

      if (elevation && ['running', 'cycling'].includes(type)) {
        const elevNum = parseInt(elevation, 10);
        if (!isNaN(elevNum) && elevNum > 0) {
          activityData.elevationGain = elevNum;
        }
      }

      if (type === 'swimming') {
        if (poolLength) {
          const poolNum = parseInt(poolLength, 10);
          if (!isNaN(poolNum) && poolNum > 0) {
            activityData.poolLength = poolNum;
          }
        }
        if (laps) {
          const lapsNum = parseInt(laps, 10);
          if (!isNaN(lapsNum) && lapsNum > 0) {
            activityData.laps = lapsNum;
          }
        }
      }

      if (type === 'workout') {
        const filteredExercises = exercises
          .filter((ex) => ex.name.trim())
          .map((ex) => ({
            name: ex.name,
            sets: ex.sets ? parseInt(ex.sets, 10) : undefined,
            reps: ex.reps ? parseInt(ex.reps, 10) : undefined,
            weight: ex.weight ? parseFloat(ex.weight) : undefined,
          }));
        
        if (filteredExercises.length > 0) {
          activityData.exercises = filteredExercises;
        }
      }

      console.log('📤 Envoi activité:', activityData);
      await addActivity(activityData as Omit<Activity, "id">);
      
      try {
        await refreshChallenge();
      } catch (err) {
        console.warn('Impossible de rafraîchir le challenge:', err);
      }
      
      onClose();
    } catch (error: any) {
      console.error("Failed to add activity:", error);
      alert(error?.message || "Erreur lors de l'ajout de l'activité");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSpecificFields = () => {
    const fields = formConfig[type].fields;
    return (
      <>
        {fields.includes("distance") && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Distance (km)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 5.5"
              placeholderTextColor={theme.colors.text.muted}
              value={distance}
              onChangeText={setDistance}
              keyboardType="decimal-pad"
            />
          </View>
        )}
        {fields.includes("elevationGain") && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Dénivelé (m)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 250"
              placeholderTextColor={theme.colors.text.muted}
              value={elevation}
              onChangeText={setElevation}
              keyboardType="numeric"
            />
          </View>
        )}
        {fields.includes("poolLength") && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Longueur bassin (m)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 25"
              placeholderTextColor={theme.colors.text.muted}
              value={poolLength}
              onChangeText={setPoolLength}
              keyboardType="numeric"
            />
          </View>
        )}
        {fields.includes("laps") && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nombre de longueurs</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 20"
              placeholderTextColor={theme.colors.text.muted}
              value={laps}
              onChangeText={setLaps}
              keyboardType="numeric"
            />
          </View>
        )}
        {fields.includes("exercises") && (
          <View>
            <Text style={styles.sectionTitle}>Exercices</Text>
            {exercises.map((exercise, index) => (
              <View key={index} style={styles.exerciseContainer}>
                <TextInput
                  style={styles.input}
                  placeholder={`Exercice ${index + 1}`}
                  placeholderTextColor={theme.colors.text.muted}
                  value={exercise.name}
                  onChangeText={(value) => handleExerciseChange(index, "name", value)}
                />
                <View style={styles.exerciseRow}>
                  <TextInput
                    style={[styles.input, styles.exerciseInput]}
                    placeholder="Séries"
                    placeholderTextColor={theme.colors.text.muted}
                    value={exercise.sets}
                    onChangeText={(value) => handleExerciseChange(index, "sets", value)}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[styles.input, styles.exerciseInput]}
                    placeholder="Rép."
                    placeholderTextColor={theme.colors.text.muted}
                    value={exercise.reps}
                    onChangeText={(value) => handleExerciseChange(index, "reps", value)}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[styles.input, styles.exerciseInput]}
                    placeholder="Poids (kg)"
                    placeholderTextColor={theme.colors.text.muted}
                    value={exercise.weight}
                    onChangeText={(value) => handleExerciseChange(index, "weight", value)}
                    keyboardType="decimal-pad"
                  />
                </View>
                {exercises.length > 1 && (
                  <TouchableOpacity onPress={() => removeExercise(index)} style={styles.removeButton}>
                    <Ionicons name="trash-outline" size={18} color="#ff4d4d" />
                    <Text style={styles.removeButtonText}>Supprimer</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity onPress={addExercise} style={styles.addExerciseButton}>
              <Ionicons name="add-circle-outline" size={20} color={theme.colors.users.primary} />
              <Text style={styles.addExerciseText}>Ajouter un exercice</Text>
            </TouchableOpacity>
          </View>
        )}
      </>
    );
  };

  const renderDateTimePickers = () => {
    if (Platform.OS === 'web') {
      // Version WEB avec inputs HTML5
      return (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Date</Text>
            <input
              type="date"
              value={activityDate.toISOString().split('T')[0]}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e: any) => {
                const newDate = new Date(e.target.value);
                newDate.setHours(activityDate.getHours(), activityDate.getMinutes());
                setActivityDate(newDate);
              }}
              style={{
                height: 50,
                backgroundColor: theme.colors.bg.input,
                borderRadius: 12,
                paddingLeft: 16,
                paddingRight: 16,
                color: theme.colors.text.primary,
                fontSize: 16,
                border: `1px solid ${theme.colors.border}`,
                width: '100%',
              }}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Heure</Text>
            <input
              type="time"
              value={activityDate.toTimeString().slice(0, 5)}
              onChange={(e: any) => {
                const [hours, minutes] = e.target.value.split(':');
                const newDate = new Date(activityDate);
                newDate.setHours(parseInt(hours), parseInt(minutes));
                setActivityDate(newDate);
              }}
              style={{
                height: 50,
                backgroundColor: theme.colors.bg.input,
                borderRadius: 12,
                paddingLeft: 16,
                paddingRight: 16,
                color: theme.colors.text.primary,
                fontSize: 16,
                border: `1px solid ${theme.colors.border}`,
                width: '100%',
              }}
            />
          </View>
        </>
      );
    }

    // Version MOBILE avec DateTimePicker natif
    return (
      <>
        <View style={styles.dateTimeRow}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.inputLabel}>Date</Text>
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={theme.colors.users.primary} />
              <Text style={styles.dateTimeText}>
                {activityDate.toLocaleDateString('fr-FR', { 
                  day: '2-digit', 
                  month: 'short',
                  year: 'numeric'
                })}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.inputLabel}>Heure</Text>
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time-outline" size={20} color={theme.colors.users.primary} />
              <Text style={styles.dateTimeText}>
                {activityDate.toLocaleTimeString('fr-FR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={activityDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            maximumDate={new Date()}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={activityDate}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onTimeChange}
          />
        )}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Titre */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Titre de l’activité</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Course matinale"
            placeholderTextColor={theme.colors.text.muted}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Type d’activité */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Type d’activité</Text>
          <View style={styles.typeSelector}>
            {(Object.keys(activityConfig) as ActivityTypeKey[]).map((key) => {
              const cfg = activityConfig[key];
              const Icon = cfg.iconFamily === 'MaterialCommunityIcons' 
                ? MaterialCommunityIcons 
                : Ionicons;
              const isSelected = type === key;

              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.typeButton,
                    isSelected && styles.typeButtonActive
                  ]}
                  onPress={() => setType(key)}
                >
                  <Icon 
                    name={cfg.icon as any} 
                    size={24} 
                    color={isSelected ? theme.colors.accent.action : theme.colors.text.muted}
                  />
                  <Text style={[
                    styles.typeButtonText,
                    isSelected && styles.typeButtonTextActive
                  ]}>
                    {cfg.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Date et Heure */}
        {renderDateTimePickers()}

        {/* Durée */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Durée (minutes)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 45"
            placeholderTextColor={theme.colors.text.muted}
            value={duration}
            onChangeText={setDuration}
            keyboardType="numeric"
          />
        </View>

        {/* Champs spécifiques */}
        {renderSpecificFields()}

        {/* Boutons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={isSubmitting}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <LinearGradient
              colors={isSubmitting 
                ? (['#666', '#555'] as const) 
                : theme.gradients.countdown
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitGradient}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#000" />
                  <Text style={styles.submitButtonText}>Ajouter</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

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
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 50,
    backgroundColor: theme.colors.bg.input,
    borderRadius: 12,
    paddingHorizontal: 16,
    color: theme.colors.text.primary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.bg.sunken,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${theme.colors.accent.action}55`,
  },
  typeButtonActive: {
    borderColor: theme.colors.accent.action,
    backgroundColor: `${theme.colors.accent.action}20`,
  },
  typeButtonText: {
    fontSize: 14,
    color: theme.colors.text.muted,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: theme.colors.accent.action,
    fontWeight: '600',
  },
  dateTimeRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    backgroundColor: theme.colors.bg.input,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateTimeText: {
    fontSize: 16,
    color: theme.colors.text.primary,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 12,
  },
  exerciseContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: theme.colors.bg.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  exerciseRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  exerciseInput: {
    flex: 1,
    marginBottom: 0,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  removeButtonText: {
    color: "#ff4d4d",
    fontSize: 14,
    fontWeight: '500',
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: `${theme.colors.users.primary}15`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${theme.colors.users.primary}30`,
    marginTop: 10,
  },
  addExerciseText: {
    color: theme.colors.users.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    height: 56,
    backgroundColor: theme.colors.bg.input,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  cancelButtonText: {
    color: theme.colors.text.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  submitButton: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});