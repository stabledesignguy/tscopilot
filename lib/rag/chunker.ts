export interface ChunkOptions {
  chunkSize: number
  chunkOverlap: number
  separators?: string[]
}

const defaultSeparators = ['\n\n', '\n', '. ', ' ', '']

export function chunkText(
  text: string,
  options: ChunkOptions
): string[] {
  const { chunkSize, chunkOverlap, separators = defaultSeparators } = options

  const chunks: string[] = []

  function splitText(text: string, separators: string[]): string[] {
    const separator = separators[0]
    const newSeparators = separators.slice(1)

    if (separator === '') {
      // Final fallback: split by characters
      return splitByCharacters(text, chunkSize, chunkOverlap)
    }

    const splits = text.split(separator)
    const goodSplits: string[] = []
    let currentChunk = ''

    for (const split of splits) {
      const potentialChunk = currentChunk
        ? currentChunk + separator + split
        : split

      if (potentialChunk.length <= chunkSize) {
        currentChunk = potentialChunk
      } else {
        if (currentChunk) {
          goodSplits.push(currentChunk)
        }

        if (split.length > chunkSize && newSeparators.length > 0) {
          // Recursively split large chunks
          const subSplits = splitText(split, newSeparators)
          goodSplits.push(...subSplits)
          currentChunk = ''
        } else {
          currentChunk = split
        }
      }
    }

    if (currentChunk) {
      goodSplits.push(currentChunk)
    }

    return goodSplits
  }

  const rawChunks = splitText(text, separators)

  // Apply overlap between chunks
  for (let i = 0; i < rawChunks.length; i++) {
    let chunk = rawChunks[i].trim()

    // Add overlap from previous chunk
    if (i > 0 && chunkOverlap > 0) {
      const prevChunk = rawChunks[i - 1]
      const overlapText = prevChunk.slice(-chunkOverlap)
      chunk = overlapText + chunk
    }

    if (chunk.length > 0) {
      chunks.push(chunk)
    }
  }

  return chunks
}

function splitByCharacters(
  text: string,
  chunkSize: number,
  chunkOverlap: number
): string[] {
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.slice(start, end))
    start = end - chunkOverlap

    // Prevent infinite loop
    if (start >= text.length) break
  }

  return chunks
}

export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4)
}
