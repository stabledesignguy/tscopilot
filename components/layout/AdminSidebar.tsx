'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  FileText,
  FolderTree,
  ArrowLeft,
  Settings,
  Users,
  Bot,
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { LanguageSwitcher } from '@/components/providers/LanguageSwitcher'

export function AdminSidebar() {
  const { t } = useTranslation()
  const pathname = usePathname()

  const navItems = [
    { href: '/admin', icon: LayoutDashboard, labelKey: 'admin.dashboard' as const },
    { href: '/admin/users', icon: Users, label: 'Users' },
    { href: '/admin/settings', icon: Bot, label: 'LLM Settings' },
    { href: '/admin/instructions', icon: Settings, labelKey: 'admin.systemInstructions' as const },
    { href: '/admin/groups', icon: FolderTree, labelKey: 'admin.groups' as const },
    { href: '/admin/products', icon: Package, labelKey: 'admin.products' as const },
    { href: '/admin/documents', icon: FileText, labelKey: 'admin.documents' as const },
  ]

  return (
    <aside className="w-64 bg-white border-r border-secondary-200 flex flex-col relative z-20">
      <div className="p-6 border-b border-secondary-200">
        <Image
          src="/logo.png"
          alt="TScopilot"
          width={140}
          height={35}
          className="h-7 w-auto mb-3"
          priority
        />
        <h2 className="text-lg font-bold text-secondary-700">{t('admin.panelTitle')}</h2>
        <p className="text-sm text-secondary-400">{t('admin.panelSubtitle')}</p>
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
                      ? 'bg-primary-50 text-primary-600 font-medium'
                      : 'text-secondary-600 hover:bg-secondary-100'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {'labelKey' in item && item.labelKey ? t(item.labelKey) : item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-secondary-200 space-y-3">
        <div className="flex items-center justify-between px-3">
          <LanguageSwitcher direction="up" />
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 text-sm text-secondary-600 rounded-lg hover:bg-secondary-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('nav.backToApp')}
        </Link>
      </div>
    </aside>
  )
}
