import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseDocument } from '@/lib/rag/parser'
import { chunkText } from '@/lib/rag/chunker'
import { generateEmbeddings } from '@/lib/rag/embeddings'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { documentId } = body

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()

    // Update status to processing
    await supabase
      .from('documents')
      .update({ processing_status: 'processing' })
      .eq('id', documentId)

    try {
      // Get document info
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single()

      if (docError || !document) {
        throw new Error('Document not found')
      }

      // Download file from storage
      const response = await fetch(document.file_url)
      const fileBuffer = await response.arrayBuffer()

      // Parse document content
      const content = await parseDocument(
        Buffer.from(fileBuffer),
        document.mime_type,
        document.filename
      )

      // Chunk the content
      const chunks = chunkText(content, {
        chunkSize: 1000,
        chunkOverlap: 200,
      })

      // Generate embeddings and store chunks
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const embedding = await generateEmbeddings(chunk)

        await (supabase.from('document_chunks') as any).insert({
          document_id: documentId,
          product_id: document.product_id,
          content: chunk,
          embedding,
          chunk_index: i,
          metadata: {
            filename: document.filename,
          },
        })
      }

      // Update status to completed
      await supabase
        .from('documents')
        .update({ processing_status: 'completed' })
        .eq('id', documentId)

      return NextResponse.json({
        success: true,
        chunksCreated: chunks.length,
      })
    } catch (error) {
      console.error('Document processing error:', error)

      // Update status to failed
      await supabase
        .from('documents')
        .update({ processing_status: 'failed' })
        .eq('id', documentId)

      return NextResponse.json(
        { error: 'Document processing failed' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Process route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
