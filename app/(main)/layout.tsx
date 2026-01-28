import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MainHeader } from '@/components/layout/MainHeader'
import { OrganizationProviderWrapper } from '@/components/providers/OrganizationProviderWrapper'

async function signOut() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await (supabase
    .from('profiles') as any)
    .select('role, is_super_admin')
    .eq('id', user.id)
    .single()

  // User is admin if they're a super admin OR have admin role in current org
  // The actual org-level admin check happens in the header component
  const isSuperAdmin = profile?.is_super_admin === true

  // Get the user's org membership to determine if they're an org admin
  const { data: membership } = await (supabase
    .from('organization_members') as any)
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .eq('role', 'admin')
    .limit(1)

  const isOrgAdmin = (membership && membership.length > 0) || isSuperAdmin

  return (
    <OrganizationProviderWrapper userId={user.id} isSuperAdmin={isSuperAdmin}>
      <div className="h-screen bg-secondary-50 flex flex-col">
        {/* Header - Fixed at top, with relative positioning for dropdown */}
        <div className="relative z-20 flex-shrink-0">
          <MainHeader
            email={user.email || ''}
            isAdmin={isOrgAdmin}
            isSuperAdmin={isSuperAdmin}
            signOutAction={signOut}
          />
        </div>

        {/* Main content */}
        <main className="flex-1 flex overflow-hidden">{children}</main>
      </div>
    </OrganizationProviderWrapper>
  )
}
