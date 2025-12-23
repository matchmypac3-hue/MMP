import { useState, useEffect } from 'react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Hook pour calculer le temps restant jusqu'au prochain lundi 00:00
 */
export const useWeekCountdown = () => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const calculateTimeLeft = (): TimeLeft => {
    const now = new Date();
    const nextMonday = new Date(now);
    
    // Calculer le prochain lundi à 00:00
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7; // Si on est lundi, on va au lundi suivant
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);
    
    const difference = nextMonday.getTime() - now.getTime();
    
    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  };

  useEffect(() => {
    // Mise à jour immédiate
    setTimeLeft(calculateTimeLeft());

    // Mise à jour toutes les secondes
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return timeLeft;
};