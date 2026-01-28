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
  const pageTextsMap = new Map<number, string>()

  // Custom page render function to capture text per page separately
  const options = {
    pagerender: function(pageData: any) {
      // pageData.pageIndex is 0-based, so add 1 for 1-based page numbers
      const pageNum = (pageData.pageIndex ?? pageData._pageIndex ?? 0) + 1

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

        // Store with actual page number from PDF
        pageTextsMap.set(pageNum, pageText)
        return pageText
      })
    }
  }

  try {
    const data = await pdf(buffer, options)
    const totalPages = data.numpages || 1

    // Build pages array from collected page texts
    const pages: PageContent[] = []
    let currentCharPos = 0

    // Process pages in order
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const rawText = pageTextsMap.get(pageNum) || ''
      const text = cleanText(rawText)

      if (text.length > 0) {
        const charStart = currentCharPos
        const charEnd = currentCharPos + text.length

        pages.push({
          pageNumber: pageNum,
          text,
          charStart,
          charEnd
        })

        currentCharPos = charEnd + 1 // +1 for space between pages
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

    console.log(`PDF parsed: ${pages.length} pages from ${totalPages} total, ${fullText.length} chars`)

    return {
      fullText,
      pages,
      totalPages
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
