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

    // Step 2: Try vector search with different thresholds
    const serviceClient = await createServiceClient()
    const queryEmbedding = await generateEmbeddings(query)
    const embeddingString = `[${queryEmbedding.map(v => v.toFixed(9)).join(',')}]`

    // Try multiple thresholds
    const thresholds = [0.3, 0.2, 0.1, 0.0]
    for (const threshold of thresholds) {
      try {
        const stepIndex = results.steps.length
        results.steps.push({ step: stepIndex + 1, name: `Vector search (threshold=${threshold})`, status: 'starting' })

        const { data, error } = await serviceClient.rpc('match_documents', {
          query_embedding: embeddingString,
          match_threshold: threshold,
          match_count: 5,
          filter_product_id: productId,
        })

        if (error) {
          results.steps[stepIndex].status = 'failed'
          results.steps[stepIndex].error = error.message
        } else {
          results.steps[stepIndex].status = 'success'
          results.steps[stepIndex].results_count = data?.length || 0
          if (data && data.length > 0) {
            results.steps[stepIndex].results = data.map((r: any) => ({
              id: r.id,
              document_id: r.document_id,
              similarity: r.similarity,
              content_preview: r.content?.substring(0, 200) + '...'
            }))
            break // Found results, stop trying lower thresholds
          }
        }
      } catch (err: any) {
        results.steps[results.steps.length - 1].status = 'exception'
        results.steps[results.steps.length - 1].error = err.message
      }
    }

    // Direct chunk query (bypass vector search)
    try {
      const stepIndex = results.steps.length
      results.steps.push({ step: stepIndex + 1, name: 'Direct chunk query (no vector)', status: 'starting' })

      const { data, error } = await serviceClient
        .from('document_chunks')
        .select('id, document_id, content, product_id')
        .eq('product_id', productId)
        .limit(3)

      if (error) {
        results.steps[stepIndex].status = 'failed'
        results.steps[stepIndex].error = error.message
      } else {
        results.steps[stepIndex].status = 'success'
        results.steps[stepIndex].results_count = data?.length || 0
        results.steps[stepIndex].results = data?.map((r: any) => ({
          id: r.id,
          document_id: r.document_id,
          product_id: r.product_id,
          content_preview: r.content?.substring(0, 200) + '...'
        }))
      }
    } catch (err: any) {
      results.steps[results.steps.length - 1].status = 'exception'
      results.steps[results.steps.length - 1].error = err.message
    }

    // Text search fallback
    try {
      const stepIndex = results.steps.length
      results.steps.push({ step: stepIndex + 1, name: 'Text search fallback', status: 'starting' })

      const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2)

      const { data, error } = await serviceClient
        .from('document_chunks')
        .select('id, document_id, content')
        .eq('product_id', productId)
        .limit(50)

      if (error) {
        results.steps[stepIndex].status = 'failed'
        results.steps[stepIndex].error = error.message
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

        results.steps[stepIndex].status = 'success'
        results.steps[stepIndex].keywords = keywords
        results.steps[stepIndex].total_chunks_checked = data?.length || 0
        results.steps[stepIndex].matching_chunks = scored.length
        results.steps[stepIndex].results = scored.map((r: any) => ({
          id: r.id,
          document_id: r.document_id,
          score: r.score,
          content_preview: r.content?.substring(0, 200) + '...'
        }))
      }
    } catch (err: any) {
      results.steps[results.steps.length - 1].status = 'exception'
      results.steps[results.steps.length - 1].error = err.message
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
