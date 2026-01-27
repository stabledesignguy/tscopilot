'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, FolderTree, Package, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { Group } from '@/types'

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { t } = useTranslation()

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups')
      const data = await response.json()
      setGroups(data.groups || [])
    } catch (error) {
      console.error('Failed to fetch groups:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchGroups()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSaving(true)

    try {
      const url = '/api/groups'
      const method = editingGroup ? 'PUT' : 'POST'
      const body = editingGroup
        ? { id: editingGroup.id, ...formData }
        : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('common.error'))
      }

      fetchGroups()
      closeModal()
    } catch (err) {
      console.error('Failed to save group:', err)
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('groups.deleteConfirm'))) {
      return
    }

    try {
      const response = await fetch(`/api/groups?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchGroups()
      }
    } catch (error) {
      console.error('Failed to delete group:', error)
    }
  }

  const openModal = (group?: Group) => {
    if (group) {
      setEditingGroup(group)
      setFormData({ name: group.name, description: group.description || '' })
    } else {
      setEditingGroup(null)
      setFormData({ name: '', description: '' })
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingGroup(null)
    setFormData({ name: '', description: '' })
    setError(null)
  }

  const getProductCountText = (count: number) => {
    if (count === 1) {
      return `1 ${t('groups.product')}`
    }
    return `${count} ${t('groups.products')}`
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">{t('groups.title')}</h1>
          <p className="text-secondary-500">{t('groups.subtitle')}</p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="w-4 h-4 mr-2" />
          {t('groups.addGroup')}
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FolderTree className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-secondary-900 mb-2">
              {t('groups.noGroupsYet')}
            </h3>
            <p className="text-secondary-500 mb-4">
              {t('groups.createGroupsDesc')}
            </p>
            <Button onClick={() => openModal()}>
              <Plus className="w-4 h-4 mr-2" />
              {t('groups.createFirstGroup')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <FolderTree className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-secondary-900">{group.name}</h3>
                    {group.description && (
                      <p className="text-sm text-secondary-500 mt-1">
                        {group.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openModal(group)}
                    className="p-1.5 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 rounded"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(group.id)}
                    className="p-1.5 text-secondary-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-secondary-500">
                  <Package className="w-4 h-4" />
                  <span>{getProductCountText(group.products?.length || 0)}</span>
                </div>
                {group.products && group.products.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {group.products.slice(0, 5).map((product: any) => (
                      <div
                        key={product.id}
                        className="text-sm text-secondary-600 pl-6"
                      >
                        {product.name}
                      </div>
                    ))}
                    {group.products.length > 5 && (
                      <div className="text-sm text-secondary-400 pl-6">
                        {t('groups.more', { count: group.products.length - 5 })}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-secondary-900 mb-4">
              {editingGroup ? t('groups.editGroup') : t('groups.createGroup')}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  {t('groups.groupName')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder={t('groups.groupNamePlaceholder')}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  {t('groups.descriptionLabel')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder={t('groups.descriptionPlaceholder')}
                  rows={3}
                />
              </div>
              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div className="flex gap-3 justify-end pt-4">
                <Button type="button" variant="ghost" onClick={closeModal} disabled={isSaving}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? t('common.saving') : editingGroup ? t('common.saveChanges') : t('groups.createGroup')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
