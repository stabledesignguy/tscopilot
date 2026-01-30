import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { defaultSystemPrompt } from '@/lib/llm'
import { cookies } from 'next/headers'

const ORG_STORAGE_KEY = 'tscopilot_current_org_id'

async function getCurrentOrgId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(ORG_STORAGE_KEY)?.value || null
}

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getCurrentOrgId()
    if (!orgId) {
      return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
    }

    // Get system instructions for this organization
    const { data, error } = await (supabase
      .from('system_instructions') as any)
      .select('*')
      .eq('organization_id', orgId)
      .limit(1)

    if (error) {
      console.error('Error fetching system instructions:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const instruction = data?.[0]

    return NextResponse.json({
      instructions: instruction?.instructions || null,
      defaultInstructions: defaultSystemPrompt,
      updatedAt: instruction?.updated_at || null,
    })
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

    const orgId = await getCurrentOrgId()
    if (!orgId) {
      return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
    }

    // Check if user is org admin or super admin
    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_super_admin) {
      const { data: membership } = await (supabase
        .from('organization_members') as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .single()

      if (!membership || membership.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const body = await request.json()
    const { instructions } = body

    if (typeof instructions !== 'string') {
      return NextResponse.json(
        { error: 'Instructions must be a string' },
        { status: 400 }
      )
    }

    // Check if a record already exists for this organization
    const { data: existingData } = await (supabase
      .from('system_instructions') as any)
      .select('id')
      .eq('organization_id', orgId)
      .limit(1)

    const existing = existingData?.[0]

    let result
    if (existing) {
      // Update existing record for this organization
      result = await (supabase
        .from('system_instructions') as any)
        .update({
          instructions,
          updated_by: user.id,
        })
        .eq('id', existing.id)
        .select()
        .single()
    } else {
      // Insert new record for this organization
      result = await (supabase
        .from('system_instructions') as any)
        .insert({
          instructions,
          organization_id: orgId,
          updated_by: user.id,
        })
        .select()
        .single()
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      instructions: result.data.instructions,
      updatedAt: result.data.updated_at,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getCurrentOrgId()
    if (!orgId) {
      return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
    }

    // Check if user is org admin or super admin
    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_super_admin) {
      const { data: membership } = await (supabase
        .from('organization_members') as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .single()

      if (!membership || membership.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Delete system instructions for this organization only
    const { error } = await (supabase
      .from('system_instructions') as any)
      .delete()
      .eq('organization_id', orgId)

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
