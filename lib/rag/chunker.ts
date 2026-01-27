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
  const { pages, chunkSize, chunkOverlap, separators = defaultSeparators } = options

  // First, get the raw chunks using existing chunking logic
  const rawChunks = chunkText(text, { chunkSize, chunkOverlap, separators })

  // Track position in the full text
  let searchStartPos = 0

  return rawChunks.map((chunkContent) => {
    // Find where this chunk starts in the full text
    const chunkStartInText = text.indexOf(chunkContent, searchStartPos)
    const chunkEndInText = chunkStartInText + chunkContent.length

    // Update search position for next chunk (accounting for overlap)
    if (chunkStartInText !== -1) {
      searchStartPos = Math.max(searchStartPos, chunkStartInText + 1)
    }

    // Determine which pages this chunk spans
    const pageNumbers: number[] = []

    for (const page of pages) {
      // Check if chunk overlaps with this page
      // A chunk overlaps if its start is before the page end AND its end is after the page start
      if (chunkStartInText < page.charEnd && chunkEndInText > page.charStart) {
        pageNumbers.push(page.pageNumber)
      }
    }

    // If no pages found (shouldn't happen), default to page 1
    if (pageNumbers.length === 0) {
      pageNumbers.push(1)
    }

    // Primary page is the one with the most content in this chunk
    let primaryPage = pageNumbers[0]
    let maxOverlap = 0

    for (const pageNum of pageNumbers) {
      const page = pages.find((p) => p.pageNumber === pageNum)
      if (page) {
        const overlapStart = Math.max(chunkStartInText, page.charStart)
        const overlapEnd = Math.min(chunkEndInText, page.charEnd)
        const overlap = overlapEnd - overlapStart
        if (overlap > maxOverlap) {
          maxOverlap = overlap
          primaryPage = pageNum
        }
      }
    }

    // Extract search text (first 150 chars for text matching)
    const searchText = chunkContent.slice(0, 150).trim()

    return {
      content: chunkContent,
      pageNumbers,
      primaryPage,
      searchText
    }
  })
}
