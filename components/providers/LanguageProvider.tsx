'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import {
  type Language,
  defaultLanguage,
  LANGUAGE_STORAGE_KEY,
} from '@/lib/i18n/languages'

interface LanguageContextType {
  language: Language
  setLanguage: (language: Language) => void
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage)
  const [isInitialized, setIsInitialized] = useState(false)

  // Load saved language preference on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language
    if (savedLanguage && ['en', 'fr', 'it', 'de'].includes(savedLanguage)) {
      setLanguageState(savedLanguage)
      document.documentElement.lang = savedLanguage
    }
    setIsInitialized(true)
  }, [])

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, newLanguage)
    document.documentElement.lang = newLanguage
  }

  // Prevent flash of default language
  if (!isInitialized) {
    return null
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
