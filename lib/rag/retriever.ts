import { createServiceClient } from '@/lib/supabase/server'
import { generateEmbeddings } from './embeddings'
import type { ChunkWithScore, DocumentChunk } from '@/types'

export interface DocumentSource {
  id: string
  filename: string
  file_url: string
}

export interface ChunkWithSource extends ChunkWithScore {
  document?: DocumentSource
}

export async function retrieveRelevantChunks(
  query: string,
  productId: string,
  limit: number = 5,
  threshold: number = 0.3
): Promise<ChunkWithSource[]> {
  const supabase = await createServiceClient()

  // Debug: Check if chunks have product_id populated for this product
  const { data: chunkCheck } = await supabase
    .from('document_chunks')
    .select('id, product_id, document_id')
    .eq('product_id', productId)
    .limit(1)

  const { count: totalChunksForProduct } = await supabase
    .from('document_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', productId)

  console.log(`DEBUG - Chunks with product_id=${productId}: ${totalChunksForProduct || 0}`)
  console.log(`DEBUG - Sample chunk:`, chunkCheck?.[0] || 'none found')

  // Generate embedding for the query
  console.log('DEBUG - Generating query embedding for:', query.slice(0, 50))
  let queryEmbedding: number[]
  try {
    queryEmbedding = await generateEmbeddings(query)
    console.log('DEBUG - Query embedding generated, length:', queryEmbedding.length)
  } catch (embeddingError) {
    console.error('DEBUG - EMBEDDING GENERATION FAILED:', embeddingError)
    throw embeddingError
  }

  // Use pgvector similarity search
  // This requires the match_documents function to be created in Supabase
  console.log('Vector search: filtering by product_id:', productId)
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
    filter_product_id: productId,
  })

  if (error) {
    console.error('Vector search error:', error)
    console.log('Falling back to text search for product:', productId)
    // Fallback to basic text search if vector search fails
    return fallbackTextSearch(query, productId, limit)
  }

  console.log('Vector search returned', data?.length || 0, 'results for product:', productId)

  // Debug: Log the actual chunk details to verify product filtering
  if (data && data.length > 0) {
    console.log('DEBUG - Returned chunks:')
    for (const item of data) {
      console.log(`  - Chunk ID: ${item.id}, Doc ID: ${item.document_id}, Similarity: ${item.similarity?.toFixed(3)}`)
    }
  }

  // Get unique document IDs
  const documentIds = [...new Set((data || []).map((item: any) => item.document_id))]

  // Debug: Verify documents belong to the correct product
  const { data: docsWithProduct } = await supabase
    .from('documents')
    .select('id, filename, product_id')
    .in('id', documentIds)

  if (docsWithProduct) {
    console.log('DEBUG - Documents for returned chunks:')
    for (const doc of docsWithProduct) {
      const matchesProduct = doc.product_id === productId
      console.log(`  - Doc: ${doc.filename}, Product ID: ${doc.product_id}, Matches requested: ${matchesProduct}`)
      if (!matchesProduct) {
        console.error(`  *** MISMATCH: Document ${doc.filename} belongs to product ${doc.product_id}, not ${productId}`)
      }
    }
  }

  // Fetch document info for all chunks
  const { data: documents } = await supabase
    .from('documents')
    .select('id, filename, file_url')
    .in('id', documentIds)

  const documentMap = new Map(
    (documents || []).map((doc: any) => [doc.id, doc])
  )

  return (data || []).map((item: any) => ({
    chunk: {
      id: item.id,
      document_id: item.document_id,
      content: item.content,
      embedding: [],
      chunk_index: item.chunk_index,
      metadata: item.metadata,
    } as DocumentChunk,
    score: item.similarity,
    document: documentMap.get(item.document_id),
  }))
}

async function fallbackTextSearch(
  query: string,
  productId: string,
  limit: number
): Promise<ChunkWithSource[]> {
  const supabase = await createServiceClient()

  console.log('Fallback text search: filtering by product_id:', productId)

  // Simple text search using ILIKE
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((k) => k.length > 2)
    .slice(0, 5)

  if (keywords.length === 0) {
    return []
  }

  // Get chunks directly filtered by product_id
  const { data: chunks, error } = await (supabase
    .from('document_chunks') as any)
    .select('*, documents!inner(id, filename, file_url, product_id)')
    .eq('product_id', productId)
    .limit(limit * 3)

  if (error) {
    console.error('Fallback search error:', error)
    // Try alternative: filter via documents table
    const { data: documents } = await supabase
      .from('documents')
      .select('id, filename, file_url')
      .eq('product_id', productId)

    if (!documents || documents.length === 0) {
      return []
    }

    const documentIds = documents.map((d: any) => d.id)
    const documentMap = new Map(documents.map((doc: any) => [doc.id, doc]))

    const { data: fallbackChunks } = await supabase
      .from('document_chunks')
      .select('*')
      .in('document_id', documentIds)
      .limit(limit * 3)

    if (!fallbackChunks) return []

    const scoredChunks = fallbackChunks
      .map((chunk: any) => {
        const content = chunk.content.toLowerCase()
        const matchCount = keywords.filter((k) => content.includes(k)).length
        const score = matchCount / keywords.length
        return { chunk, score, document: documentMap.get(chunk.document_id) }
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    console.log('Fallback search (via documents) returned', scoredChunks.length, 'results')
    return scoredChunks
  }

  // Build document map from joined data
  const documentMap = new Map<string, any>()
  chunks?.forEach((chunk: any) => {
    if (chunk.documents) {
      documentMap.set(chunk.document_id, {
        id: chunk.documents.id,
        filename: chunk.documents.filename,
        file_url: chunk.documents.file_url,
      })
    }
  })

  // Score chunks by keyword matches
  const scoredChunks = (chunks || [])
    .map((chunk: any) => {
      const content = chunk.content.toLowerCase()
      const matchCount = keywords.filter((k) => content.includes(k)).length
      const score = matchCount / keywords.length
      return {
        chunk,
        score,
        document: documentMap.get(chunk.document_id),
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  console.log('Fallback text search returned', scoredChunks.length, 'results for product:', productId)
  return scoredChunks
}

export async function getChunksByDocument(
  documentId: string
): Promise<DocumentChunk[]> {
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('document_chunks')
    .select('*')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })

  if (error) {
    console.error('Get chunks error:', error)
    return []
  }

  return data || []
}
