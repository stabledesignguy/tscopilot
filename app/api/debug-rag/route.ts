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

    // Extract keywords (same logic as retriever)
    const commonWords = new Set(['qual', 'quale', 'quali', 'cosa', 'come', 'dove', 'quando', 'perché', 'della', 'dello', 'delle', 'degli', 'nella', 'nello', 'nelle', 'negli', 'sono', 'essere', 'hanno', 'questa', 'questo', 'queste', 'questi', 'molto', 'anche', 'solo', 'ogni', 'tutto', 'tutti', 'prima', 'dopo', 'sempre', 'ancora', 'fatto', 'fare', 'macchina'])

    const keywords = query
      .toLowerCase()
      .replace(/[^\w\sàèéìòù]/g, ' ')
      .split(/\s+/)
      .filter((k: string) => k.length > 3 && !commonWords.has(k))
      .slice(0, 10)

    // Get ALL chunks for keyword matching (same as retriever)
    const { data: allChunks } = await supabase
      .from('document_chunks')
      .select('id, document_id, content, chunk_index, metadata')
      .eq('product_id', productId)
      .limit(1000)

    // Build keyword matches map (same as retriever)
    const keywordMatchesMap = new Map<string, number>()
    const matchedChunks: any[] = []

    for (const chunk of (allChunks || [])) {
      const content = chunk.content.toLowerCase()
      const matchCount = keywords.filter((k: string) => content.includes(k)).length
      if (matchCount > 0) {
        const score = matchCount / keywords.length
        keywordMatchesMap.set(chunk.id, score)
        matchedChunks.push({
          id: chunk.id,
          score,
          matchCount,
          totalKeywords: keywords.length,
          hasLunghezza: content.includes('lunghezza'),
          hasPasserella: content.includes('passerella'),
          hasPosteriore: content.includes('posteriore'),
          preview: chunk.content.slice(0, 150)
        })
      }
    }

    // Sort by score and get top 10
    matchedChunks.sort((a, b) => b.score - a.score)
    const topMatches = matchedChunks.slice(0, 10)

    // Find the target chunk specifically
    const targetChunk = matchedChunks.find(c =>
      c.hasLunghezza && c.hasPasserella && c.hasPosteriore
    )

    return NextResponse.json({
      query,
      productId,
      extractedKeywords: keywords,
      totalChunks: allChunks?.length || 0,
      chunksWithKeywordMatches: matchedChunks.length,
      targetChunkFound: !!targetChunk,
      targetChunkRank: targetChunk ? matchedChunks.indexOf(targetChunk) + 1 : null,
      targetChunk: targetChunk || null,
      topMatches,
      version: 'v3-keyword-trace'
    })
  } catch (error) {
    console.error('Debug RAG error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
