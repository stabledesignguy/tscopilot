import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateEmbeddings } from '@/lib/rag/embeddings'

// Step-by-step debug of the retriever to find where it fails
export async function POST(request: NextRequest) {
  const results: Record<string, any> = {
    version: 'debug-steps-v1',
    steps: {}
  }

  try {
    const { query, productId } = await request.json()
    results.query = query
    results.productId = productId

    if (!query || !productId) {
      return NextResponse.json({ error: 'query and productId are required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Step 1: Check if documents exist for this product
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('id, filename')
      .eq('product_id', productId)

    results.steps.documents = {
      count: docs?.length || 0,
      error: docsError?.message || null,
      samples: docs?.slice(0, 3).map(d => d.filename) || []
    }

    // Step 2: Check if chunks exist for this product
    const { data: chunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select('id, document_id, content')
      .eq('product_id', productId)
      .limit(5)

    results.steps.chunks = {
      count: chunks?.length || 0,
      error: chunksError?.message || null,
      hasContent: chunks?.some(c => c.content && c.content.length > 0) || false
    }

    // Step 3: Count total chunks
    const { count: totalChunks } = await supabase
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', productId)

    results.steps.totalChunks = totalChunks

    // Step 4: Check if chunks have embeddings
    const { data: chunksWithEmbedding, error: embError } = await supabase
      .from('document_chunks')
      .select('id')
      .eq('product_id', productId)
      .not('embedding', 'is', null)
      .limit(1)

    results.steps.chunksWithEmbeddings = {
      hasAny: (chunksWithEmbedding?.length || 0) > 0,
      error: embError?.message || null
    }

    // Step 5: Try generating embedding for query
    let queryEmbedding: number[] | null = null
    try {
      queryEmbedding = await generateEmbeddings(query)
      results.steps.embedding = {
        success: true,
        dimensions: queryEmbedding.length
      }
    } catch (embGenError) {
      results.steps.embedding = {
        success: false,
        error: String(embGenError)
      }
    }

    // Step 6: Try vector search (match_documents)
    if (queryEmbedding) {
      const embeddingString = `[${queryEmbedding.map(v => v.toFixed(9)).join(',')}]`

      const { data: vectorData, error: vectorError } = await (supabase as any).rpc('match_documents', {
        query_embedding: embeddingString,
        match_threshold: 0.05,
        match_count: 10,
        filter_product_id: productId,
      })

      results.steps.vectorSearch = {
        count: vectorData?.length || 0,
        error: vectorError?.message || null,
        topScore: vectorData?.[0]?.similarity || null
      }
    }

    // Step 7: Try keyword search (same as retriever)
    const commonWords = new Set(['qual', 'quale', 'quali', 'cosa', 'come', 'dove', 'quando', 'perché', 'della', 'dello', 'delle', 'degli', 'nella', 'nello', 'nelle', 'negli', 'sono', 'essere', 'hanno', 'questa', 'questo', 'queste', 'questi', 'molto', 'anche', 'solo', 'ogni', 'tutto', 'tutti', 'prima', 'dopo', 'sempre', 'ancora', 'fatto', 'fare', 'macchina'])

    const keywords = query
      .toLowerCase()
      .replace(/[^\w\sàèéìòù]/g, ' ')
      .split(/\s+/)
      .filter((k: string) => k.length > 3 && !commonWords.has(k))
      .slice(0, 10)

    results.steps.keywords = keywords

    const { data: allChunks } = await supabase
      .from('document_chunks')
      .select('id, content')
      .eq('product_id', productId)
      .limit(1000)

    let keywordMatchCount = 0
    let targetFound = false

    for (const chunk of (allChunks || [])) {
      const content = chunk.content.toLowerCase()
      const matchCount = keywords.filter((k: string) => content.includes(k)).length
      if (matchCount > 0) {
        keywordMatchCount++
        if (content.includes('lunghezza') && content.includes('passerella') && content.includes('posteriore')) {
          targetFound = true
        }
      }
    }

    results.steps.keywordSearch = {
      totalChunksScanned: allChunks?.length || 0,
      matchingChunks: keywordMatchCount,
      targetChunkFound: targetFound
    }

    return NextResponse.json(results)
  } catch (error) {
    results.error = String(error)
    return NextResponse.json(results, { status: 500 })
  }
}
