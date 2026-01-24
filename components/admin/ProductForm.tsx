'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Product } from '@/types'

interface ProductFormProps {
  product?: Product
  onSubmit: (data: { name: string; description: string; image_url: string }) => Promise<void>
  onCancel: () => void
}

export function ProductForm({ product, onSubmit, onCancel }: ProductFormProps) {
  const [name, setName] = useState(product?.name || '')
  const [description, setDescription] = useState(product?.description || '')
  const [imageUrl, setImageUrl] = useState(product?.image_url || '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Product name is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        image_url: imageUrl.trim(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="name"
        label="Product Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter product name"
        required
      />

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter product description"
          rows={3}
          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
        />
      </div>

      <Input
        id="imageUrl"
        label="Image URL (optional)"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        placeholder="https://example.com/image.png"
        type="url"
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {product ? 'Update Product' : 'Create Product'}
        </Button>
      </div>
    </form>
  )
}
