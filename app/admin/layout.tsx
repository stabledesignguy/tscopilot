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
    .select('role, is_super_admin')
    .eq('id', user.id)
    .single()

  if ((profile as { role: string } | null)?.role !== 'admin') {
    redirect('/')
  }

  const isSuperAdmin = (profile as { is_super_admin?: boolean } | null)?.is_super_admin ?? false

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
