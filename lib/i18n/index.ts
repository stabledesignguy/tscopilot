import en from './translations/en.json'
import fr from './translations/fr.json'
import it from './translations/it.json'
import de from './translations/de.json'
import type { Language } from './languages'

export const translations: Record<Language, typeof en> = {
  en,
  fr,
  it,
  de,
}

export type TranslationKeys = typeof en
export type { Language }
export { languages, defaultLanguage, LANGUAGE_STORAGE_KEY } from './languages'
