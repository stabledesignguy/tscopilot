import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const ORG_STORAGE_KEY = 'tscopilot_current_org_id'

// Helper to get current org ID from cookie
async function getCurrentOrgId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(ORG_STORAGE_KEY)?.value || null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get org ID from query param or cookie
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('organizationId') || await getCurrentOrgId()

    let query = (supabase
      .from('groups') as any)
      .select('*, products:products(id, name)')
      .order('name', { ascending: true })

    // Filter by organization if provided
    if (orgId) {
      query = query.eq('organization_id', orgId)
    }

    const { data: groups, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ groups })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, organization_id } = body

    // Get org ID from body or cookie
    const orgId = organization_id || await getCurrentOrgId()

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // Check if user is org admin or super admin
    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_super_admin) {
      // Check org membership and role
      const { data: membership } = await (supabase
        .from('organization_members') as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .single()

      if (membership?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      )
    }

    const { data: group, error } = await (supabase
      .from('groups') as any)
      .insert({ name, description, organization_id: orgId })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ group }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, description } = body

    if (!id || !name) {
      return NextResponse.json(
        { error: 'Group ID and name are required' },
        { status: 400 }
      )
    }

    // Get the group to check its organization
    const { data: existingGroup } = await supabase
      .from('groups')
      .select('organization_id')
      .eq('id', id)
      .single()

    if (!existingGroup) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Check if user has permission
    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    const existingGroupOrgId = (existingGroup as any).organization_id
    if (!profile?.is_super_admin && existingGroupOrgId) {
      const { data: membership } = await (supabase
        .from('organization_members') as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', existingGroupOrgId)
        .eq('is_active', true)
        .single()

      if (membership?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const { data: group, error } = await (supabase
      .from('groups') as any)
      .update({ name, description, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ group })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Group ID is required' },
        { status: 400 }
      )
    }

    // Get the group to check its organization
    const { data: existingGroup } = await supabase
      .from('groups')
      .select('organization_id')
      .eq('id', id)
      .single()

    if (!existingGroup) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Check if user has permission
    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    const deleteGroupOrgId = (existingGroup as any).organization_id
    if (!profile?.is_super_admin && deleteGroupOrgId) {
      const { data: membership } = await (supabase
        .from('organization_members') as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', deleteGroupOrgId)
        .eq('is_active', true)
        .single()

      if (membership?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const { error } = await (supabase
      .from('groups') as any)
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
