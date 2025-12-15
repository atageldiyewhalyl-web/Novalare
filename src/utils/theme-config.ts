// Theme configuration for dashboard styles
export const themes = {
  'professional-light': {
    name: 'Professional Light',
    description: 'Clean, corporate SaaS style',
    
    // Background colors
    bg: {
      primary: 'bg-white',
      secondary: 'bg-gray-50',
      tertiary: 'bg-gray-100',
      overlay: 'bg-white/95',
    },
    
    // Text colors
    text: {
      primary: 'text-gray-900',
      secondary: 'text-gray-600',
      tertiary: 'text-gray-500',
      muted: 'text-gray-400',
    },
    
    // Border colors
    border: {
      primary: 'border-gray-200',
      secondary: 'border-gray-100',
      hover: 'border-gray-300',
    },
    
    // Card styles
    card: {
      base: 'bg-white border border-gray-200 rounded-lg shadow-sm',
      hover: 'hover:bg-gray-50 hover:shadow-md',
      gradient: false,
    },
    
    // Button styles
    button: {
      primary: 'bg-blue-600 hover:bg-blue-700 text-white',
      secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-900',
      gradient: false,
      glow: false,
    },
    
    // Metric card styles
    metric: {
      icon: 'text-gray-400',
      value: 'text-gray-900',
      label: 'text-gray-600',
    },
    
    // Navigation
    nav: {
      bg: 'bg-white border-r border-gray-200',
      item: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      itemActive: 'bg-blue-50 text-blue-600',
    },
  },
  
  'premium-dark': {
    name: 'Premium Dark',
    description: 'Modern, vibrant landing page style',
    
    // Background colors
    bg: {
      primary: 'bg-black',
      secondary: 'bg-gray-950',
      tertiary: 'bg-gray-900',
      overlay: 'bg-black/95',
    },
    
    // Text colors
    text: {
      primary: 'text-white',
      secondary: 'text-purple-200',
      tertiary: 'text-purple-300/80',
      muted: 'text-purple-400/60',
    },
    
    // Border colors
    border: {
      primary: 'border-purple-500/20',
      secondary: 'border-purple-500/10',
      hover: 'border-purple-500/40',
    },
    
    // Card styles
    card: {
      base: 'bg-gray-900/50 border border-purple-500/20 rounded-lg backdrop-blur-sm',
      hover: 'hover:bg-gray-900/70 hover:border-purple-500/40 hover:shadow-[0_20px_60px_rgba(139,92,246,0.3)]',
      gradient: true,
    },
    
    // Button styles
    button: {
      primary: 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 text-white shadow-[0_20px_60px_rgba(139,92,246,0.5)]',
      secondary: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 border border-purple-500/20',
      gradient: true,
      glow: true,
    },
    
    // Metric card styles
    metric: {
      icon: 'text-purple-400',
      value: 'text-white',
      label: 'text-purple-200',
    },
    
    // Navigation
    nav: {
      bg: 'bg-black border-r border-purple-500/20',
      item: 'text-purple-200 hover:bg-purple-500/10 hover:text-white',
      itemActive: 'bg-gradient-to-r from-purple-600/20 to-pink-500/20 text-white border-l-2 border-purple-500',
    },
  },
} as const;

export type ThemeKey = keyof typeof themes;

// Helper function to get theme classes
export function getThemeClasses(themeKey: ThemeKey) {
  return themes[themeKey];
}

// Helper to apply conditional theme classes
export function tw(professionalLight: string, premiumDark: string, currentTheme: ThemeKey) {
  return currentTheme === 'professional-light' ? professionalLight : premiumDark;
}
