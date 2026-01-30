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

    const serviceClient = createServiceClient()

    // Get all users with their organization memberships
    const { data: users, error } = await (serviceClient
      .from('profiles') as any)
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get memberships for each user
    const usersWithOrgs = await Promise.all(
      ((users || []) as any[]).map(async (u: any) => {
        const { data: memberships } = await (serviceClient
          .from('organization_members') as any)
          .select('*, organization:organizations(*)')
          .eq('user_id', u.id)
          .eq('is_active', true)

        // Get pending invitations for this user's email
        const { data: pendingInvitations } = await (serviceClient
          .from('organization_invitations') as any)
          .select('*, organization:organizations(*)')
          .eq('email', u.email)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString())

        return {
          ...u,
          memberships: memberships || [],
          pendingInvitations: pendingInvitations || [],
        }
      })
    )

    return NextResponse.json({ users: usersWithOrgs })
  } catch (error) {
    console.error('Users GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
