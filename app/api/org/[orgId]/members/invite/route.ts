import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isSuperAdmin, isOrgAdmin } from '@/lib/auth/permissions'
import { sendInvitationEmail, sendAddedToOrgEmail } from '@/lib/email/resend'
import crypto from 'crypto'

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
    const { email, role = 'user' } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const serviceClient = createServiceClient()

    // Check if user already exists
    const { data: existingUser } = await (serviceClient
      .from('profiles') as any)
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      // Check if already a member
      const { data: existingMember } = await (serviceClient
        .from('organization_members') as any)
        .select('id, is_active')
        .eq('organization_id', orgId)
        .eq('user_id', (existingUser as any).id)
        .single()

      if (existingMember?.is_active) {
        return NextResponse.json(
          { error: 'User is already a member of this organization' },
          { status: 400 }
        )
      }

      // Get org name and inviter email for notification
      const { data: org } = await (serviceClient
        .from('organizations') as any)
        .select('name')
        .eq('id', orgId)
        .single()

      const { data: inviterProfile } = await (serviceClient
        .from('profiles') as any)
        .select('email')
        .eq('id', user.id)
        .single()

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''

      // If inactive, reactivate
      if (existingMember) {
        const { data: member, error } = await (serviceClient
          .from('organization_members') as any)
          .update({ is_active: true, role })
          .eq('id', (existingMember as any).id)
          .select('*')
          .single()

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Send notification email
        const emailSent = await sendAddedToOrgEmail({
          to: email,
          organizationName: org?.name || 'Organization',
          inviterEmail: inviterProfile?.email,
          role,
          appUrl: baseUrl,
        })

        return NextResponse.json({
          message: emailSent ? 'User added and notified.' : 'User added to organization.',
          member: { ...member, user: existingUser },
          existingUser: true,
          emailSent,
        })
      }

      // Add existing user directly
      const { data: member, error } = await (serviceClient
        .from('organization_members') as any)
        .insert({
          organization_id: orgId,
          user_id: (existingUser as any).id,
          role,
          invited_by: user.id,
        })
        .select('*')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Send notification email
      const emailSent = await sendAddedToOrgEmail({
        to: email,
        organizationName: org?.name || 'Organization',
        inviterEmail: inviterProfile?.email,
        role,
        appUrl: baseUrl,
      })

      return NextResponse.json({
        message: emailSent ? 'User added and notified.' : 'User added to organization.',
        member: { ...member, user: existingUser },
        existingUser: true,
        emailSent,
      })
    }

    // Check if invitation already exists
    const { data: existingInvite } = await (serviceClient
      .from('organization_invitations') as any)
      .select('id')
      .eq('organization_id', orgId)
      .eq('email', email)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email' },
        { status: 400 }
      )
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

    const { count: pendingCount } = await (serviceClient
      .from('organization_invitations') as any)
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())

    const totalPending = (memberCount || 0) + (pendingCount || 0)
    if (settings?.max_users && totalPending >= (settings as any).max_users) {
      return NextResponse.json(
        { error: 'Organization has reached maximum user limit' },
        { status: 400 }
      )
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

    // Create invitation
    const { data: invitation, error } = await (serviceClient
      .from('organization_invitations') as any)
      .insert({
        organization_id: orgId,
        email,
        role,
        token,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get organization name for the invitation link
    const { data: org } = await (serviceClient
      .from('organizations') as any)
      .select('name')
      .eq('id', orgId)
      .single()

    // Get inviter's email
    const { data: inviterProfile } = await (serviceClient
      .from('profiles') as any)
      .select('email')
      .eq('id', user.id)
      .single()

    // Generate invitation URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''
    const invitationUrl = `${baseUrl}/invitation/${token}`

    // Send invitation email
    const emailSent = await sendInvitationEmail({
      to: email,
      organizationName: org?.name || 'Organization',
      inviterEmail: inviterProfile?.email,
      role,
      invitationUrl,
      expiresAt,
    })

    return NextResponse.json({
      invitation,
      invitationUrl,
      organizationName: org?.name,
      emailSent,
      message: emailSent
        ? 'Invitation sent successfully.'
        : 'Invitation created but email could not be sent. Share the link manually.',
    }, { status: 201 })
  } catch (error) {
    console.error('Invite error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
