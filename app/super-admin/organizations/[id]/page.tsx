'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Building2,
  Users,
  Package,
  FileText,
  Settings,
  Loader2,
  ArrowLeft,
  Plus,
  Trash2,
  Mail,
  Crown,
  User,
  MoreVertical,
  Pencil,
  CheckCircle,
} from 'lucide-react'
import Link from 'next/link'
import type { Organization, OrganizationSettings, OrganizationMember, User as UserType, LLMProvider } from '@/types'

interface Product {
  id: string
  name: string
  description: string | null
  created_at: string
}

interface OrgDetails extends Organization {
  settings?: OrganizationSettings
  members?: (OrganizationMember & { user: UserType })[]
  products?: Product[]
  stats?: {
    products: number
    documents: number
    conversations: number
  }
}

export default function OrganizationDetailsPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [org, setOrg] = useState<OrgDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'settings'>('overview')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showInviteSuccessModal, setShowInviteSuccessModal] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'user' as 'user' | 'admin' })
  const [isInviting, setIsInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [settingsForm, setSettingsForm] = useState<Partial<OrganizationSettings>>({})
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [memberMenuId, setMemberMenuId] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', slug: '', logo_url: '', is_active: true })
  const [isSavingOrg, setIsSavingOrg] = useState(false)
  const [editError, setEditError] = useState('')

  const fetchOrg = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/super-admin/organizations/${id}`)
      if (response.ok) {
        const data = await response.json()
        setOrg(data.organization)
        setSettingsForm(data.organization.settings || {})
        setEditForm({
          name: data.organization.name || '',
          slug: data.organization.slug || '',
          logo_url: data.organization.logo_url || '',
          is_active: data.organization.is_active ?? true,
        })
      } else if (response.status === 404) {
        router.push('/super-admin/organizations')
      }
    } catch (error) {
      console.error('Failed to fetch organization:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrg()
  }, [id])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsInviting(true)
    setInviteError('')

    try {
      const response = await fetch(`/api/org/${id}/members/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      })

      if (response.ok) {
        setShowInviteModal(false)
        setInviteForm({ email: '', role: 'user' })
        setShowInviteSuccessModal(true)
        fetchOrg()
      } else {
        const data = await response.json()
        setInviteError(data.error || 'Failed to send invitation')
      }
    } catch (error) {
      setInviteError('Failed to send invitation')
    } finally {
      setIsInviting(false)
    }
  }

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingOrg(true)
    setEditError('')

    try {
      const response = await fetch(`/api/super-admin/organizations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      if (response.ok) {
        setShowEditModal(false)
        fetchOrg()
      } else {
        const data = await response.json()
        setEditError(data.error || 'Failed to update organization')
      }
    } catch (error) {
      setEditError('Failed to update organization')
    } finally {
      setIsSavingOrg(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return

    try {
      const response = await fetch(`/api/org/${id}/members/${memberId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchOrg()
      }
    } catch (error) {
      console.error('Failed to remove member:', error)
    }
    setMemberMenuId(null)
  }

  const handleUpdateMemberRole = async (memberId: string, newRole: 'user' | 'admin') => {
    try {
      const response = await fetch(`/api/org/${id}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (response.ok) {
        fetchOrg()
      }
    } catch (error) {
      console.error('Failed to update member role:', error)
    }
    setMemberMenuId(null)
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingSettings(true)

    try {
      const response = await fetch(`/api/org/${id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      })

      if (response.ok) {
        fetchOrg()
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setIsSavingSettings(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Organization not found</p>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'members', label: 'Members' },
    { id: 'settings', label: 'Settings' },
  ] as const

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/super-admin/organizations"
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Organizations
        </Link>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="w-12 h-12 rounded-lg" />
            ) : (
              <Building2 className="w-8 h-8 text-blue-600" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{org.name}</h1>
            <p className="text-slate-500">/{org.slug}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(true)}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <span
              className={`px-3 py-1 text-sm rounded-full ${
                org.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {org.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stats */}
            <div className="lg:col-span-2 grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="py-6 text-center">
                  <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-slate-900">
                    {org.members?.length || 0}
                  </p>
                  <p className="text-sm text-slate-500">Members</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-6 text-center">
                  <Package className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-slate-900">
                    {org.stats?.products || 0}
                  </p>
                  <p className="text-sm text-slate-500">Products</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-6 text-center">
                  <FileText className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-slate-900">
                    {org.stats?.documents || 0}
                  </p>
                  <p className="text-sm text-slate-500">Documents</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Info */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-900">Organization Info</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Created</p>
                  <p className="text-sm text-slate-900">
                    {new Date(org.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">LLM Provider</p>
                  <p className="text-sm text-slate-900 capitalize">
                    {org.settings?.llm_provider || 'Default'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Max Users</p>
                  <p className="text-sm text-slate-900">
                    {org.settings?.max_users || 50}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Products List */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900">
                Products ({org.products?.length || 0})
              </h3>
            </CardHeader>
            <CardContent>
              {org.products && org.products.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {org.products.map((product) => (
                    <div key={product.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900">{product.name}</p>
                          {product.description && (
                            <p className="text-sm text-slate-500 truncate">
                              {product.description}
                            </p>
                          )}
                          <p className="text-xs text-slate-400 mt-1">
                            Created {new Date(product.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No products yet</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Products are managed by organization admins
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'members' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Members ({org.members?.length || 0})
            </h2>
            <Button onClick={() => setShowInviteModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Invite Member
            </Button>
          </div>

          {org.members && org.members.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-200">
                  {org.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {member.user?.email}
                          </p>
                          <p className="text-sm text-slate-500">
                            Joined {new Date(member.joined_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full ${
                            member.role === 'admin'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {member.role === 'admin' && <Crown className="w-3 h-3" />}
                          {member.role === 'admin' ? 'Admin' : 'User'}
                        </span>

                        <div className="relative">
                          <button
                            onClick={() => setMemberMenuId(memberMenuId === member.id ? null : member.id)}
                            className="p-2 hover:bg-slate-100 rounded-lg"
                          >
                            <MoreVertical className="w-4 h-4 text-slate-500" />
                          </button>

                          {memberMenuId === member.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                              <button
                                onClick={() => handleUpdateMemberRole(
                                  member.id,
                                  member.role === 'admin' ? 'user' : 'admin'
                                )}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 w-full text-left"
                              >
                                <Crown className="w-4 h-4" />
                                {member.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                              </button>
                              <button
                                onClick={() => handleRemoveMember(member.id)}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                              >
                                <Trash2 className="w-4 h-4" />
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No members yet</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900">Organization Settings</h3>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    LLM Provider
                  </label>
                  <select
                    value={settingsForm.llm_provider || ''}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        llm_provider: (e.target.value || null) as LLMProvider | null,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Use Platform Default</option>
                    <option value="claude">Claude</option>
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Gemini</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    LLM Model
                  </label>
                  <Input
                    type="text"
                    value={settingsForm.llm_model || ''}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, llm_model: e.target.value || null })
                    }
                    placeholder="e.g., claude-3-opus-20240229"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Max Users
                  </label>
                  <Input
                    type="number"
                    value={settingsForm.max_users || 50}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, max_users: parseInt(e.target.value) })
                    }
                    min={1}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Max Products
                  </label>
                  <Input
                    type="number"
                    value={settingsForm.max_products || 100}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, max_products: parseInt(e.target.value) })
                    }
                    min={1}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Custom System Instructions
                  </label>
                  <textarea
                    value={settingsForm.system_instructions || ''}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, system_instructions: e.target.value || null })
                    }
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Leave empty to use default system instructions"
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSavingSettings}>
                    {isSavingSettings ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Settings className="w-4 h-4 mr-2" />
                        Save Settings
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-900">
                Invite Member
              </h2>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="user@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Role
                  </label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as 'user' | 'admin' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {inviteError && (
                  <p className="text-sm text-red-600">{inviteError}</p>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowInviteModal(false)
                      setInviteForm({ email: '', role: 'user' })
                      setInviteError('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isInviting}>
                    {isInviting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Send Invitation
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invite Success Modal */}
      {showInviteSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-sm mx-4">
            <CardContent className="pt-6 pb-6 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                Member Invited!
              </h2>
              <p className="text-slate-600 mb-6">
                An invitation email has been sent.
              </p>
              <Button onClick={() => setShowInviteSuccessModal(false)}>
                OK
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Organization Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-900">
                Edit Organization
              </h2>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveOrg} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Organization Name
                  </label>
                  <Input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="My Organization"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Slug
                  </label>
                  <Input
                    type="text"
                    value={editForm.slug}
                    onChange={(e) => setEditForm({ ...editForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    placeholder="my-organization"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    URL-friendly identifier (lowercase, hyphens only)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Logo URL
                  </label>
                  <Input
                    type="url"
                    value={editForm.logo_url}
                    onChange={(e) => setEditForm({ ...editForm, logo_url: e.target.value })}
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={editForm.is_active}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="text-sm text-slate-700">
                    Organization is active
                  </label>
                </div>

                {editError && (
                  <p className="text-sm text-red-600">{editError}</p>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowEditModal(false)
                      setEditError('')
                      if (org) {
                        setEditForm({
                          name: org.name,
                          slug: org.slug,
                          logo_url: org.logo_url || '',
                          is_active: org.is_active,
                        })
                      }
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSavingOrg}>
                    {isSavingOrg ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
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
