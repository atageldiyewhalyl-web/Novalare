import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'professional-light' | 'premium-dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Load theme from localStorage or default to professional-light
    const saved = localStorage.getItem('novalare-theme') as Theme;
    return saved || 'professional-light';
  });

  useEffect(() => {
    // Save theme to localStorage whenever it changes
    localStorage.setItem('novalare-theme', theme);
    
    // Apply theme class to document root
    document.documentElement.classList.remove('professional-light', 'premium-dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState(current => 
      current === 'professional-light' ? 'premium-dark' : 'professional-light'
    );
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
