'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { Organization, OrganizationMember, OrganizationSettings, OrgRole } from '@/types'

const ORG_STORAGE_KEY = 'tscopilot_current_org_id'

interface OrganizationContextValue {
  // Current organization
  currentOrg: Organization | null
  currentOrgSettings: OrganizationSettings | null
  currentMembership: OrganizationMember | null

  // All user organizations
  organizations: Organization[]
  memberships: OrganizationMember[]

  // Loading state
  isLoading: boolean
  error: string | null

  // Actions
  switchOrganization: (orgId: string) => Promise<void>
  refreshOrganizations: () => Promise<void>

  // Role checks
  isOrgAdmin: boolean
  isSuperAdmin: boolean
  currentOrgRole: OrgRole | null
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined)

interface OrganizationProviderProps {
  children: ReactNode
  userId: string
  isSuperAdmin: boolean
}

export function OrganizationProvider({
  children,
  userId,
  isSuperAdmin: initialIsSuperAdmin
}: OrganizationProviderProps) {
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [currentOrgSettings, setCurrentOrgSettings] = useState<OrganizationSettings | null>(null)
  const [currentMembership, setCurrentMembership] = useState<OrganizationMember | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [memberships, setMemberships] = useState<OrganizationMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSuperAdmin] = useState(initialIsSuperAdmin)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Load organizations for the user
  const loadOrganizations = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Get user's memberships with organization data
      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)

      if (memberError) throw memberError

      const membersList = (memberData || []) as (OrganizationMember & { organization: Organization })[]
      const orgsList = membersList.map(m => m.organization).filter(Boolean)

      setMemberships(membersList)
      setOrganizations(orgsList)

      // Restore last selected org from storage, or use first org
      const storedOrgId = typeof window !== 'undefined'
        ? localStorage.getItem(ORG_STORAGE_KEY)
        : null

      let targetOrg: Organization | null = null
      let targetMembership: OrganizationMember | null = null

      if (storedOrgId) {
        targetOrg = orgsList.find(o => o.id === storedOrgId) || null
        targetMembership = membersList.find(m => m.organization_id === storedOrgId) || null
      }

      if (!targetOrg && orgsList.length > 0) {
        targetOrg = orgsList[0]
        targetMembership = membersList[0]
      }

      if (targetOrg) {
        setCurrentOrg(targetOrg)
        setCurrentMembership(targetMembership)

        // Load org settings
        const { data: settingsData } = await supabase
          .from('organization_settings')
          .select('*')
          .eq('organization_id', targetOrg.id)
          .single()

        setCurrentOrgSettings(settingsData)

        // Store in localStorage and cookie (cookie is used by server-side APIs)
        if (typeof window !== 'undefined') {
          localStorage.setItem(ORG_STORAGE_KEY, targetOrg.id)
          document.cookie = `${ORG_STORAGE_KEY}=${targetOrg.id}; path=/; max-age=31536000; SameSite=Lax`
        }
      }
    } catch (err) {
      console.error('Failed to load organizations:', err)
      setError(err instanceof Error ? err.message : 'Failed to load organizations')
    } finally {
      setIsLoading(false)
    }
  }, [userId, supabase])

  // Switch to a different organization
  const switchOrganization = useCallback(async (orgId: string) => {
    try {
      setIsLoading(true)
      setError(null)

      const targetOrg = organizations.find(o => o.id === orgId)
      const targetMembership = memberships.find(m => m.organization_id === orgId)

      if (!targetOrg) {
        throw new Error('Organization not found')
      }

      // Load org settings
      const { data: settingsData } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('organization_id', orgId)
        .single()

      setCurrentOrg(targetOrg)
      setCurrentMembership(targetMembership || null)
      setCurrentOrgSettings(settingsData)

      // Store in localStorage and cookie (cookie is used by server-side APIs)
      if (typeof window !== 'undefined') {
        localStorage.setItem(ORG_STORAGE_KEY, orgId)
        document.cookie = `${ORG_STORAGE_KEY}=${orgId}; path=/; max-age=31536000; SameSite=Lax`
      }
    } catch (err) {
      console.error('Failed to switch organization:', err)
      setError(err instanceof Error ? err.message : 'Failed to switch organization')
    } finally {
      setIsLoading(false)
    }
  }, [organizations, memberships, supabase])

  // Refresh organizations
  const refreshOrganizations = useCallback(async () => {
    await loadOrganizations()
  }, [loadOrganizations])

  // Load organizations on mount
  useEffect(() => {
    loadOrganizations()
  }, [loadOrganizations])

  // Compute role checks
  const isOrgAdmin = currentMembership?.role === 'admin' || isSuperAdmin
  const currentOrgRole = currentMembership?.role || null

  const value: OrganizationContextValue = {
    currentOrg,
    currentOrgSettings,
    currentMembership,
    organizations,
    memberships,
    isLoading,
    error,
    switchOrganization,
    refreshOrganizations,
    isOrgAdmin,
    isSuperAdmin,
    currentOrgRole,
  }

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}

// Hook to get current org ID for API calls
export function useCurrentOrgId(): string | null {
  const { currentOrg } = useOrganization()
  return currentOrg?.id || null
}
