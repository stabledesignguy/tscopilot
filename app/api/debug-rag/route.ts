import { NextRequest, NextResponse } from 'next/server'
import { retrieveRelevantChunks } from '@/lib/rag/retriever'

export async function POST(request: NextRequest) {
  try {
    const { query, productId } = await request.json()

    if (!query || !productId) {
      return NextResponse.json(
        { error: 'query and productId are required' },
        { status: 400 }
      )
    }

    console.log('Debug RAG - Query:', query)
    console.log('Debug RAG - Product ID:', productId)

    const chunks = await retrieveRelevantChunks(query, productId, 10)

    console.log('Debug RAG - Found', chunks.length, 'chunks')

    const results = chunks.map((c, i) => ({
      rank: i + 1,
      score: c.score,
      contentPreview: c.chunk.content.slice(0, 300),
      filename: c.document?.filename,
      hasKeywords: {
        lunghezza: c.chunk.content.toLowerCase().includes('lunghezza'),
        passerella: c.chunk.content.toLowerCase().includes('passerella'),
        posteriore: c.chunk.content.toLowerCase().includes('posteriore'),
        dimensioni: c.chunk.content.toLowerCase().includes('dimensioni'),
      }
    }))

    return NextResponse.json({
      query,
      productId,
      chunksFound: chunks.length,
      results
    })
  } catch (error) {
    console.error('Debug RAG error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
