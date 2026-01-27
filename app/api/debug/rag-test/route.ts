import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateEmbeddings } from '@/lib/rag/embeddings'

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
    const query = searchParams.get('query') || 'weight and dimensions'

    if (!productId) {
      return NextResponse.json({
        error: 'productId is required',
        usage: '/api/debug/rag-test?productId=XXX&query=your+question'
      }, { status: 400 })
    }

    const results: any = {
      productId,
      query,
      steps: []
    }

    // Step 1: Generate embedding
    try {
      results.steps.push({ step: 1, name: 'Generate embedding', status: 'starting' })
      const queryEmbedding = await generateEmbeddings(query)
      results.steps[0].status = 'success'
      results.steps[0].embedding_length = queryEmbedding.length
      results.embedding_sample = queryEmbedding.slice(0, 5)
    } catch (err: any) {
      results.steps[0].status = 'failed'
      results.steps[0].error = err.message
      return NextResponse.json(results)
    }

    // Step 2: Try vector search with match_documents
    const serviceClient = await createServiceClient()
    try {
      results.steps.push({ step: 2, name: 'Vector search (match_documents)', status: 'starting' })

      const queryEmbedding = await generateEmbeddings(query)
      const embeddingString = `[${queryEmbedding.map(v => v.toFixed(9)).join(',')}]`

      const { data, error } = await serviceClient.rpc('match_documents', {
        query_embedding: embeddingString,
        match_threshold: 0.3,
        match_count: 5,
        filter_product_id: productId,
      })

      if (error) {
        results.steps[1].status = 'failed'
        results.steps[1].error = error.message
        results.steps[1].error_details = error
      } else {
        results.steps[1].status = 'success'
        results.steps[1].results_count = data?.length || 0
        results.steps[1].results = data?.map((r: any) => ({
          id: r.id,
          document_id: r.document_id,
          similarity: r.similarity,
          content_preview: r.content?.substring(0, 200) + '...'
        }))
      }
    } catch (err: any) {
      results.steps[1].status = 'exception'
      results.steps[1].error = err.message
    }

    // Step 3: Try direct chunk query (bypass vector search)
    try {
      results.steps.push({ step: 3, name: 'Direct chunk query (no vector)', status: 'starting' })

      const { data, error } = await serviceClient
        .from('document_chunks')
        .select('id, document_id, content, product_id')
        .eq('product_id', productId)
        .limit(3)

      if (error) {
        results.steps[2].status = 'failed'
        results.steps[2].error = error.message
      } else {
        results.steps[2].status = 'success'
        results.steps[2].results_count = data?.length || 0
        results.steps[2].results = data?.map((r: any) => ({
          id: r.id,
          document_id: r.document_id,
          product_id: r.product_id,
          content_preview: r.content?.substring(0, 200) + '...'
        }))
      }
    } catch (err: any) {
      results.steps[2].status = 'exception'
      results.steps[2].error = err.message
    }

    // Step 4: Check if chunks exist for this product with text search
    try {
      results.steps.push({ step: 4, name: 'Text search fallback', status: 'starting' })

      const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2)

      const { data, error } = await serviceClient
        .from('document_chunks')
        .select('id, document_id, content')
        .eq('product_id', productId)
        .limit(50)

      if (error) {
        results.steps[3].status = 'failed'
        results.steps[3].error = error.message
      } else {
        // Score by keyword matches
        const scored = (data || [])
          .map((chunk: any) => {
            const content = chunk.content.toLowerCase()
            const matchCount = keywords.filter(k => content.includes(k)).length
            return { ...chunk, score: matchCount / keywords.length }
          })
          .filter(c => c.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)

        results.steps[3].status = 'success'
        results.steps[3].keywords = keywords
        results.steps[3].total_chunks_checked = data?.length || 0
        results.steps[3].matching_chunks = scored.length
        results.steps[3].results = scored.map((r: any) => ({
          id: r.id,
          document_id: r.document_id,
          score: r.score,
          content_preview: r.content?.substring(0, 200) + '...'
        }))
      }
    } catch (err: any) {
      results.steps[3].status = 'exception'
      results.steps[3].error = err.message
    }

    return NextResponse.json(results)
  } catch (error: any) {
    console.error('Debug RAG test error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
