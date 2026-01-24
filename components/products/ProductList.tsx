'use client'

import { useState, useMemo } from 'react'
import { Search, Box } from 'lucide-react'
import { ProductCard } from './ProductCard'
import type { Product } from '@/types'

interface ProductListProps {
  products: Product[]
  selectedProductId: string | null
  onSelectProduct: (product: Product) => void
}

export function ProductList({
  products,
  selectedProductId,
  onSelectProduct,
}: ProductListProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products
    const query = searchQuery.toLowerCase()
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query)
    )
  }, [products, searchQuery])

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          />
        </div>
      </div>

      {/* Product List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredProducts.length > 0 ? (
          <div className="space-y-1">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isSelected={product.id === selectedProductId}
                onClick={() => onSelectProduct(product)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Box className="w-12 h-12 mb-3" />
            <p className="text-sm">
              {searchQuery ? 'No products found' : 'No products available'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
