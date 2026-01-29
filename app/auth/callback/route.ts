import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Accept any pending organization invitations for the user
 */
async function acceptPendingInvitations(userId: string, userEmail: string) {
  const serviceClient = createServiceClient()

  // Find pending invitations for this email
  const { data: invitations } = await (serviceClient
    .from('organization_invitations') as any)
    .select('*')
    .eq('email', userEmail.toLowerCase())
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())

  if (!invitations || invitations.length === 0) {
    return
  }

  for (const invitation of invitations) {
    // Check if already a member
    const { data: existingMember } = await (serviceClient
      .from('organization_members') as any)
      .select('id, is_active')
      .eq('organization_id', invitation.organization_id)
      .eq('user_id', userId)
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
          user_id: userId,
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
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'
  const error_description = searchParams.get('error_description')

  // If Supabase sent an error, pass it through
  if (error_description) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error_description)}`)
  }

  const supabase = await createClient()
  let authSuccess = false
  let authError: string | null = null

  // Handle OAuth code exchange (e.g., Google, GitHub login)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      authSuccess = true
    } else {
      authError = error.message
    }
  }

  // Handle email confirmation/verification tokens (signup, invite, magiclink)
  if (!authSuccess && token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'signup' | 'email' | 'recovery' | 'invite' | 'magiclink',
    })
    if (!error) {
      authSuccess = true
    } else {
      authError = error.message
    }
  }

  if (authSuccess) {
    // Get the authenticated user
    const { data: { user } } = await supabase.auth.getUser()

    if (user?.email) {
      // Auto-accept any pending organization invitations
      await acceptPendingInvitations(user.id, user.email)
    }

    return NextResponse.redirect(`${origin}${next}`)
  }

  // Build error message for debugging
  const errorMsg = authError || 'No auth parameters received'
  const debugInfo = `code=${!!code}&token_hash=${!!token_hash}&type=${type || 'none'}`

  return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(errorMsg)}&debug=${encodeURIComponent(debugInfo)}`)
}
