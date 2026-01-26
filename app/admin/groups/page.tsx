'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, FolderTree, Package } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import type { Group } from '@/types'

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '' })

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

    try {
      if (editingGroup) {
        // Update existing group
        const response = await fetch('/api/groups', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingGroup.id, ...formData }),
        })

        if (response.ok) {
          fetchGroups()
          closeModal()
        }
      } else {
        // Create new group
        const response = await fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })

        if (response.ok) {
          fetchGroups()
          closeModal()
        }
      }
    } catch (error) {
      console.error('Failed to save group:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this group? Products in this group will be ungrouped.')) {
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
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Groups</h1>
          <p className="text-slate-500">Organize products into groups</p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Group
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FolderTree className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              No groups yet
            </h3>
            <p className="text-slate-500 mb-4">
              Create groups to organize your products
            </p>
            <Button onClick={() => openModal()}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Group
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
                    <h3 className="font-semibold text-slate-900">{group.name}</h3>
                    {group.description && (
                      <p className="text-sm text-slate-500 mt-1">
                        {group.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openModal(group)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(group.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Package className="w-4 h-4" />
                  <span>
                    {group.products?.length || 0} product
                    {(group.products?.length || 0) !== 1 ? 's' : ''}
                  </span>
                </div>
                {group.products && group.products.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {group.products.slice(0, 5).map((product: any) => (
                      <div
                        key={product.id}
                        className="text-sm text-slate-600 pl-6"
                      >
                        {product.name}
                      </div>
                    ))}
                    {group.products.length > 5 && (
                      <div className="text-sm text-slate-400 pl-6">
                        +{group.products.length - 5} more
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
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {editingGroup ? 'Edit Group' : 'Create Group'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter group name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <Button type="button" variant="ghost" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingGroup ? 'Save Changes' : 'Create Group'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
