'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { Product, Group } from '@/types'

interface ProductFormProps {
  product?: Product
  onSubmit: (data: {
    name: string
    description: string
    image_url: string
    group_id: string | null
  }) => Promise<void>
  onCancel: () => void
}

export function ProductForm({ product, onSubmit, onCancel }: ProductFormProps) {
  const [name, setName] = useState(product?.name || '')
  const [description, setDescription] = useState(product?.description || '')
  const [imageUrl, setImageUrl] = useState(product?.image_url || '')
  const [groupId, setGroupId] = useState<string>(product?.group_id || '')
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { t } = useTranslation()

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await fetch('/api/groups')
        const data = await response.json()
        setGroups(data.groups || [])
      } catch (error) {
        console.error('Failed to fetch groups:', error)
      }
    }
    fetchGroups()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('products.nameRequired'))
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        image_url: imageUrl.trim(),
        group_id: groupId || null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('products.saveFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="name"
        label={t('products.productName')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('products.productNamePlaceholder')}
        required
      />

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          {t('products.description')}
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('products.descriptionPlaceholder')}
          rows={3}
          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
        />
      </div>

      <div>
        <label
          htmlFor="group"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          {t('products.group')}
        </label>
        <select
          id="group"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white"
        >
          <option value="">{t('products.noGroup')}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>

      <Input
        id="imageUrl"
        label={t('products.imageUrl')}
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        placeholder={t('products.imageUrlPlaceholder')}
        type="url"
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {product ? t('products.updateProduct') : t('products.createProduct')}
        </Button>
      </div>
    </form>
  )
}
