'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Settings, LogOut } from 'lucide-react'
import { LanguageSwitcher } from '@/components/providers/LanguageSwitcher'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface MainHeaderProps {
  email: string
  isAdmin: boolean
  signOutAction: () => Promise<void>
}

export function MainHeader({ email, isAdmin, signOutAction }: MainHeaderProps) {
  const { t } = useTranslation()

  return (
    <header className="bg-white border-b border-secondary-200 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between flex-shrink-0 z-10">
      <div className="flex items-center gap-2 sm:gap-3">
        <Image
          src="/logo.png"
          alt="TScopilot"
          width={160}
          height={40}
          className="h-6 sm:h-8 w-auto"
          priority
        />
      </div>

      <div className="flex items-center gap-1 sm:gap-4">
        <span className="hidden md:block text-sm text-secondary-500">{email}</span>
        <LanguageSwitcher />
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-sm text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">{t('nav.admin')}</span>
          </Link>
        )}
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-sm text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">{t('nav.signOut')}</span>
          </button>
        </form>
      </div>
    </header>
  )
}
