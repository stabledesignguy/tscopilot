import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const orgName = searchParams.get('org')

  try {
    const supabase = createServiceClient()

    // Find organization by name
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .ilike('name', `%${orgName || ''}%`)

    if (!orgs || orgs.length === 0) {
      // List all orgs
      const { data: allOrgs } = await supabase
        .from('organizations')
        .select('id, name')
      return NextResponse.json({ error: 'Org not found', availableOrgs: allOrgs })
    }

    const org = orgs[0]

    // Get products for this org
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .eq('organization_id', org.id)

    // Get documents for these products
    const productIds = products?.map(p => p.id) || []
    const { data: documents } = await supabase
      .from('documents')
      .select('id, filename, file_url, product_id, processing_status')
      .in('product_id', productIds)

    // Get chunk counts
    const { data: chunks } = await supabase
      .from('document_chunks')
      .select('id, document_id, metadata')
      .in('product_id', productIds)
      .limit(10)

    return NextResponse.json({
      organization: org,
      products: products?.map(p => ({
        ...p,
        documentCount: documents?.filter(d => d.product_id === p.id).length || 0
      })),
      documents: documents?.map(d => ({
        id: d.id,
        filename: d.filename,
        hasFileUrl: !!d.file_url,
        fileUrlPreview: d.file_url ? d.file_url.slice(0, 80) + '...' : null,
        status: d.processing_status
      })),
      sampleChunks: chunks?.map(c => ({
        id: c.id,
        document_id: c.document_id,
        hasMetadata: !!c.metadata,
        metadataKeys: c.metadata ? Object.keys(c.metadata) : []
      }))
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
