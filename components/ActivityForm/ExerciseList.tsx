import React from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Exercise } from '../../hooks/useActivityForm';
import { theme } from '../../utils/theme';

interface ExerciseListProps {
  exercises: Exercise[];
  onExerciseChange: (index: number, field: keyof Exercise, value: string) => void;
  onAddExercise: () => void;
  onRemoveExercise: (index: number) => void;
}

/**
 * Composant pour gérer une liste d'exercices (pour le type "workout")
 * Permet d'ajouter, modifier et supprimer des exercices
 */
export const ExerciseList: React.FC<ExerciseListProps> = ({
  exercises,
  onExerciseChange,
  onAddExercise,
  onRemoveExercise,
}) => {
  return (
    <View>
      <Text style={styles.subHeader}>Exercices</Text>
      {exercises.map((exercise, index) => (
        <View key={index} style={styles.exerciseContainer}>
          <TextInput
            style={styles.input}
            placeholder={`Exercice ${index + 1}`}
            placeholderTextColor={theme.colors.text.muted}
            value={exercise.name}
            onChangeText={(value) => onExerciseChange(index, "name", value)}
          />
          <View style={styles.exerciseRow}>
            <TextInput
              style={[styles.input, styles.exerciseInput]}
              placeholder="Séries"
              placeholderTextColor={theme.colors.text.muted}
              value={exercise.sets}
              onChangeText={(value) => onExerciseChange(index, "sets", value)}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, styles.exerciseInput]}
              placeholder="Rép."
              placeholderTextColor={theme.colors.text.muted}
              value={exercise.reps}
              onChangeText={(value) => onExerciseChange(index, "reps", value)}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, styles.exerciseInput]}
              placeholder="Poids (kg)"
              placeholderTextColor={theme.colors.text.muted}
              value={exercise.weight}
              onChangeText={(value) => onExerciseChange(index, "weight", value)}
              keyboardType="numeric"
            />
          </View>
          {exercises.length > 1 && (
            <TouchableOpacity 
              onPress={() => onRemoveExercise(index)} 
              style={styles.removeButton}
            >
              <Text style={styles.removeButtonText}>Supprimer</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <TouchableOpacity onPress={onAddExercise} style={styles.addButton}>
        <Text style={styles.addButtonText}>Ajouter un exercice</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  subHeader: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.colors.text.high,
    marginBottom: 10,
  },
  exerciseContainer: {
    marginBottom: 15,
  },
  input: {
    height: 50,
    backgroundColor: theme.colors.bg.input,
    borderRadius: 8,
    paddingHorizontal: 16,
    color: theme.colors.text.high,
    marginBottom: 16,
    fontSize: 16,
  },
  exerciseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  exerciseInput: {
    flex: 1,
    marginRight: 5,
  },
  removeButton: {
    marginTop: 5,
  },
  removeButtonText: {
    color: theme.colors.error,
    textAlign: "right",
  },
  addButton: {
    backgroundColor: theme.colors.bg.elevated,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
  },
  addButtonText: {
    color: theme.colors.text.high,
    fontSize: 16,
  },
});