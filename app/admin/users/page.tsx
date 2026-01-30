'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Users,
  Plus,
  Search,
  Loader2,
  MoreVertical,
  Crown,
  User,
  Mail,
  Trash2,
  CheckCircle,
} from 'lucide-react'
import type { OrganizationMember, User as UserType, OrganizationInvitation } from '@/types'

export default function AdminUsersPage() {
  const [members, setMembers] = useState<(OrganizationMember & { user: UserType })[]>([])
  const [pendingInvitations, setPendingInvitations] = useState<OrganizationInvitation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showInviteSuccessModal, setShowInviteSuccessModal] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'user' as 'user' | 'admin' })
  const [isInviting, setIsInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  // Get current org from localStorage
  const getCurrentOrgId = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tscopilot_current_org_id')
    }
    return null
  }

  const fetchData = async () => {
    const orgId = getCurrentOrgId()
    if (!orgId) return

    try {
      setIsLoading(true)
      const response = await fetch(`/api/org/${orgId}/members`)
      if (response.ok) {
        const data = await response.json()
        setMembers(data.members || [])
      }
    } catch (error) {
      console.error('Failed to fetch members:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    const orgId = getCurrentOrgId()
    if (!orgId) return

    setIsInviting(true)
    setInviteError('')

    try {
      const response = await fetch(`/api/org/${orgId}/members/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      })

      const data = await response.json()

      if (response.ok) {
        setShowInviteModal(false)
        setInviteForm({ email: '', role: 'user' })
        setShowInviteSuccessModal(true)
        fetchData()
      } else {
        setInviteError(data.error || 'Failed to send invitation')
      }
    } catch (error) {
      setInviteError('Failed to send invitation')
    } finally {
      setIsInviting(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return

    const orgId = getCurrentOrgId()
    if (!orgId) return

    try {
      const response = await fetch(`/api/org/${orgId}/members/${memberId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Failed to remove member:', error)
    }
    setMenuOpenId(null)
  }

  const handleUpdateRole = async (memberId: string, newRole: 'user' | 'admin') => {
    const orgId = getCurrentOrgId()
    if (!orgId) return

    try {
      const response = await fetch(`/api/org/${orgId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (response.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Failed to update role:', error)
    }
    setMenuOpenId(null)
  }

  const filteredMembers = members.filter((member) =>
    member.user?.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">User Management</h1>
          <p className="text-secondary-500">Manage users in your organization</p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Invite User
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-400" />
          <Input
            type="text"
            placeholder="Search by email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : filteredMembers.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-secondary-200">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-secondary-500" />
                    </div>
                    <div>
                      <p className="font-medium text-secondary-900">
                        {member.user?.email}
                      </p>
                      <p className="text-sm text-secondary-500">
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full ${
                        member.role === 'admin'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-secondary-100 text-secondary-600'
                      }`}
                    >
                      {member.role === 'admin' && <Crown className="w-3 h-3" />}
                      {member.role === 'admin' ? 'Admin' : 'User'}
                    </span>

                    <div className="relative">
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === member.id ? null : member.id)}
                        className="p-2 hover:bg-secondary-100 rounded-lg"
                      >
                        <MoreVertical className="w-4 h-4 text-secondary-500" />
                      </button>

                      {menuOpenId === member.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-secondary-200 rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                          <button
                            onClick={() => handleUpdateRole(
                              member.id,
                              member.role === 'admin' ? 'user' : 'admin'
                            )}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-50 w-full text-left"
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
            <Users className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
            <p className="text-secondary-500">
              {searchQuery ? 'No users found' : 'No users in this organization yet'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <h2 className="text-lg font-semibold text-secondary-900">
                Invite User
              </h2>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
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
                  <label className="block text-sm font-medium text-secondary-700 mb-1">
                    Role
                  </label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as 'user' | 'admin' })}
                    className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
              <h2 className="text-xl font-semibold text-secondary-900 mb-2">
                Member Invited!
              </h2>
              <p className="text-secondary-600 mb-6">
                An invitation email has been sent.
              </p>
              <Button onClick={() => setShowInviteSuccessModal(false)}>
                OK
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
