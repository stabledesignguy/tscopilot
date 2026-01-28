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

    // Check if user is org admin or super admin
    const isSuperAdminUser = await isSuperAdmin(user.id)
    const isAdmin = await isOrgAdmin(user.id, orgId)

    if (!isSuperAdminUser && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const serviceClient = createServiceClient()

    const { data: settings, error } = await (serviceClient
      .from('organization_settings') as any)
      .select('*')
      .eq('organization_id', orgId)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ settings: settings || null })
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
    const {
      llm_provider,
      llm_model,
      system_instructions,
      max_users,
      max_products,
    } = body

    const serviceClient = createServiceClient()

    // Check if settings exist
    const { data: existing } = await (serviceClient
      .from('organization_settings') as any)
      .select('id')
      .eq('organization_id', orgId)
      .single()

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (llm_provider !== undefined) updates.llm_provider = llm_provider || null
    if (llm_model !== undefined) updates.llm_model = llm_model || null
    if (system_instructions !== undefined) updates.system_instructions = system_instructions || null
    if (max_users !== undefined) updates.max_users = max_users
    if (max_products !== undefined) updates.max_products = max_products

    let settings
    let error

    if (existing) {
      const result = await (serviceClient
        .from('organization_settings') as any)
        .update(updates)
        .eq('organization_id', orgId)
        .select()
        .single()

      settings = result.data
      error = result.error
    } else {
      const result = await (serviceClient
        .from('organization_settings') as any)
        .insert({
          organization_id: orgId,
          ...updates,
        })
        .select()
        .single()

      settings = result.data
      error = result.error
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Settings PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
