import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET - Get invitation details by token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    const serviceClient = createServiceClient()

    const { data: invitation, error } = await (serviceClient
      .from('organization_invitations') as any)
      .select('*, organization:organizations(name, slug, logo_url)')
      .eq('token', token)
      .is('accepted_at', null)
      .single()

    if (error || !invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 404 }
      )
    }

    // Check if expired
    if (new Date((invitation as any).expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 410 }
      )
    }

    return NextResponse.json({
      invitation: {
        email: (invitation as any).email,
        role: (invitation as any).role,
        organization: (invitation as any).organization,
        expires_at: (invitation as any).expires_at,
      },
    })
  } catch (error) {
    console.error('Invitation GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Accept invitation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const serviceClient = createServiceClient()

    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // Get the invitation
    const { data: invitation, error: inviteError } = await (serviceClient
      .from('organization_invitations') as any)
      .select('*')
      .eq('token', token)
      .is('accepted_at', null)
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 404 }
      )
    }

    // Check if expired
    if (new Date((invitation as any).expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 410 }
      )
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'You must be logged in to accept this invitation' },
        { status: 401 }
      )
    }

    // Check if user's email matches invitation email
    const { data: profile } = await (serviceClient
      .from('profiles') as any)
      .select('email')
      .eq('id', user.id)
      .single()

    if (profile?.email.toLowerCase() !== (invitation as any).email.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address' },
        { status: 403 }
      )
    }

    // Check if already a member
    const { data: existingMember } = await (serviceClient
      .from('organization_members') as any)
      .select('id, is_active')
      .eq('organization_id', (invitation as any).organization_id)
      .eq('user_id', user.id)
      .single()

    if (existingMember?.is_active) {
      // Already a member, just mark invitation as accepted
      await (serviceClient
        .from('organization_invitations') as any)
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', (invitation as any).id)

      return NextResponse.json({
        message: 'You are already a member of this organization',
        organizationId: (invitation as any).organization_id,
      })
    }

    // Add user to organization
    if (existingMember) {
      // Reactivate membership
      await (serviceClient
        .from('organization_members') as any)
        .update({
          is_active: true,
          role: (invitation as any).role,
        })
        .eq('id', existingMember.id)
    } else {
      // Create new membership
      const { error: memberError } = await (serviceClient
        .from('organization_members') as any)
        .insert({
          organization_id: (invitation as any).organization_id,
          user_id: user.id,
          role: (invitation as any).role,
          invited_by: (invitation as any).invited_by,
        })

      if (memberError) {
        return NextResponse.json({ error: memberError.message }, { status: 500 })
      }
    }

    // Mark invitation as accepted
    await (serviceClient
      .from('organization_invitations') as any)
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', (invitation as any).id)

    return NextResponse.json({
      message: 'Invitation accepted successfully',
      organizationId: (invitation as any).organization_id,
    })
  } catch (error) {
    console.error('Invitation POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
