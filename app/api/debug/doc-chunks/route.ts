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

    const { searchParams } = new URL(request.url)
    const filename = searchParams.get('filename')
    const documentId = searchParams.get('documentId')

    if (!filename && !documentId) {
      return NextResponse.json({
        error: 'filename or documentId required',
        usage: '/api/debug/doc-chunks?filename=xxx or ?documentId=xxx'
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

    // Get chunks for each document
    const results = []
    for (const doc of documents) {
      const { data: chunks, error: chunkError } = await supabase
        .from('document_chunks')
        .select('id, content, chunk_index, product_id')
        .eq('document_id', doc.id)
        .order('chunk_index', { ascending: true })

      results.push({
        document: doc,
        chunks_count: chunks?.length || 0,
        chunks: chunks?.map(c => ({
          id: c.id,
          chunk_index: c.chunk_index,
          product_id: c.product_id,
          content_preview: c.content?.substring(0, 300) + '...',
          content_length: c.content?.length || 0,
        }))
      })
    }

    return NextResponse.json({ results })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
