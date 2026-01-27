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

    // Step 2: Try vector search
    const serviceClient = await createServiceClient()
    const queryEmbedding = await generateEmbeddings(query)
    const embeddingString = `[${queryEmbedding.map(v => v.toFixed(9)).join(',')}]`

    try {
      results.steps.push({ step: 2, name: 'Vector search (threshold=0.3)', status: 'starting' })

      const { data, error } = await serviceClient.rpc('match_documents', {
        query_embedding: embeddingString,
        match_threshold: 0.3,
        match_count: 5,
        filter_product_id: productId,
      })

      if (error) {
        results.steps[1].status = 'failed'
        results.steps[1].error = error.message
      } else {
        results.steps[1].status = 'success'
        results.steps[1].results_count = data?.length || 0
        results.steps[1].results = data?.map((r: any) => ({
          id: r.id,
          similarity: r.similarity,
          content_preview: r.content?.substring(0, 100) + '...'
        }))
      }
    } catch (err: any) {
      results.steps[1].status = 'exception'
      results.steps[1].error = err.message
    }

    // Step 3: Compute raw similarity scores directly via SQL
    try {
      results.steps.push({ step: 3, name: 'Raw similarity check', status: 'starting' })

      // Get a few chunks and compute similarity manually
      const { data: rawData, error: rawError } = await serviceClient.rpc('debug_similarity', {
        query_embedding: embeddingString,
        filter_product_id: productId,
        check_count: 5,
      })

      if (rawError) {
        // Function might not exist, try raw query
        const { data: chunks } = await serviceClient
          .from('document_chunks')
          .select('id, embedding')
          .eq('product_id', productId)
          .not('embedding', 'is', null)
          .limit(3)

        results.steps[2].status = 'info'
        results.steps[2].message = 'debug_similarity function not found'
        results.steps[2].chunks_with_embeddings = chunks?.length || 0
        results.steps[2].first_chunk_embedding_sample = chunks?.[0]?.embedding?.slice(0, 5)
      } else {
        results.steps[2].status = 'success'
        results.steps[2].results = rawData
      }
    } catch (err: any) {
      results.steps[2].status = 'exception'
      results.steps[2].error = err.message
    }

    // Step 4: Direct chunk query (bypass vector search)
    try {
      results.steps.push({ step: 4, name: 'Direct chunk query (no vector)', status: 'starting' })

      const { data, error } = await serviceClient
        .from('document_chunks')
        .select('id, document_id, content, product_id')
        .eq('product_id', productId)
        .limit(3)

      if (error) {
        results.steps[3].status = 'failed'
        results.steps[3].error = error.message
      } else {
        results.steps[3].status = 'success'
        results.steps[3].results_count = data?.length || 0
        results.steps[3].results = data?.map((r: any) => ({
          id: r.id,
          document_id: r.document_id,
          product_id: r.product_id,
          content_preview: r.content?.substring(0, 200) + '...'
        }))
      }
    } catch (err: any) {
      results.steps[3].status = 'exception'
      results.steps[3].error = err.message
    }

    // Step 5: Text search fallback
    try {
      results.steps.push({ step: 5, name: 'Text search fallback', status: 'starting' })

      const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2)

      const { data, error } = await serviceClient
        .from('document_chunks')
        .select('id, document_id, content')
        .eq('product_id', productId)
        .limit(50)

      if (error) {
        results.steps[4].status = 'failed'
        results.steps[4].error = error.message
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

        results.steps[4].status = 'success'
        results.steps[4].keywords = keywords
        results.steps[4].total_chunks_checked = data?.length || 0
        results.steps[4].matching_chunks = scored.length
        results.steps[4].results = scored.map((r: any) => ({
          id: r.id,
          document_id: r.document_id,
          score: r.score,
          content_preview: r.content?.substring(0, 200) + '...'
        }))
      }
    } catch (err: any) {
      results.steps[4].status = 'exception'
      results.steps[4].error = err.message
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
