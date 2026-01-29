import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { OrganizationProviderWrapper } from '@/components/providers/OrganizationProviderWrapper'

export default async function AdminLayout({
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = (profile as { is_super_admin?: boolean } | null)?.is_super_admin ?? false

  // Check if user is org admin (has admin role in any organization)
  const { data: adminMembership } = await (supabase
    .from('organization_members') as any)
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .eq('is_active', true)
    .limit(1)

  const isOrgAdmin = adminMembership && adminMembership.length > 0

  // Allow access if user is super admin OR org admin
  if (!isSuperAdmin && !isOrgAdmin) {
    redirect('/')
  }

  return (
    <OrganizationProviderWrapper userId={user.id} isSuperAdmin={isSuperAdmin}>
      <div className="min-h-screen bg-secondary-50 flex">
        {/* Sidebar */}
        <AdminSidebar />

        {/* Main content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </OrganizationProviderWrapper>
  )
}
