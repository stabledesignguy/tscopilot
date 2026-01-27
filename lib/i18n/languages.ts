export type Language = 'en' | 'fr' | 'it' | 'de'

export interface LanguageConfig {
  code: Language
  name: string
  nativeName: string
}

export const languages: LanguageConfig[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
]

export const defaultLanguage: Language = 'en'

export const LANGUAGE_STORAGE_KEY = 'tscopilot-language'
