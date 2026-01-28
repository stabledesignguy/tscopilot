'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Settings, LogOut, Shield } from 'lucide-react'
import { LanguageSwitcher } from '@/components/providers/LanguageSwitcher'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { OrgSwitcher } from '@/components/layout/OrgSwitcher'

interface MainHeaderProps {
  email: string
  isAdmin: boolean
  isSuperAdmin?: boolean
  signOutAction: () => Promise<void>
}

export function MainHeader({ email, isAdmin, isSuperAdmin, signOutAction }: MainHeaderProps) {
  const { t } = useTranslation()

  return (
    <header className="bg-white border-b border-secondary-200 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between flex-shrink-0 z-10">
      <div className="flex items-center gap-2 sm:gap-4">
        <Image
          src="/logo.png"
          alt="TScopilot"
          width={160}
          height={40}
          className="h-6 sm:h-8 w-auto"
          priority
        />
        <div className="hidden sm:block border-l border-secondary-200 h-6" />
        <div className="hidden sm:block">
          <OrgSwitcher />
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-4">
        <span className="hidden md:block text-sm text-secondary-500">{email}</span>
        <LanguageSwitcher />
        {isSuperAdmin && (
          <Link
            href="/super-admin"
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
          >
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Platform</span>
          </Link>
        )}
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
