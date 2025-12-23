import { useState } from 'react';
import { Activity } from '../types/Activity';
import { ActivityTypeKey } from '../utils/activityConfig';
import { dateHelpers } from '../utils/dateHelpers';

export interface Exercise {
  name: string;
  sets?: string;
  reps?: string;
  weight?: string;
}

/**
 * Hook personnalisé pour gérer l'état et la logique du formulaire d'activité
 * Sépare la logique métier de la présentation
 */
export const useActivityForm = () => {
  // États de base
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [type, setType] = useState<ActivityTypeKey>("running");
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("0");
  const [distance, setDistance] = useState("");
  const [elevation, setElevation] = useState("");
  const [activityDate, setActivityDate] = useState(new Date());
  
  // État pour les exercices (workout)
  const [exercises, setExercises] = useState<Exercise[]>([
    { name: "", sets: "", reps: "", weight: "" },
  ]);

  /**
   * Met à jour la date en s'assurant qu'elle n'est pas dans le futur
   */
  const updateActivityDate = (newDate: Date) => {
    setActivityDate(dateHelpers.capToNow(newDate));
  };

  /**
   * Met à jour l'heure en s'assurant qu'elle n'est pas dans le futur
   */
  const updateActivityTime = (time: Date) => {
    const newDate = new Date(activityDate);
    newDate.setHours(time.getHours());
    newDate.setMinutes(time.getMinutes());
    setActivityDate(dateHelpers.capToNow(newDate));
  };

  /**
   * Ajoute un nouvel exercice vide à la liste
   */
  const addExercise = () => {
    setExercises([...exercises, { name: "", sets: "", reps: "", weight: "" }]);
  };

  /**
   * Supprime un exercice de la liste
   */
  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  /**
   * Met à jour un champ d'un exercice spécifique
   */
  const updateExercise = (index: number, field: keyof Exercise, value: string) => {
    const newExercises = [...exercises];
    newExercises[index][field] = value;
    setExercises(newExercises);
  };

  /**
   * Réinitialise tous les champs du formulaire
   */
  const resetForm = () => {
    setTitle("");
    setHours("0");
    setMinutes("0");
    setDistance("");
    setElevation("");
    setActivityDate(new Date());
    setExercises([{ name: "", sets: "", reps: "", weight: "" }]);
  };

  /**
   * Vérifie si le formulaire est valide pour soumission
   */
  const isFormValid = (): boolean => {
    const totalMinutes = parseInt(hours) * 60 + parseInt(minutes);
    return Boolean(title.trim() && totalMinutes > 0);
  };

  return {
    // État
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
    
    // Actions
    updateActivityDate,
    updateActivityTime,
    addExercise,
    removeExercise,
    updateExercise,
    resetForm,
    isFormValid,
  };
};