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
  let currentCharPos = 0

  // Custom page render function to capture text per page
  const options = {
    pagerender: function(pageData: any) {
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

        return pageText
      })
    }
  }

  try {
    const data = await pdf(buffer, options)

    // pdf-parse returns numpages for total pages
    const totalPages = data.numpages || 1

    // Parse the text by page markers or split evenly if no markers
    // The custom pagerender concatenates pages with form feed characters
    const rawText = data.text || ''

    // Split by common page separators or process as single page
    // pdf-parse with custom render typically joins pages
    const pageTexts = rawText.split(/\f/).filter((t: string) => t.trim().length > 0)

    if (pageTexts.length > 0) {
      for (let i = 0; i < pageTexts.length; i++) {
        const text = cleanText(pageTexts[i])
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
    } else {
      // Fallback: treat entire text as page 1
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
