import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { isSuperAdmin, isOrgAdmin } from '@/lib/auth/permissions'
import { sendAddedToOrgEmail } from '@/lib/email/resend'
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

    // Get organization name for the invitation
    const { data: org } = await (serviceClient
      .from('organizations') as any)
      .select('name')
      .eq('id', orgId)
      .single()

    // Generate invitation token for tracking
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

    // Create invitation record to track org/role
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

    // Use Supabase Admin to invite the user
    // This creates their account and sends an invite email in one step
    // When they click the link and set their password, they'll be logged in automatically
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${baseUrl}/auth/callback`,
      data: {
        organization_id: orgId,
        organization_name: org?.name,
        role: role,
        invitation_token: token,
      }
    })

    if (inviteError) {
      // Clean up the invitation record if Supabase invite fails
      await (serviceClient
        .from('organization_invitations') as any)
        .delete()
        .eq('id', invitation.id)

      return NextResponse.json({ error: inviteError.message }, { status: 500 })
    }

    return NextResponse.json({
      invitation,
      organizationName: org?.name,
      emailSent: true,
      message: 'Invitation sent successfully. The user will receive an email to set up their account.',
    }, { status: 201 })
  } catch (error) {
    console.error('Invite error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
