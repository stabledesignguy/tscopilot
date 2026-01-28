import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseDocument, parseDocumentWithPages } from '@/lib/rag/parser'
import { chunkText, chunkTextWithPages } from '@/lib/rag/chunker'
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

    const supabase = createServiceClient()

    // Update status to processing
    await (supabase
      .from('documents') as any)
      .update({ processing_status: 'processing' })
      .eq('id', documentId)

    try {
      // Get document info
      const { data: document, error: docError } = await (supabase
        .from('documents') as any)
        .select('*')
        .eq('id', documentId)
        .single()

      if (docError || !document) {
        throw new Error('Document not found')
      }

      // Download file from storage
      const response = await fetch(document.file_url)
      const fileBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(fileBuffer)

      // Parse document with page information
      const parsedDoc = await parseDocumentWithPages(
        buffer,
        document.mime_type,
        document.filename
      )

      // Chunk the content with page tracking
      const chunksWithPages = chunkTextWithPages(parsedDoc.fullText, {
        pages: parsedDoc.pages,
        chunkSize: 1500,
        chunkOverlap: 300,
      })

      // Generate embeddings and store chunks with page metadata
      console.log(`Processing: Creating ${chunksWithPages.length} chunks for document "${document.filename}"`)
      console.log(`Processing: Product ID: ${document.product_id}`)

      for (let i = 0; i < chunksWithPages.length; i++) {
        const chunk = chunksWithPages[i]
        const embedding = await generateEmbeddings(chunk.content)

        const { error: insertError } = await (supabase.from('document_chunks') as any).insert({
          document_id: documentId,
          product_id: document.product_id,
          content: chunk.content,
          embedding,
          chunk_index: i,
          metadata: {
            filename: document.filename,
            page_numbers: chunk.pageNumbers,
            primary_page: chunk.primaryPage,
            search_text: chunk.searchText,
          },
        })

        if (insertError) {
          console.error(`Processing: Error inserting chunk ${i}:`, insertError)
        }
      }

      console.log(`Processing: Successfully created ${chunksWithPages.length} chunks`)

      // Update status to completed
      await (supabase
        .from('documents') as any)
        .update({ processing_status: 'completed' })
        .eq('id', documentId)

      return NextResponse.json({
        success: true,
        chunksCreated: chunksWithPages.length,
      })
    } catch (error) {
      console.error('Document processing error:', error)

      // Update status to failed
      await (supabase
        .from('documents') as any)
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
