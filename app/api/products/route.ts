import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const ORG_STORAGE_KEY = 'tscopilot_current_org_id'

// Helper to get current org ID from cookie
async function getCurrentOrgId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(ORG_STORAGE_KEY)?.value || null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get org ID from query param or cookie
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('organizationId') || await getCurrentOrgId()

    let query = (supabase.from('products') as any)
      .select('*, group:groups(id, name)')
      .order('name', { ascending: true })

    // Filter by organization if provided
    if (orgId) {
      query = query.eq('organization_id', orgId)
    }

    const { data: products, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ products })
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

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, image_url, group_id, organization_id } = body

    // Get org ID from body or cookie
    const orgId = organization_id || await getCurrentOrgId()

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // Check if user is org admin or super admin
    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_super_admin) {
      // Check org membership and role
      const { data: membership } = await (supabase
        .from('organization_members') as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .single()

      if (membership?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      )
    }

    const { data: product, error } = await (supabase
      .from('products') as any)
      .insert({
        name,
        description,
        image_url,
        group_id: group_id || null,
        organization_id: orgId,
      })
      .select('*, group:groups(id, name)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    // Get the product to check its organization
    const { data: existingProduct } = await supabase
      .from('products')
      .select('organization_id')
      .eq('id', id)
      .single()

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Check if user has permission
    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    const existingProductOrgId = (existingProduct as any).organization_id
    if (!profile?.is_super_admin && existingProductOrgId) {
      const { data: membership } = await (supabase
        .from('organization_members') as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', existingProductOrgId)
        .eq('is_active', true)
        .single()

      if (membership?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const body = await request.json()
    const { name, description, image_url, group_id } = body

    const { data: product, error } = await (supabase
      .from('products') as any)
      .update({
        name,
        description,
        image_url,
        group_id: group_id === undefined ? undefined : (group_id || null),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, group:groups(id, name)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ product })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    // Get the product to check its organization
    const { data: existingProduct } = await supabase
      .from('products')
      .select('organization_id')
      .eq('id', id)
      .single()

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Check if user has permission
    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    const deleteProductOrgId = (existingProduct as any).organization_id
    if (!profile?.is_super_admin && deleteProductOrgId) {
      const { data: membership } = await (supabase
        .from('organization_members') as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', deleteProductOrgId)
        .eq('is_active', true)
        .single()

      if (membership?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Delete associated documents and chunks
    const { data: documents } = await (supabase
      .from('documents') as any)
      .select('id')
      .eq('product_id', id)

    if (documents) {
      for (const doc of documents as any[]) {
        await supabase.from('document_chunks').delete().eq('document_id', doc.id)
      }
      await supabase.from('documents').delete().eq('product_id', id)
    }

    // Delete conversations and messages
    const { data: conversations } = await (supabase
      .from('conversations') as any)
      .select('id')
      .eq('product_id', id)

    if (conversations) {
      for (const conv of conversations as any[]) {
        await supabase.from('messages').delete().eq('conversation_id', conv.id)
      }
      await supabase.from('conversations').delete().eq('product_id', id)
    }

    // Delete product
    const { error } = await supabase.from('products').delete().eq('id', id)

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
