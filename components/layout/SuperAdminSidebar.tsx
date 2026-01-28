'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Users,
  Shield,
  ArrowLeft,
} from 'lucide-react'
import { LanguageSwitcher } from '@/components/providers/LanguageSwitcher'

export function SuperAdminSidebar() {
  const pathname = usePathname()

  const navItems = [
    { href: '/super-admin', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/super-admin/organizations', icon: Building2, label: 'Organizations' },
    { href: '/super-admin/users', icon: Users, label: 'All Users' },
    { href: '/super-admin/admins', icon: Shield, label: 'Super Admins' },
  ]

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col relative z-20">
      <div className="p-6 border-b border-slate-700">
        <Image
          src="/logo.png"
          alt="TScopilot"
          width={140}
          height={35}
          className="h-7 w-auto mb-3 brightness-0 invert"
          priority
        />
        <h2 className="text-lg font-bold text-white">Super Admin</h2>
        <p className="text-sm text-slate-400">Platform Management</p>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/super-admin' && pathname.startsWith(item.href))
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                    isActive
                      ? 'bg-slate-700 text-white font-medium'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-700 space-y-3">
        <div className="flex items-center justify-between px-3">
          <LanguageSwitcher direction="up" />
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to App
        </Link>
      </div>
    </aside>
  )
}
