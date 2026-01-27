'use client'

import Link from 'next/link'
import { MessageSquare, Settings, LogOut } from 'lucide-react'
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
    <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0 z-10">
      <div className="flex items-center gap-3">
        <div className="bg-primary-600 p-2 rounded-lg">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">TScopilot</h1>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-500">{email}</span>
        <LanguageSwitcher />
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            {t('nav.admin')}
          </Link>
        )}
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t('nav.signOut')}
          </button>
        </form>
      </div>
    </header>
  )
}
