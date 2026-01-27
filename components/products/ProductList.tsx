'use client'

import { useState, useMemo } from 'react'
import { Search, Box, FolderTree, ChevronDown, ChevronRight } from 'lucide-react'
import { ProductCard } from './ProductCard'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { Product } from '@/types'

interface ProductListProps {
  products: Product[]
  selectedProductId: string | null
  onSelectProduct: (product: Product) => void
}

interface GroupedProducts {
  groupId: string | null
  groupName: string | null
  products: Product[]
}

export function ProductList({
  products,
  selectedProductId,
  onSelectProduct,
}: ProductListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const { t } = useTranslation()

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products
    const query = searchQuery.toLowerCase()
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query) ||
        (product as any).group?.name?.toLowerCase().includes(query)
    )
  }, [products, searchQuery])

  // Group products by their group
  const groupedProducts = useMemo(() => {
    const groups = new Map<string | null, GroupedProducts>()

    filteredProducts.forEach((product) => {
      const groupId = product.group_id
      const groupName = (product as any).group?.name || null

      if (!groups.has(groupId)) {
        groups.set(groupId, {
          groupId,
          groupName,
          products: [],
        })
      }
      groups.get(groupId)!.products.push(product)
    })

    // Sort: groups first (alphabetically), then ungrouped
    const sorted = Array.from(groups.values()).sort((a, b) => {
      if (a.groupName && !b.groupName) return -1
      if (!a.groupName && b.groupName) return 1
      if (a.groupName && b.groupName) {
        return a.groupName.localeCompare(b.groupName)
      }
      return 0
    })

    return sorted
  }, [filteredProducts])

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search - Fixed at top */}
      <div className="p-4 border-b border-slate-200 flex-shrink-0 bg-white">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('products.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          />
        </div>
      </div>

      {/* Product List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredProducts.length > 0 ? (
          <div className="space-y-2">
            {groupedProducts.map((group) => (
              <div key={group.groupId || 'ungrouped'}>
                {group.groupName ? (
                  // Grouped products
                  <div>
                    <button
                      onClick={() => toggleGroup(group.groupId!)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      {collapsedGroups.has(group.groupId!) ? (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                      <FolderTree className="w-4 h-4 text-primary-500" />
                      <span className="font-bold text-base text-slate-800">
                        {group.groupName}
                      </span>
                      <span className="text-xs text-slate-400 ml-auto">
                        {group.products.length}
                      </span>
                    </button>
                    {!collapsedGroups.has(group.groupId!) && (
                      <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-100 pl-2">
                        {group.products.map((product) => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            isSelected={product.id === selectedProductId}
                            onClick={() => onSelectProduct(product)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // Ungrouped products
                  <div className="space-y-1">
                    {group.products.length > 0 && groupedProducts.some(g => g.groupName) && (
                      <div className="px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                        {t('products.ungrouped')}
                      </div>
                    )}
                    {group.products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        isSelected={product.id === selectedProductId}
                        onClick={() => onSelectProduct(product)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Box className="w-12 h-12 mb-3" />
            <p className="text-sm">
              {searchQuery ? t('products.noResults') : t('products.noProducts')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
