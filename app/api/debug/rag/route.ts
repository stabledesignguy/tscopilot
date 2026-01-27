import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const filename = searchParams.get('filename')

    // Get all products
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .order('name')

    // Get documents, optionally filtered
    let docsQuery = supabase
      .from('documents')
      .select('id, product_id, filename, processing_status, created_at')
      .order('created_at', { ascending: false })

    if (productId) {
      docsQuery = docsQuery.eq('product_id', productId)
    }
    if (filename) {
      docsQuery = docsQuery.ilike('filename', `%${filename}%`)
    }

    const { data: documents } = await docsQuery.limit(20)

    // Get chunk info for each document - check product_id and embedding status
    const docIds = documents?.map(d => d.id) || []
    const chunkInfo: Record<string, { total: number; with_product_id: number; with_embedding: number }> = {}

    if (docIds.length > 0) {
      for (const docId of docIds) {
        // Total chunks
        const { count: total } = await supabase
          .from('document_chunks')
          .select('*', { count: 'exact', head: true })
          .eq('document_id', docId)

        // Chunks with product_id set
        const { count: withProductId } = await supabase
          .from('document_chunks')
          .select('*', { count: 'exact', head: true })
          .eq('document_id', docId)
          .not('product_id', 'is', null)

        // Chunks with embedding set
        const { count: withEmbedding } = await supabase
          .from('document_chunks')
          .select('*', { count: 'exact', head: true })
          .eq('document_id', docId)
          .not('embedding', 'is', null)

        chunkInfo[docId] = {
          total: total || 0,
          with_product_id: withProductId || 0,
          with_embedding: withEmbedding || 0,
        }
      }
    }

    // Build response
    const documentsWithCounts = documents?.map(doc => ({
      ...doc,
      chunks: chunkInfo[doc.id] || { total: 0, with_product_id: 0, with_embedding: 0 },
      product_name: products?.find(p => p.id === doc.product_id)?.name || 'Unknown'
    }))

    // Check if any chunks have product_id directly (migration status)
    const { count: chunksWithProductId } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .not('product_id', 'is', null)

    const { count: totalChunks } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      products,
      documents: documentsWithCounts,
      total_documents: documents?.length || 0,
      migration_status: {
        total_chunks: totalChunks || 0,
        chunks_with_product_id: chunksWithProductId || 0,
        migration_complete: (chunksWithProductId || 0) === (totalChunks || 0) && (totalChunks || 0) > 0,
      }
    })
  } catch (error) {
    console.error('Debug RAG error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
