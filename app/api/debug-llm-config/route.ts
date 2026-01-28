import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { productId } = await request.json()

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Get product's organization
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, organization_id')
      .eq('id', productId)
      .single()

    if (productError) {
      return NextResponse.json({ error: productError.message }, { status: 500 })
    }

    // Get organization settings
    const { data: settings, error: settingsError } = await supabase
      .from('organization_settings')
      .select('*')
      .eq('organization_id', product.organization_id)
      .single()

    // Get organization name
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', product.organization_id)
      .single()

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        organization_id: product.organization_id,
      },
      organization: {
        id: product.organization_id,
        name: org?.name || 'Unknown',
      },
      settings: settings || null,
      settingsError: settingsError?.message || null,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
