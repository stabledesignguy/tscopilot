import pdf from 'pdf-parse'
import mammoth from 'mammoth'

export interface PageContent {
  pageNumber: number
  text: string
  charStart: number
  charEnd: number
}

export interface ParsedDocument {
  fullText: string
  pages: PageContent[]
  totalPages: number
}

export async function parseDocument(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  switch (mimeType) {
    case 'application/pdf':
      return parsePDF(buffer)
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return parseDOCX(buffer)
    case 'text/plain':
    case 'text/markdown':
      return parseText(buffer)
    default:
      throw new Error(`Unsupported file type: ${mimeType}`)
  }
}

export async function parseDocumentWithPages(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ParsedDocument> {
  switch (mimeType) {
    case 'application/pdf':
      return parsePDFWithPages(buffer)
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'text/plain':
    case 'text/markdown': {
      // Non-PDF documents don't have pages - treat as single page
      const text = mimeType.includes('word')
        ? await parseDOCX(buffer)
        : parseText(buffer)
      return {
        fullText: text,
        pages: [{
          pageNumber: 1,
          text,
          charStart: 0,
          charEnd: text.length
        }],
        totalPages: 1
      }
    }
    default:
      throw new Error(`Unsupported file type: ${mimeType}`)
  }
}

async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const parsed = await parsePDFWithPages(buffer)
    return parsed.fullText
  } catch (error) {
    console.error('PDF parsing error:', error)
    throw new Error('Failed to parse PDF document')
  }
}

export async function parsePDFWithPages(buffer: Buffer): Promise<ParsedDocument> {
  const pages: PageContent[] = []
  const pageTexts: string[] = []
  let currentPageNum = 0

  // Custom page render function to capture text per page separately
  const options = {
    pagerender: function(pageData: any) {
      currentPageNum++
      const pageNum = currentPageNum

      return pageData.getTextContent().then(function(textContent: any) {
        let pageText = ''
        let lastY: number | null = null

        for (const item of textContent.items) {
          if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
            pageText += '\n'
          }
          pageText += item.str
          lastY = item.transform[5]
        }

        // Store with page number marker for later parsing
        pageTexts[pageNum - 1] = pageText
        return pageText
      })
    }
  }

  try {
    const data = await pdf(buffer, options)
    const totalPages = data.numpages || 1

    // Build pages array from collected page texts
    let currentCharPos = 0

    // If pageTexts were collected, use them
    if (pageTexts.length > 0) {
      for (let i = 0; i < pageTexts.length; i++) {
        const rawText = pageTexts[i] || ''
        const text = cleanText(rawText)

        if (text.length > 0) {
          const charStart = currentCharPos
          const charEnd = currentCharPos + text.length

          pages.push({
            pageNumber: i + 1,
            text,
            charStart,
            charEnd
          })

          currentCharPos = charEnd + 1 // +1 for space between pages
        }
      }
    }

    // Fallback if no pages collected
    if (pages.length === 0) {
      const rawText = data.text || ''
      const text = cleanText(rawText)
      pages.push({
        pageNumber: 1,
        text,
        charStart: 0,
        charEnd: text.length
      })
    }

    // Build full text by joining page texts
    const fullText = pages.map(p => p.text).join(' ')

    console.log(`PDF parsed: ${pages.length} pages, ${fullText.length} chars`)

    return {
      fullText,
      pages,
      totalPages: Math.max(totalPages, pages.length)
    }
  } catch (error) {
    console.error('PDF parsing with pages error:', error)
    throw new Error('Failed to parse PDF document')
  }
}

async function parseDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    return cleanText(result.value)
  } catch (error) {
    console.error('DOCX parsing error:', error)
    throw new Error('Failed to parse DOCX document')
  }
}

function parseText(buffer: Buffer): string {
  return cleanText(buffer.toString('utf-8'))
}

function cleanText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim whitespace from start and end
    .trim()
}
