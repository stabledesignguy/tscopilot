import pdf from 'pdf-parse'
import mammoth from 'mammoth'

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

async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer)
    return cleanText(data.text)
  } catch (error) {
    console.error('PDF parsing error:', error)
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
