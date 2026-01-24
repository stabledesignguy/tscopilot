'use client'

import { Box } from 'lucide-react'
import type { Product } from '@/types'

interface ProductCardProps {
  product: Product
  isSelected: boolean
  onClick: () => void
}

export function ProductCard({ product, isSelected, onClick }: ProductCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
        isSelected
          ? 'bg-primary-50 border-primary-200 border'
          : 'hover:bg-slate-50 border border-transparent'
      }`}
    >
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
          isSelected ? 'bg-primary-100' : 'bg-slate-100'
        }`}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-6 h-6 object-contain"
          />
        ) : (
          <Box
            className={`w-5 h-5 ${
              isSelected ? 'text-primary-600' : 'text-slate-400'
            }`}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3
          className={`font-medium truncate ${
            isSelected ? 'text-primary-700' : 'text-slate-900'
          }`}
        >
          {product.name}
        </h3>
        {product.description && (
          <p className="text-sm text-slate-500 truncate">{product.description}</p>
        )}
      </div>
    </button>
  )
}
