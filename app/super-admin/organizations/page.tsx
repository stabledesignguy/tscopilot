'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Building2,
  Plus,
  Search,
  Loader2,
  MoreVertical,
  Users,
  Settings,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import type { Organization } from '@/types'

interface OrgWithStats extends Organization {
  memberCount?: number
  productCount?: number
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<OrgWithStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', slug: '' })
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const fetchOrganizations = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/super-admin/organizations')
      if (response.ok) {
        const data = await response.json()
        setOrganizations(data.organizations || [])
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrganizations()
  }, [])

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setCreateError('')

    try {
      const response = await fetch('/api/super-admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })

      if (response.ok) {
        setShowCreateModal(false)
        setCreateForm({ name: '', slug: '' })
        fetchOrganizations()
      } else {
        const data = await response.json()
        setCreateError(data.error || 'Failed to create organization')
      }
    } catch (error) {
      setCreateError('Failed to create organization')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteOrg = async (orgId: string) => {
    if (!confirm('Are you sure you want to delete this organization? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/super-admin/organizations/${orgId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchOrganizations()
      }
    } catch (error) {
      console.error('Failed to delete organization:', error)
    }
    setMenuOpenId(null)
  }

  const filteredOrgs = organizations.filter(
    (org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Organizations</h1>
          <p className="text-slate-500">Manage all organizations on the platform</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Organization
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Organizations List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
        </div>
      ) : filteredOrgs.length > 0 ? (
        <div className="grid gap-4">
          {filteredOrgs.map((org) => (
            <Card key={org.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/super-admin/organizations/${org.id}`}
                    className="flex items-center gap-4 flex-1"
                  >
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      {org.logo_url ? (
                        <img
                          src={org.logo_url}
                          alt={org.name}
                          className="w-8 h-8 rounded"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{org.name}</h3>
                      <p className="text-sm text-slate-500">/{org.slug}</p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-6 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {org.memberCount || 0} members
                      </span>
                    </div>

                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        org.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {org.is_active ? 'Active' : 'Inactive'}
                    </span>

                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          setMenuOpenId(menuOpenId === org.id ? null : org.id)
                        }}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-500" />
                      </button>

                      {menuOpenId === org.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                          <Link
                            href={`/super-admin/organizations/${org.id}`}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <ExternalLink className="w-4 h-4" />
                            View Details
                          </Link>
                          <Link
                            href={`/super-admin/organizations/${org.id}/settings`}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <Settings className="w-4 h-4" />
                            Settings
                          </Link>
                          <button
                            onClick={() => handleDeleteOrg(org.id)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              No organizations found
            </h3>
            <p className="text-slate-500 mb-4">
              {searchQuery
                ? 'Try adjusting your search'
                : 'Create your first organization to get started'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Organization
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-900">
                Create Organization
              </h2>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateOrg} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Organization Name
                  </label>
                  <Input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => {
                      setCreateForm({
                        name: e.target.value,
                        slug: generateSlug(e.target.value),
                      })
                    }}
                    placeholder="Acme Corporation"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Slug
                  </label>
                  <Input
                    type="text"
                    value={createForm.slug}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, slug: e.target.value })
                    }
                    placeholder="acme-corporation"
                    required
                    pattern="[a-z0-9-]+"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Lowercase letters, numbers, and hyphens only
                  </p>
                </div>

                {createError && (
                  <p className="text-sm text-red-600">{createError}</p>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateModal(false)
                      setCreateForm({ name: '', slug: '' })
                      setCreateError('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Organization'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
