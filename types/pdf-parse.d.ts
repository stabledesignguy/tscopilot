declare module 'pdf-parse' {
  interface PDFParseOptions {
    pagerender?: (pageData: {
      getTextContent: () => Promise<{
        items: Array<{
          str: string
          transform: number[]
        }>
      }>
    }) => Promise<string>
    max?: number
    version?: string
  }

  interface PDFParseResult {
    numpages: number
    numrender: number
    info: Record<string, unknown>
    metadata: Record<string, unknown> | null
    version: string
    text: string
  }

  function pdf(buffer: Buffer, options?: PDFParseOptions): Promise<PDFParseResult>

  export = pdf
}
