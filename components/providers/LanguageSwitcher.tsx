'use client'

import { useState, useRef, useEffect } from 'react'
import { Globe, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { useLanguage } from './LanguageProvider'
import { languages, type Language } from '@/lib/i18n/languages'

interface LanguageSwitcherProps {
  direction?: 'up' | 'down'
}

export function LanguageSwitcher({ direction = 'down' }: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (code: Language) => {
    setLanguage(code)
    setIsOpen(false)
  }

  const ChevronIcon = direction === 'up' ? ChevronUp : ChevronDown
  const dropdownPosition = direction === 'up'
    ? 'bottom-full mb-1'
    : 'top-full mt-1'

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors"
        aria-label="Select language"
        type="button"
      >
        <Globe className="w-4 h-4" />
        <span className="uppercase font-medium">{language}</span>
        <ChevronIcon
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 sm:left-0 sm:right-auto ${dropdownPosition} py-2 w-40 bg-white rounded-lg shadow-lg border border-secondary-200 z-[100]`}
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-secondary-50 transition-colors flex items-center justify-between ${
                language === lang.code
                  ? 'text-primary-500 font-medium bg-primary-50'
                  : 'text-secondary-700'
              }`}
            >
              <span>{lang.nativeName}</span>
              {language === lang.code && (
                <Check className="w-4 h-4 text-primary-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
