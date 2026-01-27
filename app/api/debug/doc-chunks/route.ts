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

    const { searchParams } = new URL(request.url)
    const filename = searchParams.get('filename')
    const documentId = searchParams.get('documentId')
    const query = searchParams.get('query')

    if (!filename && !documentId) {
      return NextResponse.json({
        error: 'filename or documentId required',
        usage: '/api/debug/doc-chunks?filename=xxx&query=your+question'
      }, { status: 400 })
    }

    // Find document
    let docQuery = supabase
      .from('documents')
      .select('id, filename, product_id, processing_status')

    if (documentId) {
      docQuery = docQuery.eq('id', documentId)
    } else if (filename) {
      docQuery = docQuery.ilike('filename', `%${filename}%`)
    }

    const { data: documents, error: docError } = await docQuery.limit(5)

    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 500 })
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ error: 'Document not found', filename, documentId })
    }

    // Generate query embedding if query provided
    let queryEmbedding: number[] | null = null
    if (query) {
      try {
        queryEmbedding = await generateEmbeddings(query)
      } catch (e) {
        console.error('Failed to generate query embedding:', e)
      }
    }

    const serviceClient = await createServiceClient()

    // Get chunks for each document
    const results = []
    for (const doc of documents) {
      const { data: chunks, error: chunkError } = await serviceClient
        .from('document_chunks')
        .select('id, content, chunk_index, product_id, embedding')
        .eq('document_id', doc.id)
        .order('chunk_index', { ascending: true })

      const chunksWithSimilarity = chunks?.map(c => {
        let similarity = null
        if (queryEmbedding && c.embedding) {
          // Compute cosine similarity
          const embedding = typeof c.embedding === 'string'
            ? JSON.parse(c.embedding.replace(/[\[\]]/g, '').split(',').map(Number))
            : c.embedding

          if (Array.isArray(embedding) && embedding.length === queryEmbedding.length) {
            let dotProduct = 0
            let normA = 0
            let normB = 0
            for (let i = 0; i < queryEmbedding.length; i++) {
              dotProduct += queryEmbedding[i] * embedding[i]
              normA += queryEmbedding[i] * queryEmbedding[i]
              normB += embedding[i] * embedding[i]
            }
            similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
          }
        }

        return {
          id: c.id,
          chunk_index: c.chunk_index,
          product_id: c.product_id,
          content_preview: c.content?.substring(0, 300) + '...',
          content_length: c.content?.length || 0,
          has_embedding: !!c.embedding,
          similarity: similarity,
        }
      })

      results.push({
        document: doc,
        chunks_count: chunks?.length || 0,
        chunks: chunksWithSimilarity
      })
    }

    return NextResponse.json({
      query,
      query_embedding_generated: !!queryEmbedding,
      results
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
