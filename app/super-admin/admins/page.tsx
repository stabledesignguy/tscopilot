'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Shield, Plus, Loader2, Trash2, Search, User } from 'lucide-react'
import type { User as UserType } from '@/types'

export default function SuperAdminsPage() {
  const [superAdmins, setSuperAdmins] = useState<UserType[]>([])
  const [allUsers, setAllUsers] = useState<UserType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const [adminsRes, usersRes] = await Promise.all([
        fetch('/api/super-admin/admins'),
        fetch('/api/super-admin/users'),
      ])

      if (adminsRes.ok) {
        const data = await adminsRes.json()
        setSuperAdmins(data.admins || [])
      }

      if (usersRes.ok) {
        const data = await usersRes.json()
        setAllUsers(data.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAddSuperAdmin = async () => {
    if (!selectedUserId) return

    setIsAdding(true)
    try {
      const response = await fetch('/api/super-admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId }),
      })

      if (response.ok) {
        setShowAddModal(false)
        setSelectedUserId('')
        fetchData()
      }
    } catch (error) {
      console.error('Failed to add super admin:', error)
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveSuperAdmin = async (userId: string) => {
    if (!confirm('Are you sure you want to remove super admin privileges from this user?')) {
      return
    }

    try {
      const response = await fetch(`/api/super-admin/admins/${userId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Failed to remove super admin:', error)
    }
  }

  const nonAdminUsers = allUsers.filter(
    (u) => !u.is_super_admin && u.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Super Admins</h1>
          <p className="text-slate-500">Manage platform-level administrators</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Super Admin
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
        </div>
      ) : superAdmins.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-200">
              {superAdmins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <Shield className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{admin.email}</p>
                      <p className="text-sm text-slate-500">
                        Since {new Date(admin.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveSuperAdmin(admin.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No super admins yet</p>
          </CardContent>
        </Card>
      )}

      {/* Add Super Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-900">
                Add Super Admin
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search users by email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                {nonAdminUsers.length > 0 ? (
                  nonAdminUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUserId(user.id)}
                      className={`w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 transition-colors ${
                        selectedUserId === user.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-slate-500" />
                      </div>
                      <span className="text-sm text-slate-900">{user.email}</span>
                      {selectedUserId === user.id && (
                        <span className="ml-auto text-blue-600 text-sm">Selected</span>
                      )}
                    </button>
                  ))
                ) : (
                  <p className="p-4 text-sm text-slate-500 text-center">
                    {searchQuery ? 'No users found' : 'All users are already super admins'}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false)
                    setSearchQuery('')
                    setSelectedUserId('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddSuperAdmin}
                  disabled={!selectedUserId || isAdding}
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Add Super Admin
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
