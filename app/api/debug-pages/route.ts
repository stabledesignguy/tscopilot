import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { productId, searchText } = await request.json()

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Get all chunks for this product with their metadata
    const { data: chunks, error } = await supabase
      .from('document_chunks')
      .select('id, content, metadata, chunk_index')
      .eq('product_id', productId)
      .limit(500)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If searchText provided, find chunks containing it
    let matchingChunks = chunks || []
    if (searchText) {
      const searchLower = searchText.toLowerCase()
      matchingChunks = matchingChunks.filter(c =>
        c.content.toLowerCase().includes(searchLower)
      )
    }

    // Analyze page metadata
    const results = matchingChunks.slice(0, 20).map(c => ({
      chunk_index: c.chunk_index,
      has_metadata: !!c.metadata,
      page_numbers: c.metadata?.page_numbers || null,
      primary_page: c.metadata?.primary_page || null,
      content_preview: c.content.slice(0, 200),
      metadata_keys: c.metadata ? Object.keys(c.metadata) : []
    }))

    // Summary stats
    const allChunks = chunks || []
    const chunksWithPageInfo = allChunks.filter(c => c.metadata?.page_numbers)
    const uniquePages = new Set<number>()
    chunksWithPageInfo.forEach(c => {
      (c.metadata.page_numbers || []).forEach((p: number) => uniquePages.add(p))
    })

    return NextResponse.json({
      version: 'debug-pages-v1',
      totalChunks: allChunks.length,
      chunksWithPageMetadata: chunksWithPageInfo.length,
      uniquePagesFound: Array.from(uniquePages).sort((a, b) => a - b),
      searchText: searchText || null,
      matchingChunks: results.length,
      results
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
