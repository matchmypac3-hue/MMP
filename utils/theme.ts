// utils/theme.ts

export const theme = {
    colors: {
      // Backgrounds
      bg: {
        // Deep navy base (closer to screenshot)
        primary: '#0b0e16',
        card: '#12182a',
        cardSecondary: '#0f1424',
        elevated: '#141b30',
        sunken: '#0c111f',
        input: '#171f33',
      },
      
      // Users (préparé pour équipe)
      users: {
        // Action color (cyan désaturé, mat)
        primary: '#7ED6CF',
        secondary: '#FF8A80',  // Corail (user 2 / futur coéquipier)
        victory: '#BA76D9',    // Violet (victoire)
      },

      // Explicit chromatic roles
      accent: {
        // CTA / interactions
        action: '#7ED6CF',
        // Progress / intermediate states (darker, colder, no glow)
        progress: '#4B7B76',
        // Rare exception highlight (100%, decision moment) — use sparingly
        exception: '#A6FFF6',
      },

      rewards: {
        // Diamonds: cooler + lighter, more mineral than UI accent
        diamond: '#B7FFF7',
      },
      
      // UI
      text: {
        primary: '#ffffff',
        high: '#f5f7fb',
        secondary: '#B0B0B0',
        tertiary: '#999999',
        label: '#c6d1e6',
        muted: '#666666',
      },
      
      // Status
      success: '#4caf50',
      error: '#FF6B6B',
      warning: '#ffd700',
      
      // Borders
      border: 'rgba(255, 255, 255, 0.15)',
      borderLight: 'rgba(255, 255, 255, 0.12)',
      borderSubtle: 'rgba(255, 255, 255, 0.06)',
    },
    
    gradients: {
      // Neutralized dark background (less saturated)
      background: ['#0b0e16', '#0f1424', '#0c111f'] as const,
      card: ['#12182a', '#0f1424'] as const,

      // Default CTA gradient (mat, désaturé). Keep subtle, no flashy duo color-mix.
      countdown: ['#7ED6CF', '#68C9C0'] as const,

      // Progress gradient (cold, darker) — used for non-completed progress fills.
      progress: ['#4B7B76', '#3E6662'] as const,

      // Neutral "no color" gradient (renders as plain text)
      neutral: ['#f5f7fb', '#f5f7fb'] as const,

      // Rare exception highlight
      exception: ['#A6FFF6', '#7EE9DE'] as const,
      victory: ['#BA76D9', '#9B6FD9'] as const,
    },
    
    shadows: {
      small: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
      medium: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
      },
      large: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
      },
    },
  };
  
  export type Theme = typeof theme;