import type { PageContent } from './parser'

export interface ChunkOptions {
  chunkSize: number
  chunkOverlap: number
  separators?: string[]
}

export interface ChunkWithPageInfo {
  content: string
  pageNumbers: number[]
  primaryPage: number
  searchText: string
}

export interface ChunkWithPagesOptions extends ChunkOptions {
  pages: PageContent[]
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

export function chunkTextWithPages(
  text: string,
  options: ChunkWithPagesOptions
): ChunkWithPageInfo[] {
  const { pages, chunkSize, chunkOverlap } = options

  // Build chunks directly from pages to ensure accurate page tracking
  const chunks: ChunkWithPageInfo[] = []

  // Create a mapping of character position to page number
  const charToPage = new Map<number, number>()
  for (const page of pages) {
    for (let i = page.charStart; i < page.charEnd; i++) {
      charToPage.set(i, page.pageNumber)
    }
  }

  // Helper to get page numbers for a character range
  function getPagesForRange(start: number, end: number): number[] {
    const pageSet = new Set<number>()
    // Sample positions to determine pages (every 100 chars for efficiency)
    for (let i = start; i < end; i += 100) {
      const page = charToPage.get(i)
      if (page) pageSet.add(page)
    }
    // Also check start and end positions
    const startPage = charToPage.get(start)
    const endPage = charToPage.get(Math.max(start, end - 1))
    if (startPage) pageSet.add(startPage)
    if (endPage) pageSet.add(endPage)

    const result = Array.from(pageSet).sort((a, b) => a - b)
    return result.length > 0 ? result : [1]
  }

  // Chunk with position tracking
  let currentPos = 0
  while (currentPos < text.length) {
    // Find a good break point
    let endPos = Math.min(currentPos + chunkSize, text.length)

    // Try to break at a paragraph or sentence boundary
    if (endPos < text.length) {
      // Look for paragraph break
      const paragraphBreak = text.lastIndexOf('\n\n', endPos)
      if (paragraphBreak > currentPos + chunkSize * 0.5) {
        endPos = paragraphBreak
      } else {
        // Look for sentence break
        const sentenceBreak = text.lastIndexOf('. ', endPos)
        if (sentenceBreak > currentPos + chunkSize * 0.5) {
          endPos = sentenceBreak + 1
        }
      }
    }

    const chunkContent = text.slice(currentPos, endPos).trim()

    if (chunkContent.length > 0) {
      const pageNumbers = getPagesForRange(currentPos, endPos)

      // Primary page is the one covering most of the chunk
      const pageCounts = new Map<number, number>()
      for (let i = currentPos; i < endPos; i += 50) {
        const page = charToPage.get(i)
        if (page) {
          pageCounts.set(page, (pageCounts.get(page) || 0) + 1)
        }
      }

      let primaryPage = pageNumbers[0]
      let maxCount = 0
      for (const [page, count] of pageCounts) {
        if (count > maxCount) {
          maxCount = count
          primaryPage = page
        }
      }

      chunks.push({
        content: chunkContent,
        pageNumbers,
        primaryPage,
        searchText: chunkContent.slice(0, 150).trim()
      })
    }

    // Move to next position with overlap
    const nextPos = endPos - chunkOverlap
    if (nextPos <= currentPos) {
      currentPos = endPos // Prevent infinite loop
    } else {
      currentPos = nextPos
    }
  }

  console.log(`Chunked into ${chunks.length} chunks with page tracking`)

  return chunks
}
