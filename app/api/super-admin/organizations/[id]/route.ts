import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
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

    const serviceClient = createServiceClient()

    // Get organization
    const { data: org, error } = await (serviceClient
      .from('organizations') as any)
      .select('*')
      .eq('id', id)
      .single()

    if (error || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get settings
    const { data: settings } = await (serviceClient
      .from('organization_settings') as any)
      .select('*')
      .eq('organization_id', id)
      .single()

    // Get members with user data
    const { data: members } = await (serviceClient
      .from('organization_members') as any)
      .select('*, user:profiles(*)')
      .eq('organization_id', id)
      .eq('is_active', true)
      .order('joined_at', { ascending: false })

    // Get stats
    const [productsCount, documentsCount, conversationsCount] = await Promise.all([
      (serviceClient
        .from('products') as any)
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', id),
      (serviceClient
        .from('documents') as any)
        .select('id', { count: 'exact', head: true })
        .eq('product_id', id), // This needs to be updated for org filtering
      (serviceClient
        .from('conversations') as any)
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', id),
    ])

    const organization = {
      ...(org as object),
      settings,
      members: members || [],
      stats: {
        products: productsCount.count || 0,
        documents: documentsCount.count || 0,
        conversations: conversationsCount.count || 0,
      },
    }

    return NextResponse.json({ organization })
  } catch (error) {
    console.error('Organization GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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

    const body = await request.json()
    const { name, slug, logo_url, is_active } = body

    const serviceClient = createServiceClient()

    // If slug is being changed, check for uniqueness
    if (slug) {
      const { data: existing } = await (serviceClient
        .from('organizations') as any)
        .select('id')
        .eq('slug', slug)
        .neq('id', id)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: 'An organization with this slug already exists' },
          { status: 400 }
        )
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updates.name = name
    if (slug !== undefined) updates.slug = slug
    if (logo_url !== undefined) updates.logo_url = logo_url
    if (is_active !== undefined) updates.is_active = is_active

    const { data: organization, error } = await (serviceClient
      .from('organizations') as any)
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ organization })
  } catch (error) {
    console.error('Organization PATCH error:', error)
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

    const serviceClient = createServiceClient()

    // Delete organization (cascades to settings, members, invitations)
    const { error } = await (serviceClient
      .from('organizations') as any)
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Organization DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
