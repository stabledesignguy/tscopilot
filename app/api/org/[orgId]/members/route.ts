import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin, isOrgAdmin } from '@/lib/auth/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has access to this org
    const isSuperAdminUser = await isSuperAdmin(user.id)
    const isAdmin = await isOrgAdmin(user.id, orgId)

    if (!isSuperAdminUser && !isAdmin) {
      // Check if user is at least a member
      const { data: membership } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .single()

      if (!membership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const serviceClient = createServiceClient()

    const { data: members, error } = await (serviceClient
      .from('organization_members') as any)
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('joined_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch profiles for all members
    const userIds = (members || []).map((m: any) => m.user_id)
    const { data: profiles } = await (serviceClient
      .from('profiles') as any)
      .select('*')
      .in('id', userIds)

    // Combine members with their profiles
    const membersWithProfiles = (members || []).map((member: any) => ({
      ...member,
      user: (profiles || []).find((p: any) => p.id === member.user_id) || null,
    }))

    return NextResponse.json({ members: membersWithProfiles })
  } catch (error) {
    console.error('Members GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is org admin or super admin
    const isSuperAdminUser = await isSuperAdmin(user.id)
    const isAdmin = await isOrgAdmin(user.id, orgId)

    if (!isSuperAdminUser && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, role = 'user' } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const serviceClient = createServiceClient()

    // Check if user is already a member
    const { data: existing } = await (serviceClient
      .from('organization_members') as any)
      .select('id, is_active')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .single()

    if (existing) {
      if ((existing as any).is_active) {
        return NextResponse.json(
          { error: 'User is already a member of this organization' },
          { status: 400 }
        )
      }

      // Reactivate membership
      const { data: member, error } = await (serviceClient
        .from('organization_members') as any)
        .update({ is_active: true, role })
        .eq('id', (existing as any).id)
        .select('*')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Fetch user profile
      const { data: profile } = await (serviceClient
        .from('profiles') as any)
        .select('*')
        .eq('id', userId)
        .single()

      return NextResponse.json({ member: { ...member, user: profile } })
    }

    // Check organization limits
    const { data: settings } = await (serviceClient
      .from('organization_settings') as any)
      .select('max_users')
      .eq('organization_id', orgId)
      .single()

    const { count: memberCount } = await (serviceClient
      .from('organization_members') as any)
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_active', true)

    if (settings?.max_users && memberCount !== null && memberCount >= (settings as any).max_users) {
      return NextResponse.json(
        { error: 'Organization has reached maximum user limit' },
        { status: 400 }
      )
    }

    // Create membership
    const { data: member, error } = await (serviceClient
      .from('organization_members') as any)
      .insert({
        organization_id: orgId,
        user_id: userId,
        role,
        invited_by: user.id,
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch user profile
    const { data: profile } = await (serviceClient
      .from('profiles') as any)
      .select('*')
      .eq('id', userId)
      .single()

    return NextResponse.json({ member: { ...member, user: profile } }, { status: 201 })
  } catch (error) {
    console.error('Members POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
