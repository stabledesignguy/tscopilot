import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Package, FileText, MessageSquare, Users } from 'lucide-react'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // Fetch statistics
  const [productsResult, documentsResult, conversationsResult] =
    await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('documents').select('id', { count: 'exact', head: true }),
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true }),
    ])

  const stats = [
    {
      label: 'Products',
      value: productsResult.count || 0,
      icon: Package,
      color: 'bg-blue-500',
    },
    {
      label: 'Documents',
      value: documentsResult.count || 0,
      icon: FileText,
      color: 'bg-green-500',
    },
    {
      label: 'Conversations',
      value: conversationsResult.count || 0,
      icon: MessageSquare,
      color: 'bg-purple-500',
    },
  ]

  // Fetch recent documents
  const { data: recentDocuments } = await supabase
    .from('documents')
    .select('*, products(name)')
    .order('created_at', { ascending: false })
    .limit(5) as { data: Array<{ id: string; filename: string; processing_status: string; products: { name: string } | null }> | null }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Overview of your application</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => (
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
            Recent Documents
          </h2>
        </CardHeader>
        <CardContent>
          {recentDocuments && recentDocuments.length > 0 ? (
            <div className="space-y-3">
              {recentDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <div>
                    <p className="font-medium text-slate-900">{doc.filename}</p>
                    <p className="text-sm text-slate-500">
                      {(doc.products as any)?.name}
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
                    {doc.processing_status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-4">
              No documents uploaded yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
