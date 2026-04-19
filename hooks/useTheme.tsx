import React, { createContext, useContext, useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { DarkColors, LightColors, ColorPalette } from '../constants/colors'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: ThemeMode
  isDark: boolean
  colors: ColorPalette
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = 'loqit_user_theme'

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme()
  const [theme, setThemeState] = useState<ThemeMode>('light') // Forced default to Light

  useEffect(() => {
    // Load theme from storage on start
    const loadTheme = async () => {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY)
      if (savedTheme) {
        setThemeState(savedTheme as ThemeMode)
      }
    }
    loadTheme()
  }, [])

  const setTheme = async (newTheme: ThemeMode) => {
    setThemeState(newTheme)
    await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme)
  }

  const activeTheme = theme === 'system' ? systemColorScheme ?? 'dark' : theme
  const isDark = activeTheme === 'dark'
  const colors = isDark ? DarkColors : LightColors

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
