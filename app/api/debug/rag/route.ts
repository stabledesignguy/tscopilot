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

    // Get chunk counts for each document
    const docIds = documents?.map(d => d.id) || []
    const chunkCounts: Record<string, number> = {}

    if (docIds.length > 0) {
      for (const docId of docIds) {
        const { count } = await supabase
          .from('document_chunks')
          .select('*', { count: 'exact', head: true })
          .eq('document_id', docId)
        chunkCounts[docId] = count || 0
      }
    }

    // Build response
    const documentsWithCounts = documents?.map(doc => ({
      ...doc,
      chunk_count: chunkCounts[doc.id] || 0,
      product_name: products?.find(p => p.id === doc.product_id)?.name || 'Unknown'
    }))

    return NextResponse.json({
      products,
      documents: documentsWithCounts,
      total_documents: documents?.length || 0,
    })
  } catch (error) {
    console.error('Debug RAG error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
