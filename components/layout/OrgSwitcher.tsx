'use client'

import { useState, useRef, useEffect } from 'react'
import { Building2, ChevronDown, Check, Plus, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useOrganization } from '@/lib/context/OrganizationContext'

export function OrgSwitcher() {
  const {
    currentOrg,
    organizations,
    isLoading,
    switchOrganization,
    isSuperAdmin,
  } = useOrganization()

  const [isOpen, setIsOpen] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSwitch = async (orgId: string) => {
    if (orgId === currentOrg?.id) {
      setIsOpen(false)
      return
    }

    setIsSwitching(true)
    try {
      await switchOrganization(orgId)
      // Reload the page to refresh all data with new org context
      window.location.reload()
    } catch (error) {
      console.error('Failed to switch organization:', error)
    } finally {
      setIsSwitching(false)
      setIsOpen(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-secondary-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading...</span>
      </div>
    )
  }

  if (!currentOrg) {
    return null
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary-100 transition-colors"
      >
        <div className="w-7 h-7 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
          {currentOrg.logo_url ? (
            <img
              src={currentOrg.logo_url}
              alt={currentOrg.name}
              className="w-5 h-5 rounded"
            />
          ) : (
            <Building2 className="w-4 h-4 text-primary-600" />
          )}
        </div>
        <span className="text-sm font-medium text-secondary-700 max-w-[150px] truncate">
          {currentOrg.name}
        </span>
        {isSwitching ? (
          <Loader2 className="w-4 h-4 text-secondary-400 animate-spin" />
        ) : (
          <ChevronDown className={`w-4 h-4 text-secondary-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-secondary-200 rounded-lg shadow-lg py-1 z-50">
          <div className="px-3 py-2 text-xs font-medium text-secondary-500 uppercase tracking-wide">
            Your Organizations
          </div>

          <div className="max-h-64 overflow-y-auto">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSwitch(org.id)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-secondary-50 transition-colors"
              >
                <div className="w-8 h-8 bg-secondary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {org.logo_url ? (
                    <img
                      src={org.logo_url}
                      alt={org.name}
                      className="w-6 h-6 rounded"
                    />
                  ) : (
                    <Building2 className="w-4 h-4 text-secondary-500" />
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-secondary-900 truncate">
                    {org.name}
                  </p>
                  <p className="text-xs text-secondary-500">/{org.slug}</p>
                </div>
                {org.id === currentOrg.id && (
                  <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {isSuperAdmin && (
            <>
              <div className="border-t border-secondary-200 my-1" />
              <Link
                href="/super-admin/organizations"
                className="flex items-center gap-2 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <Plus className="w-4 h-4" />
                Manage Organizations
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
