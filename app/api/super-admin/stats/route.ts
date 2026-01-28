import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Check if user is super admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Use service client for aggregate queries
    const serviceClient = createServiceClient()

    // Get stats
    const [orgsResult, usersResult, activeOrgsResult] = await Promise.all([
      (serviceClient.from('organizations') as any).select('id', { count: 'exact' }),
      (serviceClient.from('profiles') as any).select('id', { count: 'exact' }),
      (serviceClient.from('organizations') as any).select('id', { count: 'exact' }).eq('is_active', true),
    ])

    const { data: superAdmins } = await (serviceClient
      .from('profiles') as any)
      .select('id', { count: 'exact' })
      .eq('is_super_admin', true)

    // Get recent organizations
    const { data: recentOrgs } = await (serviceClient
      .from('organizations') as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    const stats = {
      organizations: orgsResult.count || 0,
      totalUsers: usersResult.count || 0,
      superAdmins: superAdmins?.length || 0,
      activeOrgs: activeOrgsResult.count || 0,
    }

    return NextResponse.json({
      stats,
      recentOrganizations: recentOrgs || [],
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
