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

  // Generate embedding for the query
  const queryEmbedding = await generateEmbeddings(query)

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

  // Get unique document IDs
  const documentIds = [...new Set((data || []).map((item: any) => item.document_id))]

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

  // Get documents for the product
  const { data: documents } = await supabase
    .from('documents')
    .select('id, filename, file_url')
    .eq('product_id', productId)

  if (!documents || documents.length === 0) {
    return []
  }

  const documentIds = documents.map((d: any) => d.id)
  const documentMap = new Map(
    documents.map((doc: any) => [doc.id, doc])
  )

  // Simple text search using ILIKE
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((k) => k.length > 2)
    .slice(0, 5)

  if (keywords.length === 0) {
    return []
  }

  const { data: chunks, error } = await supabase
    .from('document_chunks')
    .select('*')
    .in('document_id', documentIds)
    .limit(limit * 2)

  if (error || !chunks) {
    return []
  }

  // Score chunks by keyword matches
  const scoredChunks = chunks
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
