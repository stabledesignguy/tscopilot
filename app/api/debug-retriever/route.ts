import { NextRequest, NextResponse } from 'next/server'
import { retrieveRelevantChunks } from '@/lib/rag/retriever'

// Direct test of the actual retriever function
export async function POST(request: NextRequest) {
  try {
    const { query, productId } = await request.json()

    if (!query || !productId) {
      return NextResponse.json(
        { error: 'query and productId are required' },
        { status: 400 }
      )
    }

    console.log('DEBUG-RETRIEVER: Starting test with query:', query)
    console.log('DEBUG-RETRIEVER: Product ID:', productId)

    // Call the actual retriever
    const chunks = await retrieveRelevantChunks(query, productId, 10)

    // Check if any chunk contains the target keywords
    const results = chunks.map((c, i) => ({
      rank: i + 1,
      score: c.score,
      vectorScore: (c as any).vectorScore || 0,
      keywordScore: (c as any).keywordScore || 0,
      hasLunghezza: c.chunk.content.toLowerCase().includes('lunghezza'),
      hasPasserella: c.chunk.content.toLowerCase().includes('passerella'),
      hasPosteriore: c.chunk.content.toLowerCase().includes('posteriore'),
      has4470: c.chunk.content.includes('4470'),
      preview: c.chunk.content.slice(0, 200),
      filename: c.document?.filename || 'unknown'
    }))

    const targetFound = results.some(r => r.hasLunghezza && r.hasPasserella && r.hasPosteriore)

    return NextResponse.json({
      version: 'debug-retriever-v1',
      query,
      productId,
      totalResults: chunks.length,
      targetFound,
      results
    })
  } catch (error) {
    console.error('Debug retriever error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
