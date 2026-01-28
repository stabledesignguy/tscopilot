import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { query, productId } = await request.json()

    if (!query || !productId) {
      return NextResponse.json(
        { error: 'query and productId are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Direct database search for the specific chunk
    const { data: targetChunk } = await supabase
      .from('document_chunks')
      .select('id, content')
      .eq('product_id', productId)
      .ilike('content', '%lunghezza%passerella%')
      .limit(1)

    // Count total chunks for this product
    const { count } = await supabase
      .from('document_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)

    // Extract keywords (same logic as retriever)
    const commonWords = new Set(['qual', 'quale', 'quali', 'cosa', 'come', 'dove', 'quando', 'perché', 'della', 'dello', 'delle', 'degli', 'nella', 'nello', 'nelle', 'negli', 'sono', 'essere', 'hanno', 'questa', 'questo', 'queste', 'questi', 'molto', 'anche', 'solo', 'ogni', 'tutto', 'tutti', 'prima', 'dopo', 'sempre', 'ancora', 'fatto', 'fare', 'macchina'])

    const keywords = query
      .toLowerCase()
      .replace(/[^\w\sàèéìòù]/g, ' ')
      .split(/\s+/)
      .filter((k: string) => k.length > 3 && !commonWords.has(k))
      .slice(0, 10)

    // Check if target chunk contains keywords
    const targetContent = targetChunk?.[0]?.content?.toLowerCase() || ''
    const keywordMatches = keywords.map((k: string) => ({
      keyword: k,
      found: targetContent.includes(k)
    }))

    return NextResponse.json({
      query,
      productId,
      totalChunks: count,
      extractedKeywords: keywords,
      targetChunkFound: !!targetChunk?.[0],
      targetChunkId: targetChunk?.[0]?.id,
      targetChunkPreview: targetChunk?.[0]?.content?.slice(0, 500),
      keywordMatchesInTarget: keywordMatches,
      version: 'v2-direct-search'
    })
  } catch (error) {
    console.error('Debug RAG error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
