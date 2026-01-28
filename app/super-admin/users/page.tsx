'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Search, Loader2, User, Shield, Building2 } from 'lucide-react'
import type { User as UserType, OrganizationMember, Organization } from '@/types'

interface UserWithOrgs extends UserType {
  memberships?: (OrganizationMember & { organization: Organization })[]
}

export default function AllUsersPage() {
  const [users, setUsers] = useState<UserWithOrgs[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
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

    fetchUsers()
  }, [])

  const filteredUsers = users.filter((user) =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">All Users</h1>
        <p className="text-slate-500">View all users across the platform</p>
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
                <div key={user.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                        {user.is_super_admin ? (
                          <Shield className="w-5 h-5 text-purple-500" />
                        ) : (
                          <User className="w-5 h-5 text-slate-500" />
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
                      {user.is_super_admin && (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                          Super Admin
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Organizations */}
                  {user.memberships && user.memberships.length > 0 && (
                    <div className="mt-3 pl-13 flex flex-wrap gap-2">
                      {user.memberships.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded-full"
                        >
                          <Building2 className="w-3 h-3" />
                          {m.organization.name}
                          {m.role === 'admin' && (
                            <span className="text-amber-600">(Admin)</span>
                          )}
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
    </div>
  )
}
