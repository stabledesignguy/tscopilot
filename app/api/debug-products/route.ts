import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()

    // Get all products with document counts
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, name, organization_id')

    // Get all documents
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, filename, product_id, processing_status')

    // Get chunk counts per product
    const { data: chunkCounts } = await supabase
      .from('document_chunks')
      .select('product_id')

    const chunksByProduct: Record<string, number> = {}
    for (const chunk of (chunkCounts || [])) {
      chunksByProduct[chunk.product_id] = (chunksByProduct[chunk.product_id] || 0) + 1
    }

    return NextResponse.json({
      version: 'debug-products-v1',
      products: products?.map(p => ({
        id: p.id,
        name: p.name,
        organization_id: p.organization_id,
        chunkCount: chunksByProduct[p.id] || 0
      })) || [],
      documents: documents?.map(d => ({
        id: d.id,
        filename: d.filename,
        product_id: d.product_id,
        status: d.processing_status
      })) || [],
      totalChunks: chunkCounts?.length || 0,
      errors: {
        products: prodError?.message || null,
        documents: docError?.message || null
      }
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
