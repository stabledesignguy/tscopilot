'use client'

import { useState, useEffect } from 'react'
import {
  FileText,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DocumentUploader } from '@/components/admin/DocumentUploader'
import { formatFileSize, formatDate } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { Product, Document } from '@/types'

export default function DocumentsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const { t } = useTranslation()

  const fetchProducts = async () => {
    const response = await fetch('/api/products')
    const data = await response.json()
    setProducts(data.products || [])
    if (data.products?.length > 0 && !selectedProductId) {
      setSelectedProductId(data.products[0].id)
    }
  }

  const fetchDocuments = async () => {
    if (!selectedProductId) return
    const response = await fetch(
      `/api/documents?productId=${selectedProductId}`
    )
    const data = await response.json()
    setDocuments(data.documents || [])
  }

  useEffect(() => {
    fetchProducts().finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (selectedProductId) {
      fetchDocuments()
    }
  }, [selectedProductId])

  const handleDelete = async (id: string) => {
    if (!confirm(t('documents.deleteConfirm'))) return

    const response = await fetch(`/api/documents?id=${id}`, {
      method: 'DELETE',
    })

    if (response.ok) {
      await fetchDocuments()
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'processing':
        return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-slate-400" />
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{t('documents.title')}</h1>
        <p className="text-slate-500">{t('documents.subtitle')}</p>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              {t('documents.noProductsAvailable')}
            </h3>
            <p className="text-slate-500">
              {t('documents.createProductFirst')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-900">
                  {t('documents.uploadDocuments')}
                </h2>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {t('documents.selectProduct')}
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedProductId && (
                  <DocumentUploader
                    productId={selectedProductId}
                    onUploadComplete={fetchDocuments}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Documents List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-slate-900">
                  {t('documents.uploadedDocuments')}
                </h2>
              </CardHeader>
              <CardContent>
                {documents.length > 0 ? (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg"
                      >
                        <FileText className="w-8 h-8 text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            {doc.filename}
                          </p>
                          <p className="text-sm text-slate-500">
                            {formatFileSize(doc.file_size)} &middot;{' '}
                            {formatDate(doc.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            {getStatusIcon(doc.processing_status)}
                            <span className="text-sm text-slate-600 capitalize">
                              {doc.processing_status}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(doc.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500">
                      {t('documents.noDocumentsYet')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
