'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  FileText,
  FolderTree,
  ArrowLeft,
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { LanguageSwitcher } from '@/components/providers/LanguageSwitcher'

export function AdminSidebar() {
  const { t } = useTranslation()
  const pathname = usePathname()

  const navItems = [
    { href: '/admin', icon: LayoutDashboard, labelKey: 'admin.dashboard' as const },
    { href: '/admin/groups', icon: FolderTree, labelKey: 'admin.groups' as const },
    { href: '/admin/products', icon: Package, labelKey: 'admin.products' as const },
    { href: '/admin/documents', icon: FileText, labelKey: 'admin.documents' as const },
  ]

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col relative z-20">
      <div className="p-6 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900">{t('admin.panelTitle')}</h1>
        <p className="text-sm text-slate-500">{t('admin.panelSubtitle')}</p>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {t(item.labelKey)}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-200 space-y-3">
        <div className="flex items-center justify-between px-3">
          <LanguageSwitcher direction="up" />
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('nav.backToApp')}
        </Link>
      </div>
    </aside>
  )
}
