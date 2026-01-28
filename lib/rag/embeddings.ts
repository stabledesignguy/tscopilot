import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const EMBEDDING_MODEL = 'text-embedding-3-large'
const EMBEDDING_DIMENSIONS = 1536

export async function generateEmbeddings(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    })

    return response.data[0].embedding
  } catch (error) {
    console.error('Embedding generation error:', error)
    throw new Error('Failed to generate embeddings')
  }
}

export async function generateBatchEmbeddings(
  texts: string[]
): Promise<number[][]> {
  try {
    // OpenAI supports batch embedding
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    })

    // Sort by index to maintain order
    return response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding)
  } catch (error) {
    console.error('Batch embedding generation error:', error)
    throw new Error('Failed to generate batch embeddings')
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

export { EMBEDDING_DIMENSIONS }
