import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const serviceClient = createServiceClient()

    // Find pending invitations for this email
    const { data: invitations } = await (serviceClient
      .from('organization_invitations') as any)
      .select('*')
      .eq('email', user.email.toLowerCase())
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())

    if (!invitations || invitations.length === 0) {
      return NextResponse.json({ message: 'No pending invitations' })
    }

    let acceptedCount = 0

    for (const invitation of invitations) {
      // Check if already a member
      const { data: existingMember } = await (serviceClient
        .from('organization_members') as any)
        .select('id, is_active')
        .eq('organization_id', invitation.organization_id)
        .eq('user_id', user.id)
        .single()

      if (existingMember?.is_active) {
        // Already a member, just mark invitation as accepted
        await (serviceClient
          .from('organization_invitations') as any)
          .update({ accepted_at: new Date().toISOString() })
          .eq('id', invitation.id)
        continue
      }

      if (existingMember) {
        // Reactivate membership
        await (serviceClient
          .from('organization_members') as any)
          .update({ is_active: true, role: invitation.role })
          .eq('id', existingMember.id)
      } else {
        // Create new membership
        await (serviceClient
          .from('organization_members') as any)
          .insert({
            organization_id: invitation.organization_id,
            user_id: user.id,
            role: invitation.role,
            invited_by: invitation.invited_by,
            is_active: true,
          })
      }

      // Mark invitation as accepted
      await (serviceClient
        .from('organization_invitations') as any)
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)

      acceptedCount++
    }

    return NextResponse.json({
      message: `Accepted ${acceptedCount} invitation(s)`,
      acceptedCount,
    })
  } catch (error) {
    console.error('Accept invitations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
