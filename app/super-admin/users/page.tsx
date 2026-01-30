'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Search,
  Loader2,
  User,
  Shield,
  Building2,
  Clock,
  MoreVertical,
  UserX,
  UserMinus,
  Trash2,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import type { User as UserType, OrganizationMember, Organization, OrganizationInvitation } from '@/types'

interface UserWithOrgs extends UserType {
  memberships?: (OrganizationMember & { organization: Organization })[]
  pendingInvitations?: (OrganizationInvitation & { organization: Organization })[]
}

type ConfirmAction = 'revoke' | 'deactivate' | 'delete' | null

export default function AllUsersPage() {
  const [users, setUsers] = useState<UserWithOrgs[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [selectedUser, setSelectedUser] = useState<UserWithOrgs | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/super-admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleAction = (action: ConfirmAction, user: UserWithOrgs) => {
    setSelectedUser(user)
    setConfirmAction(action)
    setMenuOpenId(null)
  }

  const executeAction = async () => {
    if (!selectedUser || !confirmAction) return

    setIsProcessing(true)
    try {
      let response: Response

      if (confirmAction === 'delete') {
        response = await fetch(`/api/super-admin/users/${selectedUser.id}`, {
          method: 'DELETE',
        })
      } else {
        response = await fetch(`/api/super-admin/users/${selectedUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: confirmAction === 'revoke' ? 'revoke_all_access' : 'deactivate',
          }),
        })
      }

      if (response.ok) {
        const data = await response.json()
        setSuccessMessage(data.message)
        fetchUsers()
      } else {
        const data = await response.json()
        alert(data.error || 'Action failed')
      }
    } catch (error) {
      console.error('Action failed:', error)
      alert('Action failed')
    } finally {
      setIsProcessing(false)
      setConfirmAction(null)
      setSelectedUser(null)
    }
  }

  const filteredUsers = users.filter((user) =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getActionDetails = (action: ConfirmAction) => {
    switch (action) {
      case 'revoke':
        return {
          title: 'Remove from All Organizations',
          description: `This will remove "${selectedUser?.email}" from all organizations. They will still be able to log in but won't have access to any organization data.`,
          buttonText: 'Remove Access',
          buttonClass: 'bg-amber-600 hover:bg-amber-700',
          icon: UserMinus,
        }
      case 'deactivate':
        return {
          title: 'Deactivate Account',
          description: `This will deactivate "${selectedUser?.email}". They will not be able to log in and will be removed from all organizations. The account can be reactivated later.`,
          buttonText: 'Deactivate Account',
          buttonClass: 'bg-orange-600 hover:bg-orange-700',
          icon: UserX,
        }
      case 'delete':
        return {
          title: 'Permanently Delete Account',
          description: `This will PERMANENTLY delete "${selectedUser?.email}" and all their data including conversations and messages. This action cannot be undone.`,
          buttonText: 'Delete Permanently',
          buttonClass: 'bg-red-600 hover:bg-red-700',
          icon: Trash2,
        }
      default:
        return null
    }
  }

  const actionDetails = getActionDetails(confirmAction)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">All Users</h1>
        <p className="text-slate-500">View and manage all users across the platform</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
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
          <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
        </div>
      ) : filteredUsers.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-200">
              {filteredUsers.map((user) => (
                <div key={user.id} className={`p-4 ${user.is_active === false ? 'bg-slate-50 opacity-60' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        user.is_active === false
                          ? 'bg-slate-200'
                          : user.is_super_admin
                          ? 'bg-purple-100'
                          : 'bg-slate-100'
                      }`}>
                        {user.is_super_admin ? (
                          <Shield className="w-5 h-5 text-purple-500" />
                        ) : (
                          <User className={`w-5 h-5 ${user.is_active === false ? 'text-slate-400' : 'text-slate-500'}`} />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{user.email}</p>
                        <p className="text-sm text-slate-500">
                          Joined {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {user.is_active === false && (
                        <span className="px-2 py-1 text-xs bg-slate-200 text-slate-600 rounded-full">
                          Deactivated
                        </span>
                      )}
                      {user.is_super_admin && (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                          Super Admin
                        </span>
                      )}

                      {/* Actions dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === user.id ? null : user.id)}
                          className="p-2 hover:bg-slate-100 rounded-lg"
                        >
                          <MoreVertical className="w-4 h-4 text-slate-500" />
                        </button>

                        {menuOpenId === user.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10 min-w-[200px]">
                            <button
                              onClick={() => handleAction('revoke', user)}
                              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 w-full text-left"
                            >
                              <UserMinus className="w-4 h-4" />
                              Remove from all orgs
                            </button>
                            <button
                              onClick={() => handleAction('deactivate', user)}
                              className="flex items-center gap-2 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 w-full text-left"
                            >
                              <UserX className="w-4 h-4" />
                              Deactivate account
                            </button>
                            <hr className="my-1 border-slate-200" />
                            <button
                              onClick={() => handleAction('delete', user)}
                              className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete permanently
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Organizations - Memberships and Pending Invitations */}
                  {((user.memberships && user.memberships.length > 0) || (user.pendingInvitations && user.pendingInvitations.length > 0)) && (
                    <div className="mt-3 pl-13 flex flex-wrap gap-2">
                      {/* Active memberships */}
                      {user.memberships?.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700 rounded-full"
                        >
                          <Building2 className="w-3 h-3" />
                          {m.organization.name}
                          {m.role === 'admin' && (
                            <span className="text-amber-600">(Admin)</span>
                          )}
                        </span>
                      ))}
                      {/* Pending invitations */}
                      {user.pendingInvitations?.map((inv) => (
                        <span
                          key={inv.id}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded-full"
                        >
                          <Clock className="w-3 h-3" />
                          {inv.organization.name}
                          <span>(Invited)</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">
              {searchQuery ? 'No users found matching your search' : 'No users yet'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Modal */}
      {confirmAction && actionDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  confirmAction === 'delete' ? 'bg-red-100' :
                  confirmAction === 'deactivate' ? 'bg-orange-100' : 'bg-amber-100'
                }`}>
                  <AlertTriangle className={`w-6 h-6 ${
                    confirmAction === 'delete' ? 'text-red-600' :
                    confirmAction === 'deactivate' ? 'text-orange-600' : 'text-amber-600'
                  }`} />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {actionDetails.title}
                </h2>
              </div>

              <p className="text-slate-600 mb-6">
                {actionDetails.description}
              </p>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmAction(null)
                    setSelectedUser(null)
                  }}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={executeAction}
                  disabled={isProcessing}
                  className={`text-white ${actionDetails.buttonClass}`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    actionDetails.buttonText
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Success Modal */}
      {successMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-sm mx-4">
            <CardContent className="pt-6 pb-6 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                Success
              </h2>
              <p className="text-slate-600 mb-6">
                {successMessage}
              </p>
              <Button onClick={() => setSuccessMessage(null)}>
                OK
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
