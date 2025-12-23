import React from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Activity } from "../../types/Activity";
import { useActivities } from "../../context/ActivityContext";
import { activityConfig } from "../../utils/activityConfig";
import { formConfig } from "../../utils/formConfig";
import { activityFormatters } from "../../utils/activityFormatters";
import { useActivityForm } from "../../hooks/useActivityForm";
import { DateTimeSelector } from "./DateTimeSelector";
import { ExerciseList } from "./ExerciseList";
import { theme } from "../../utils/theme";

interface ActivityFormProps {
  onClose: () => void;
}

export const ActivityForm: React.FC<ActivityFormProps> = ({ onClose }) => {
  const { addActivity } = useActivities();
  
  const {
    isSubmitting,
    setIsSubmitting,
    type,
    setType,
    title,
    setTitle,
    hours,
    setHours,
    minutes,
    setMinutes,
    distance,
    setDistance,
    elevation,
    setElevation,
    activityDate,
    exercises,
    updateActivityDate,
    updateActivityTime,
    addExercise,
    removeExercise,
    updateExercise,
    resetForm,
    isFormValid,
  } = useActivityForm();

  const handleSubmit = async () => {
    if (!isFormValid() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const fields = formConfig[type].fields;
      const totalDuration = parseInt(hours) * 60 + parseInt(minutes);
      
      const activityData: Partial<Activity> = {
        title,
        type,
        source: 'manual',
        duration: totalDuration,
        date: activityDate.toISOString(),
      };

      if (fields.includes("distance") && distance) {
        activityData.distance = parseFloat(distance);
      }

      if (fields.includes("elevationGain") && elevation) {
        activityData.elevationGain = parseInt(elevation, 10);
      }

      if (fields.includes("exercises")) {
        activityData.exercises = exercises
          .filter((ex) => ex.name.trim())
          .map((ex) => ({
            name: ex.name,
            sets: ex.sets ? parseInt(ex.sets, 10) : undefined,
            reps: ex.reps ? parseInt(ex.reps, 10) : undefined,
            weight: ex.weight ? parseFloat(ex.weight) : undefined,
          }));
      }

      await addActivity(activityData as Omit<Activity, "id">);
      resetForm();
    } catch (error) {
      console.error("Failed to add activity:", error);
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  const renderDynamicFields = () => {
    const fields = formConfig[type].fields;
    
    return (
      <>
        {fields.includes("distance") && (
          <TextInput
            style={styles.input}
            placeholder="Distance (km)"
            placeholderTextColor="#888"
            value={distance}
            onChangeText={setDistance}
            keyboardType="numeric"
          />
        )}
        
        {fields.includes("elevationGain") && (
          <TextInput
            style={styles.input}
            placeholder="Dénivelé (m)"
            placeholderTextColor="#888"
            value={elevation}
            onChangeText={setElevation}
            keyboardType="numeric"
          />
        )}
        
        {fields.includes("exercises") && (
          <ExerciseList
            exercises={exercises}
            onExerciseChange={updateExercise}
            onAddExercise={addExercise}
            onRemoveExercise={removeExercise}
          />
        )}
      </>
    );
  };

  return (
    <ScrollView 
      style={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <TextInput
        style={styles.input}
        placeholder="Titre de l'activité"
        placeholderTextColor="#888"
        value={title}
        onChangeText={setTitle}
      />

      <DateTimeSelector
        value={activityDate}
        onDateChange={updateActivityDate}
        onTimeChange={updateActivityTime}
      />

      {/* ⭐ NOUVEAU : Sélecteur de type custom */}
      <View style={styles.typeSelector}>
        <Text style={styles.typeSelectorLabel}>Type d’activité</Text>
        <View style={styles.typesGrid}>
          {Object.entries(activityConfig).map(([key, config]) => (
            (() => {
              const IconComponent = config.iconFamily === 'MaterialCommunityIcons'
                ? MaterialCommunityIcons
                : Ionicons;
              const isSelected = type === key;

              return (
            <TouchableOpacity
              key={key}
              style={[
                styles.typeButton,
                isSelected && styles.typeButtonSelected
              ]}
              onPress={() => setType(key as any)}
            >
              <IconComponent
                name={config.icon as any}
                size={24}
                color={isSelected ? theme.colors.users.primary : theme.colors.text.muted}
              />
              <Text style={[
                styles.typeButtonText,
                isSelected && styles.typeButtonTextSelected
              ]}>
                {config.label}
              </Text>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.users.primary} />
              )}
            </TouchableOpacity>
              );
            })()
          ))}
        </View>
      </View>

      {/* Sélecteurs d'heures et minutes */}
      <View style={styles.durationContainer}>
        <Text style={styles.durationLabel}>Durée</Text>
        <View style={styles.durationPickers}>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={hours}
              onValueChange={setHours}
              style={styles.durationPicker}
              itemStyle={styles.pickerItem}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <Picker.Item key={i} label={`${i}h`} value={i.toString()} />
              ))}
            </Picker>
          </View>
          
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={minutes}
              onValueChange={setMinutes}
              style={styles.durationPicker}
              itemStyle={styles.pickerItem}
            >
              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                <Picker.Item key={m} label={`${m}min`} value={m.toString()} />
              ))}
            </Picker>
          </View>
        </View>
        
        {(parseInt(hours) > 0 || parseInt(minutes) > 0) && (
          <Text style={styles.durationPreview}>
            Total : {activityFormatters.formatDuration(parseInt(hours) * 60 + parseInt(minutes))}
          </Text>
        )}
      </View>

      {renderDynamicFields()}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.buttonContainer, styles.cancelButton]}
          onPress={onClose}
          disabled={isSubmitting}
        >
          <Text style={[styles.buttonText, styles.cancelButtonText]}>
            ANNULER
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.buttonContainer,
            isSubmitting && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting || !isFormValid()}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#111" />
          ) : (
            <Text style={styles.buttonText}>AJOUTER</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
    paddingBottom: 20,
  },
  input: {
    height: 50,
    backgroundColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 16,
    color: "#fff",
    marginBottom: 16,
    fontSize: 16,
  },
  
  // ⭐ NOUVEAUX STYLES : Sélecteur de type
  typeSelector: {
    marginBottom: 16,
  },
  typeSelectorLabel: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 12,
  },
  typesGrid: {
    gap: 10,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#333',
    padding: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#333',
  },
  typeButtonSelected: {
    borderColor: '#ffd700',
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
  },
  typeButtonText: {
    flex: 1,
    color: '#888',
    fontSize: 15,
  },
  typeButtonTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  
  // Styles existants
  durationContainer: {
    marginBottom: 16,
  },
  durationLabel: {
    color: "#aaa",
    fontSize: 14,
    marginBottom: 8,
  },
  durationPickers: {
    flexDirection: "row",
    gap: 12,
  },
  pickerWrapper: {
    flex: 1,
    backgroundColor: "#333",
    borderRadius: 8,
    overflow: "hidden",
  },
  durationPicker: {
    color: "#fff",
    backgroundColor: "#333",
  },
  pickerItem: {
    color: "#fff",
    backgroundColor: "#333",
  },
  durationPreview: {
    color: "#ffd700",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  buttonContainer: {
    backgroundColor: "#ffd700",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    flex: 1,
  },
  cancelButton: {
    backgroundColor: "#333",
    marginRight: 10,
  },
  buttonDisabled: {
    backgroundColor: '#a5a5a5',
  },
  buttonText: {
    color: "#111",
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelButtonText: {
    color: "#fff",
  },
});