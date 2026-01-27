import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MainHeader } from '@/components/layout/MainHeader'

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = (profile as { role: string } | null)?.role === 'admin'

  return (
    <div className="h-screen bg-slate-50 flex flex-col">
      {/* Header - Fixed at top, with relative positioning for dropdown */}
      <div className="relative z-20 flex-shrink-0">
        <MainHeader
          email={user.email || ''}
          isAdmin={isAdmin}
          signOutAction={signOut}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">{children}</main>
    </div>
  )
}
