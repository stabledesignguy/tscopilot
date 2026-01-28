'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Building2, Users, Shield, Activity, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Stats {
  organizations: number
  totalUsers: number
  superAdmins: number
  activeOrgs: number
}

interface RecentOrg {
  id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
  _count?: {
    members: number
  }
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentOrgs, setRecentOrgs] = useState<RecentOrg[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/super-admin/stats')
        if (response.ok) {
          const data = await response.json()
          setStats(data.stats)
          setRecentOrgs(data.recentOrganizations || [])
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    )
  }

  const statItems = [
    {
      label: 'Organizations',
      value: stats?.organizations || 0,
      icon: Building2,
      color: 'bg-blue-500',
      href: '/super-admin/organizations',
    },
    {
      label: 'Total Users',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'bg-green-500',
      href: '/super-admin/users',
    },
    {
      label: 'Super Admins',
      value: stats?.superAdmins || 0,
      icon: Shield,
      color: 'bg-purple-500',
      href: '/super-admin/admins',
    },
    {
      label: 'Active Orgs',
      value: stats?.activeOrgs || 0,
      icon: Activity,
      color: 'bg-amber-500',
      href: '/super-admin/organizations',
    },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Super Admin Dashboard</h1>
        <p className="text-slate-500">Platform-wide overview and management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statItems.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4 py-6">
                <div className={`p-3 rounded-xl ${stat.color}`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  <p className="text-sm text-slate-500">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Organizations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Organizations
          </h2>
          <Link
            href="/super-admin/organizations"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {recentOrgs.length > 0 ? (
            <div className="space-y-3">
              {recentOrgs.map((org) => (
                <Link
                  key={org.id}
                  href={`/super-admin/organizations/${org.id}`}
                  className="flex items-center justify-between py-3 px-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{org.name}</p>
                      <p className="text-sm text-slate-500">/{org.slug}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      org.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {org.is_active ? 'Active' : 'Inactive'}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No organizations yet</p>
              <Link
                href="/super-admin/organizations"
                className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block"
              >
                Create first organization
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
