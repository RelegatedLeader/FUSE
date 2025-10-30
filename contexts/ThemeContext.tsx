import React, { createContext, useContext, useState, useEffect } from 'react';
import { ViewStyle, TextStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeType = 'light' | 'dark';

interface Theme {
  backgroundColor: string;
  textColor: string;
  buttonBackground: string;
  buttonText: string;
  container: ViewStyle;
  title: TextStyle;
  subtitle: TextStyle;
  button: ViewStyle;
  buttonTextStyle: TextStyle;
  card: ViewStyle;
  input: ViewStyle;
}

const lightTheme: Theme = {
  backgroundColor: '#bfcafd', // Light blue theme
  textColor: '#1b1a36',
  buttonBackground: '#8b9dc3',
  buttonText: '#ffffff',
  container: {
    flex: 1,
    backgroundColor: '#bfcafd',
    padding: 20,
  },
  title: {
    fontSize: 32,
    color: '#1b1a36',
    marginBottom: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'System', // Will use default but can be customized
  },
  subtitle: {
    fontSize: 18,
    color: '#1b1a36',
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.8,
  },
  button: {
    padding: 15,
    backgroundColor: '#8b9dc3',
    borderRadius: 25,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#1b1a36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonTextStyle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#1b1a36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#8b9dc3',
    fontSize: 16,
    color: '#1b1a36',
  },
};

const darkTheme: Theme = {
  backgroundColor: '#1b1a36', // Dark blue/purple theme
  textColor: '#bfcafd',
  buttonBackground: '#3d4a6b',
  buttonText: '#bfcafd',
  container: {
    flex: 1,
    backgroundColor: '#1b1a36',
    padding: 20,
  },
  title: {
    fontSize: 32,
    color: '#bfcafd',
    marginBottom: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 18,
    color: '#bfcafd',
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.8,
  },
  button: {
    padding: 15,
    backgroundColor: '#3d4a6b',
    borderRadius: 25,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#bfcafd',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonTextStyle: {
    color: '#bfcafd',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#2a2847',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#bfcafd',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  input: {
    backgroundColor: '#2a2847',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#3d4a6b',
    fontSize: 16,
    color: '#bfcafd',
  },
};

interface ThemeContextType {
  theme: Theme;
  themeType: ThemeType;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeType, setThemeType] = useState<ThemeType>('light');

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme');
        if (savedTheme === 'dark' || savedTheme === 'light') {
          setThemeType(savedTheme);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const newTheme = themeType === 'light' ? 'dark' : 'light';
    setThemeType(newTheme);
    try {
      await AsyncStorage.setItem('theme', newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const theme = themeType === 'light' ? lightTheme : darkTheme;

  return (
    <ThemeContext.Provider value={{ theme, themeType, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};