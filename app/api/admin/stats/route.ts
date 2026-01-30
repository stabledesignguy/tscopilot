import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const ORG_STORAGE_KEY = 'tscopilot_current_org_id'

async function getCurrentOrgId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(ORG_STORAGE_KEY)?.value || null
}

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getCurrentOrgId()
    if (!orgId) {
      return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
    }

    // Check if user is org admin or super admin
    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_super_admin) {
      const { data: membership } = await (supabase
        .from('organization_members') as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .single()

      if (!membership || membership.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Fetch all counts in parallel
    const [groupsCount, productsCount, documentsCount, conversationsCount] = await Promise.all([
      (supabase
        .from('groups') as any)
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId),
      (supabase
        .from('products') as any)
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId),
      (supabase
        .from('documents') as any)
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId),
      (supabase
        .from('conversations') as any)
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId),
    ])

    return NextResponse.json({
      stats: {
        groups: groupsCount.count || 0,
        products: productsCount.count || 0,
        documents: documentsCount.count || 0,
        conversations: conversationsCount.count || 0,
      },
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
