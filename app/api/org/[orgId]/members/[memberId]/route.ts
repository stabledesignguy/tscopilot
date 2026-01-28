import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin, isOrgAdmin } from '@/lib/auth/permissions'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; memberId: string }> }
) {
  try {
    const { orgId, memberId } = await params
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
    const { role, is_active } = body

    const serviceClient = createServiceClient()

    const updates: Record<string, unknown> = {}
    if (role !== undefined) updates.role = role
    if (is_active !== undefined) updates.is_active = is_active

    const { data: member, error } = await (serviceClient
      .from('organization_members') as any)
      .update(updates)
      .eq('id', memberId)
      .eq('organization_id', orgId)
      .select('*, user:profiles(*)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ member })
  } catch (error) {
    console.error('Member PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; memberId: string }> }
) {
  try {
    const { orgId, memberId } = await params
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

    const serviceClient = createServiceClient()

    // Get the member to check if they're trying to remove themselves
    const { data: member } = await (serviceClient
      .from('organization_members') as any)
      .select('user_id')
      .eq('id', memberId)
      .eq('organization_id', orgId)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Soft delete (deactivate) the membership
    const { error } = await (serviceClient
      .from('organization_members') as any)
      .update({ is_active: false })
      .eq('id', memberId)
      .eq('organization_id', orgId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Member DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
