'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Package, FileText, MessageSquare, FolderTree, Loader2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface Stats {
  groups: number
  products: number
  documents: number
  conversations: number
}

interface RecentDocument {
  id: string
  filename: string
  processing_status: string
  products: { name: string } | null
}

export default function AdminDashboard() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch stats
        const [groupsRes, productsRes, documentsRes] = await Promise.all([
          fetch('/api/groups'),
          fetch('/api/products'),
          fetch('/api/documents'),
        ])

        const [groupsData, productsData, documentsData] = await Promise.all([
          groupsRes.json(),
          productsRes.json(),
          documentsRes.json(),
        ])

        setStats({
          groups: groupsData.groups?.length || 0,
          products: productsData.products?.length || 0,
          documents: documentsData.documents?.length || 0,
          conversations: 0, // Conversations count would need a dedicated endpoint
        })

        // Get recent documents (last 5)
        const docs = documentsData.documents || []
        setRecentDocuments(docs.slice(0, 5))
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return t('admin.status.completed')
      case 'processing':
        return t('admin.status.processing')
      case 'failed':
        return t('admin.status.failed')
      default:
        return status
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  const statItems = [
    {
      label: t('admin.groups'),
      value: stats?.groups || 0,
      icon: FolderTree,
      color: 'bg-indigo-500',
    },
    {
      label: t('admin.products'),
      value: stats?.products || 0,
      icon: Package,
      color: 'bg-blue-500',
    },
    {
      label: t('admin.documents'),
      value: stats?.documents || 0,
      icon: FileText,
      color: 'bg-green-500',
    },
    {
      label: t('admin.conversations'),
      value: stats?.conversations || 0,
      icon: MessageSquare,
      color: 'bg-purple-500',
    },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{t('admin.dashboard')}</h1>
        <p className="text-slate-500">{t('admin.dashboardSubtitle')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statItems.map((stat) => (
          <Card key={stat.label}>
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
        ))}
      </div>

      {/* Recent Documents */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900">
            {t('admin.recentDocuments')}
          </h2>
        </CardHeader>
        <CardContent>
          {recentDocuments.length > 0 ? (
            <div className="space-y-3">
              {recentDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <div>
                    <p className="font-medium text-slate-900">{doc.filename}</p>
                    <p className="text-sm text-slate-500">
                      {doc.products?.name}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      doc.processing_status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : doc.processing_status === 'processing'
                          ? 'bg-yellow-100 text-yellow-700'
                          : doc.processing_status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {getStatusText(doc.processing_status)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-4">
              {t('admin.noDocumentsYet')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
