'use client'

import { useLanguage } from '@/components/providers/LanguageProvider'
import { translations } from './index'

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`
}[keyof ObjectType & (string | number)]

type TranslationKey = NestedKeyOf<typeof translations.en>

function getNestedValue(obj: Record<string, any>, path: string): string {
  const keys = path.split('.')
  let current = obj

  for (const key of keys) {
    if (current === undefined || current === null) {
      return path // Return the key as fallback
    }
    current = current[key]
  }

  return typeof current === 'string' ? current : path
}

function interpolate(
  template: string,
  replacements?: Record<string, string | number>
): string {
  if (!replacements) return template

  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return replacements[key]?.toString() ?? `{${key}}`
  })
}

export function useTranslation() {
  const { language } = useLanguage()

  const t = (
    key: TranslationKey,
    replacements?: Record<string, string | number>
  ): string => {
    const translationSet = translations[language] || translations.en
    const value = getNestedValue(translationSet, key)
    return interpolate(value, replacements)
  }

  return { t, language }
}
