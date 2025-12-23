/**
 * Helpers pour la gestion des dates
 */

export const dateHelpers = {
    /**
     * Vérifie si une date est dans le futur
     */
    isFutureDate: (date: Date): boolean => {
      return date > new Date();
    },
  
    /**
     * Limite une date au maximum à maintenant
     */
    capToNow: (date: Date): Date => {
      const now = new Date();
      return date > now ? now : date;
    },
  
    /**
     * Formate une date pour input HTML (YYYY-MM-DD)
     */
    formatForDateInput: (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },
  
    /**
     * Formate une heure pour input HTML (HH:MM)
     */
    formatForTimeInput: (date: Date): string => {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    },
  
    /**
     * Obtient la date max pour input (aujourd'hui)
     */
    getTodayMax: (): string => {
      return dateHelpers.formatForDateInput(new Date());
    },
  
    /**
     * Parse une date depuis input HTML
     */
    parseDateInput: (dateString: string, currentDate: Date): Date => {
      const [year, month, day] = dateString.split('-').map(Number);
      const newDate = new Date(currentDate);
      newDate.setFullYear(year);
      newDate.setMonth(month - 1);
      newDate.setDate(day);
      return dateHelpers.capToNow(newDate);
    },
  
    /**
     * Parse une heure depuis input HTML
     */
    parseTimeInput: (timeString: string, currentDate: Date): Date => {
      const [hours, minutes] = timeString.split(':').map(Number);
      const newDate = new Date(currentDate);
      newDate.setHours(hours);
      newDate.setMinutes(minutes);
      return dateHelpers.capToNow(newDate);
    },
  
    /**
     * Formate pour affichage utilisateur
     */
    formatForDisplay: {
      date: (date: Date): string => date.toLocaleDateString('fr-FR'),
      time: (date: Date): string => date.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
    },
  };