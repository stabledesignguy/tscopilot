import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Prevent self-modification for critical actions
    if (id === user.id) {
      return NextResponse.json(
        { error: 'Cannot modify your own account' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { action, is_active } = body

    const serviceClient = createServiceClient()

    // Handle different actions
    if (action === 'revoke_all_access') {
      // Remove user from all organizations
      const { error } = await (serviceClient
        .from('organization_members') as any)
        .update({ is_active: false })
        .eq('user_id', id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Also delete any pending invitations for this user's email
      const { data: targetUser } = await (serviceClient
        .from('profiles') as any)
        .select('email')
        .eq('id', id)
        .single()

      if (targetUser?.email) {
        await (serviceClient
          .from('organization_invitations') as any)
          .delete()
          .eq('email', targetUser.email)
          .is('accepted_at', null)
      }

      return NextResponse.json({
        success: true,
        message: 'User removed from all organizations'
      })
    }

    if (action === 'deactivate' || is_active !== undefined) {
      // Deactivate/reactivate user account
      const newStatus = action === 'deactivate' ? false : (is_active ?? false)

      const { data: updatedUser, error } = await (serviceClient
        .from('profiles') as any)
        .update({ is_active: newStatus })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // If deactivating, also revoke all org access
      if (!newStatus) {
        await (serviceClient
          .from('organization_members') as any)
          .update({ is_active: false })
          .eq('user_id', id)
      }

      return NextResponse.json({
        success: true,
        user: updatedUser,
        message: newStatus ? 'User account activated' : 'User account deactivated'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('User PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Prevent self-deletion
    if (id === user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    const serviceClient = createServiceClient()

    // Get user email before deletion for cleanup
    const { data: targetUser } = await (serviceClient
      .from('profiles') as any)
      .select('email')
      .eq('id', id)
      .single()

    // Delete from organization_members (cascade should handle this, but be explicit)
    await (serviceClient
      .from('organization_members') as any)
      .delete()
      .eq('user_id', id)

    // Delete pending invitations for this email
    if (targetUser?.email) {
      await (serviceClient
        .from('organization_invitations') as any)
        .delete()
        .eq('email', targetUser.email)
    }

    // Delete conversations and messages for this user
    const { data: conversations } = await (serviceClient
      .from('conversations') as any)
      .select('id')
      .eq('user_id', id)

    if (conversations && conversations.length > 0) {
      const conversationIds = conversations.map((c: any) => c.id)
      await (serviceClient
        .from('messages') as any)
        .delete()
        .in('conversation_id', conversationIds)

      await (serviceClient
        .from('conversations') as any)
        .delete()
        .eq('user_id', id)
    }

    // Delete the profile
    const { error: profileError } = await (serviceClient
      .from('profiles') as any)
      .delete()
      .eq('id', id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // Delete from Supabase Auth
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error: authError } = await adminClient.auth.admin.deleteUser(id)

    if (authError) {
      console.error('Auth deletion error:', authError)
      // Profile is already deleted, so we continue
    }

    return NextResponse.json({
      success: true,
      message: 'User permanently deleted'
    })
  } catch (error) {
    console.error('User DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
