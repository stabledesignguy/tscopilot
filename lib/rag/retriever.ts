import { createServiceClient } from '@/lib/supabase/server'
import { generateEmbeddings } from './embeddings'
import type { ChunkWithScore, DocumentChunk } from '@/types'

export interface DocumentSource {
  id: string
  filename: string
  file_url: string
}

export interface PageInfo {
  pageNumbers: number[]
  primaryPage: number
  searchText: string
}

export interface ChunkWithSource extends ChunkWithScore {
  document?: DocumentSource
  pageInfo?: PageInfo
}

export async function retrieveRelevantChunks(
  query: string,
  productId: string,
  limit: number = 5,
  threshold: number = 0.15
): Promise<ChunkWithSource[]> {
  const supabase = createServiceClient()

  // Generate embedding for the query
  const queryEmbedding = await generateEmbeddings(query)

  // Use pgvector similarity search
  // This requires the match_documents function to be created in Supabase
  console.log('Vector search: filtering by product_id:', productId)

  // Format embedding as a string for PostgreSQL vector type
  // Use 9 decimal places to match PostgreSQL's vector::text format
  const embeddingString = `[${queryEmbedding.map(v => v.toFixed(9)).join(',')}]`

  const { data, error } = await (supabase as any).rpc('match_documents', {
    query_embedding: embeddingString,
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

  // Fallback to text search if vector search returns no results
  if (!data || (data as any[]).length === 0) {
    console.log('Vector search returned no results, falling back to text search for product:', productId)
    return fallbackTextSearch(query, productId, limit)
  }

  // Get unique document IDs
  const documentIds = Array.from(new Set(((data || []) as any[]).map((item: any) => item.document_id)))

  // Fetch document info for all chunks
  const { data: documents } = await (supabase
    .from('documents') as any)
    .select('id, filename, file_url')
    .in('id', documentIds)

  const documentMap = new Map<string, DocumentSource>(
    (documents || []).map((doc: any) => [doc.id, doc as DocumentSource])
  )

  return ((data || []) as any[]).map((item: any) => {
    // Extract page info from metadata if available
    const metadata = item.metadata || {}
    const pageInfo: PageInfo | undefined = metadata.page_numbers
      ? {
          pageNumbers: metadata.page_numbers,
          primaryPage: metadata.primary_page || metadata.page_numbers[0] || 1,
          searchText: metadata.search_text || item.content?.slice(0, 150) || ''
        }
      : undefined

    return {
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
      pageInfo
    }
  })
}

async function fallbackTextSearch(
  query: string,
  productId: string,
  limit: number
): Promise<ChunkWithSource[]> {
  const supabase = createServiceClient()

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
        const metadata = chunk.metadata || {}
        const pageInfo: PageInfo | undefined = metadata.page_numbers
          ? {
              pageNumbers: metadata.page_numbers,
              primaryPage: metadata.primary_page || metadata.page_numbers[0] || 1,
              searchText: metadata.search_text || chunk.content?.slice(0, 150) || ''
            }
          : undefined
        return { chunk, score, document: documentMap.get(chunk.document_id), pageInfo }
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
      const metadata = chunk.metadata || {}
      const pageInfo: PageInfo | undefined = metadata.page_numbers
        ? {
            pageNumbers: metadata.page_numbers,
            primaryPage: metadata.primary_page || metadata.page_numbers[0] || 1,
            searchText: metadata.search_text || chunk.content?.slice(0, 150) || ''
          }
        : undefined
      return {
        chunk,
        score,
        document: documentMap.get(chunk.document_id),
        pageInfo
      }
    })
    .filter((item: any) => item.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, limit)

  console.log('Fallback text search returned', scoredChunks.length, 'results for product:', productId)
  return scoredChunks
}

export async function getChunksByDocument(
  documentId: string
): Promise<DocumentChunk[]> {
  const supabase = createServiceClient()

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
