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

// RETRIEVER VERSION: v4-keyword-priority
export async function retrieveRelevantChunks(
  query: string,
  productId: string,
  limit: number = 5,
  threshold: number = 0.05
): Promise<ChunkWithSource[]> {
  const supabase = createServiceClient()

  // Extract keywords for hybrid search (remove punctuation, filter short/common words)
  const commonWords = new Set(['qual', 'quale', 'quali', 'cosa', 'come', 'dove', 'quando', 'perché', 'della', 'dello', 'delle', 'degli', 'nella', 'nello', 'nelle', 'negli', 'sono', 'essere', 'hanno', 'questa', 'questo', 'queste', 'questi', 'molto', 'anche', 'solo', 'ogni', 'tutto', 'tutti', 'prima', 'dopo', 'sempre', 'ancora', 'fatto', 'fare', 'macchina'])

  const keywords = query
    .toLowerCase()
    .replace(/[^\w\sàèéìòù]/g, ' ')  // Remove punctuation, keep Italian accents
    .split(/\s+/)
    .filter((k) => k.length > 3 && !commonWords.has(k))
    .slice(0, 10)

  console.log('RETRIEVER v4: keywords:', keywords.join(', '))

  // Generate embedding for the query
  const queryEmbedding = await generateEmbeddings(query)

  // Use pgvector similarity search
  console.log('Vector search: filtering by product_id:', productId)

  // Format embedding as a string for PostgreSQL vector type
  const embeddingString = `[${queryEmbedding.map(v => v.toFixed(9)).join(',')}]`

  // Get more results for hybrid re-ranking
  const { data: vectorData, error } = await (supabase as any).rpc('match_documents', {
    query_embedding: embeddingString,
    match_threshold: threshold,
    match_count: limit * 3,
    filter_product_id: productId,
  })

  // Also do keyword search (scan all chunks for this product)
  const { data: keywordChunks } = await (supabase
    .from('document_chunks') as any)
    .select('id, document_id, content, chunk_index, metadata')
    .eq('product_id', productId)
    .limit(1000)

  // Build a map of keyword matches
  const keywordMatches = new Map<string, number>()
  if (keywordChunks && keywords.length > 0) {
    for (const chunk of keywordChunks) {
      const content = chunk.content.toLowerCase()
      const matchCount = keywords.filter((k: string) => content.includes(k)).length
      if (matchCount > 0) {
        keywordMatches.set(chunk.id, matchCount / keywords.length)
      }
    }
  }
  console.log('RETRIEVER v4: Keyword search found', keywordMatches.size, 'chunks with keyword matches')

  // Log top keyword matches for debugging
  const topKeywordMatches = Array.from(keywordMatches.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  console.log('RETRIEVER v4: Top 5 keyword matches:', topKeywordMatches.map(([id, score]) => `${score.toFixed(2)}`).join(', '))

  if (error) {
    console.error('Vector search error:', error)
    return fallbackTextSearch(query, productId, limit)
  }

  if (!vectorData || (vectorData as any[]).length === 0) {
    console.log('Vector search returned no results, falling back to text search')
    return fallbackTextSearch(query, productId, limit)
  }

  // Get unique document IDs from both vector and keyword results
  const allDocIds = new Set<string>()
  for (const item of (vectorData || []) as any[]) {
    allDocIds.add(item.document_id)
  }
  for (const chunk of (keywordChunks || []) as any[]) {
    if (keywordMatches.has(chunk.id)) {
      allDocIds.add(chunk.document_id)
    }
  }

  // Fetch document info for all relevant chunks
  const { data: documents } = await (supabase
    .from('documents') as any)
    .select('id, filename, file_url')
    .in('id', Array.from(allDocIds))

  const documentMap = new Map<string, DocumentSource>(
    (documents || []).map((doc: any) => [doc.id, doc as DocumentSource])
  )

  // Hybrid scoring: combine vector similarity with keyword boost
  const hybridResults = ((vectorData || []) as any[]).map((item: any) => {
    const keywordBoost = keywordMatches.get(item.id) || 0
    // Hybrid score: prioritize keyword matches heavily (they're now filtered to important terms)
    const hybridScore = (item.similarity * 0.3) + (keywordBoost * 1.0)

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
      score: hybridScore,
      vectorScore: item.similarity,
      keywordScore: keywordBoost,
      document: documentMap.get(item.document_id),
      pageInfo
    }
  })

  // Also add keyword-only matches that weren't in vector results
  // IMPORTANT: Sort by keyword score before slicing to ensure best matches are included
  const vectorIds = new Set(hybridResults.map(r => r.chunk.id))
  const keywordOnlyChunks = (keywordChunks || [])
    .filter((c: any) => !vectorIds.has(c.id) && keywordMatches.has(c.id))
    .sort((a: any, b: any) => (keywordMatches.get(b.id) || 0) - (keywordMatches.get(a.id) || 0))
    .slice(0, limit)

  console.log('RETRIEVER v4: Adding', keywordOnlyChunks.length, 'keyword-only chunks')

  for (const chunk of keywordOnlyChunks) {
    const keywordScore = keywordMatches.get(chunk.id) || 0
    const metadata = chunk.metadata || {}
    const pageInfo: PageInfo | undefined = metadata.page_numbers
      ? {
          pageNumbers: metadata.page_numbers,
          primaryPage: metadata.primary_page || metadata.page_numbers[0] || 1,
          searchText: metadata.search_text || chunk.content?.slice(0, 150) || ''
        }
      : undefined

    // Log high-scoring keyword-only chunks
    if (keywordScore >= 0.8) {
      console.log('RETRIEVER v4: High-score keyword-only chunk:', keywordScore.toFixed(2), '- preview:', chunk.content.slice(0, 100))
    }

    hybridResults.push({
      chunk: {
        id: chunk.id,
        document_id: chunk.document_id,
        content: chunk.content,
        embedding: [],
        chunk_index: chunk.chunk_index,
        metadata: chunk.metadata,
      } as DocumentChunk,
      score: keywordScore * 1.0,
      vectorScore: 0,
      keywordScore: keywordScore,
      document: documentMap.get(chunk.document_id),
      pageInfo
    })
  }

  // Sort by hybrid score and return top results
  hybridResults.sort((a, b) => b.score - a.score)

  console.log('Hybrid search: top 3 scores:', hybridResults.slice(0, 3).map(r =>
    `${r.score.toFixed(3)} (vec:${r.vectorScore?.toFixed(3)}, kw:${r.keywordScore?.toFixed(3)})`
  ).join(', '))

  return hybridResults.slice(0, limit)
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
