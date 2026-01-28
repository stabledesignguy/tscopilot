import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { User, Organization, OrganizationMember, OrgRole } from '@/types'

export type Permission =
  | 'super_admin'
  | 'org:view'
  | 'org:manage'
  | 'org:settings'
  | 'users:view'
  | 'users:invite'
  | 'users:manage'
  | 'products:view'
  | 'products:create'
  | 'products:edit'
  | 'products:delete'
  | 'documents:view'
  | 'documents:upload'
  | 'documents:delete'
  | 'chat:use'
  | 'conversations:view'

// Permission matrix by role
const ROLE_PERMISSIONS: Record<'super_admin' | 'admin' | 'user', Permission[]> = {
  super_admin: [
    'super_admin',
    'org:view',
    'org:manage',
    'org:settings',
    'users:view',
    'users:invite',
    'users:manage',
    'products:view',
    'products:create',
    'products:edit',
    'products:delete',
    'documents:view',
    'documents:upload',
    'documents:delete',
    'chat:use',
    'conversations:view',
  ],
  admin: [
    'org:view',
    'org:settings',
    'users:view',
    'users:invite',
    'users:manage',
    'products:view',
    'products:create',
    'products:edit',
    'products:delete',
    'documents:view',
    'documents:upload',
    'documents:delete',
    'chat:use',
    'conversations:view',
  ],
  user: [
    'org:view',
    'products:view',
    'documents:view',
    'chat:use',
    'conversations:view',
  ],
}

interface AuthContext {
  user: User | null
  membership: OrganizationMember | null
  organizationId: string | null
}

/**
 * Get the current user's profile from the database
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .single()

  return profile
}

/**
 * Get the user's membership for a specific organization
 */
export async function getOrgMembership(
  userId: string,
  organizationId: string
): Promise<OrganizationMember | null> {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('organization_members')
    .select('*')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .single()

  return membership
}

/**
 * Check if a user is a super admin
 */
export async function isSuperAdmin(userId?: string): Promise<boolean> {
  const supabase = await createClient()

  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id
  }

  if (!userId) return false

  const { data: profile } = await (supabase
    .from('profiles') as any)
    .select('is_super_admin')
    .eq('id', userId)
    .single()

  return profile?.is_super_admin === true
}

/**
 * Check if a user is an admin of a specific organization
 */
export async function isOrgAdmin(userId: string, organizationId: string): Promise<boolean> {
  // Super admins are always org admins
  if (await isSuperAdmin(userId)) return true

  const membership = await getOrgMembership(userId, organizationId)
  return membership?.role === 'admin'
}

/**
 * Check if a user is a member of a specific organization
 */
export async function isOrgMember(userId: string, organizationId: string): Promise<boolean> {
  // Super admins can access all orgs
  if (await isSuperAdmin(userId)) return true

  const membership = await getOrgMembership(userId, organizationId)
  return membership !== null && membership.is_active
}

/**
 * Get all organizations a user is a member of
 */
export async function getUserOrganizations(userId: string): Promise<Organization[]> {
  const supabase = await createClient()

  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization:organizations(*)')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!memberships) return []

  return memberships
    .map(m => (m as { organization: Organization }).organization)
    .filter(Boolean)
}

/**
 * Check if a user has a specific permission within an organization
 */
export async function hasPermission(
  userId: string,
  organizationId: string,
  permission: Permission
): Promise<boolean> {
  // Check super admin first
  if (await isSuperAdmin(userId)) {
    return ROLE_PERMISSIONS.super_admin.includes(permission)
  }

  // Get membership
  const membership = await getOrgMembership(userId, organizationId)
  if (!membership || !membership.is_active) return false

  const role = membership.role as 'admin' | 'user'
  return ROLE_PERMISSIONS[role].includes(permission)
}

/**
 * Get all permissions for a user in an organization
 */
export async function getUserPermissions(
  userId: string,
  organizationId: string
): Promise<Permission[]> {
  // Check super admin first
  if (await isSuperAdmin(userId)) {
    return ROLE_PERMISSIONS.super_admin
  }

  // Get membership
  const membership = await getOrgMembership(userId, organizationId)
  if (!membership || !membership.is_active) return []

  const role = membership.role as 'admin' | 'user'
  return ROLE_PERMISSIONS[role]
}

/**
 * Get full auth context for the current request
 */
export async function getAuthContext(organizationId?: string): Promise<AuthContext> {
  const user = await getCurrentUser()

  if (!user) {
    return { user: null, membership: null, organizationId: null }
  }

  let membership: OrganizationMember | null = null
  let resolvedOrgId = organizationId || null

  if (organizationId) {
    membership = await getOrgMembership(user.id, organizationId)
  } else {
    // Get first organization the user belongs to
    const orgs = await getUserOrganizations(user.id)
    if (orgs.length > 0) {
      resolvedOrgId = orgs[0].id
      membership = await getOrgMembership(user.id, resolvedOrgId)
    }
  }

  return {
    user,
    membership,
    organizationId: resolvedOrgId,
  }
}

/**
 * Verify user has required permissions, throws if not
 */
export async function requirePermission(
  userId: string,
  organizationId: string,
  permission: Permission
): Promise<void> {
  const hasAccess = await hasPermission(userId, organizationId, permission)
  if (!hasAccess) {
    throw new Error(`Permission denied: ${permission}`)
  }
}

/**
 * Verify user is a super admin, throws if not
 */
export async function requireSuperAdmin(userId?: string): Promise<void> {
  const isAdmin = await isSuperAdmin(userId)
  if (!isAdmin) {
    throw new Error('Super admin access required')
  }
}

/**
 * Verify user is an org admin, throws if not
 */
export async function requireOrgAdmin(userId: string, organizationId: string): Promise<void> {
  const isAdmin = await isOrgAdmin(userId, organizationId)
  if (!isAdmin) {
    throw new Error('Organization admin access required')
  }
}

/**
 * Verify user is an org member, throws if not
 */
export async function requireOrgMember(userId: string, organizationId: string): Promise<void> {
  const isMember = await isOrgMember(userId, organizationId)
  if (!isMember) {
    throw new Error('Organization membership required')
  }
}

/**
 * Admin function: Set a user as super admin (service role only)
 */
export async function setSuperAdmin(userId: string, isSuperAdmin: boolean): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await (supabase
    .from('profiles') as any)
    .update({ is_super_admin: isSuperAdmin })
    .eq('id', userId)

  if (error) {
    throw new Error(`Failed to update super admin status: ${error.message}`)
  }
}
