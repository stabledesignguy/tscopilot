'use client'

import { OrganizationProvider } from '@/lib/context/OrganizationContext'
import { ReactNode } from 'react'

interface OrganizationProviderWrapperProps {
  children: ReactNode
  userId: string
  isSuperAdmin: boolean
}

export function OrganizationProviderWrapper({
  children,
  userId,
  isSuperAdmin,
}: OrganizationProviderWrapperProps) {
  return (
    <OrganizationProvider userId={userId} isSuperAdmin={isSuperAdmin}>
      {children}
    </OrganizationProvider>
  )
}
