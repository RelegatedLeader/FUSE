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
  button: ViewStyle;
  buttonTextStyle: TextStyle;
}

const lightTheme: Theme = {
  backgroundColor: '#F5F5DC', // Cute vanilla
  textColor: '#000000',
  buttonBackground: '#D2B48C', // Tan
  buttonText: '#000000',
  container: {
    flex: 1,
    backgroundColor: '#F5F5DC',
    padding: 20,
  },
  title: {
    fontSize: 24,
    color: '#000000',
    marginBottom: 20,
  },
  button: {
    padding: 15,
    backgroundColor: '#D2B48C',
    borderRadius: 5,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonTextStyle: {
    color: '#000000',
    fontSize: 16,
  },
};

const darkTheme: Theme = {
  backgroundColor: '#2C2C2C', // Cool gray
  textColor: '#FFFFFF',
  buttonBackground: '#555555',
  buttonText: '#FFFFFF',
  container: {
    flex: 1,
    backgroundColor: '#2C2C2C',
    padding: 20,
  },
  title: {
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 20,
  },
  button: {
    padding: 15,
    backgroundColor: '#555555',
    borderRadius: 5,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonTextStyle: {
    color: '#FFFFFF',
    fontSize: 16,
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