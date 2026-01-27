'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface SourcePageInfo {
  pageNumbers: number[]
  primaryPage: number
  searchText: string
}

export interface SourceMetadata {
  filename: string
  url: string
  pageInfo?: SourcePageInfo
}

interface PDFViewerState {
  isOpen: boolean
  url: string | null
  filename: string | null
  pageInfo?: SourcePageInfo
}

interface SourceContextValue {
  sourceMetadata: SourceMetadata[]
  setSourceMetadata: (metadata: SourceMetadata[]) => void
  pdfViewer: PDFViewerState
  openPDFViewer: (url: string, filename: string, pageInfo?: SourcePageInfo) => void
  closePDFViewer: () => void
  findSourceByUrl: (url: string) => SourceMetadata | undefined
}

const SourceContext = createContext<SourceContextValue | null>(null)

export function SourceProvider({ children }: { children: ReactNode }) {
  const [sourceMetadata, setSourceMetadata] = useState<SourceMetadata[]>([])
  const [pdfViewer, setPdfViewer] = useState<PDFViewerState>({
    isOpen: false,
    url: null,
    filename: null
  })

  const openPDFViewer = useCallback((url: string, filename: string, pageInfo?: SourcePageInfo) => {
    setPdfViewer({
      isOpen: true,
      url,
      filename,
      pageInfo
    })
  }, [])

  const closePDFViewer = useCallback(() => {
    setPdfViewer({
      isOpen: false,
      url: null,
      filename: null
    })
  }, [])

  const findSourceByUrl = useCallback((url: string) => {
    // Try to find source by exact URL match or by base URL (without hash/query)
    const baseUrl = url.split('#')[0].split('?')[0]
    return sourceMetadata.find(s => {
      const sourceBaseUrl = s.url.split('#')[0].split('?')[0]
      return sourceBaseUrl === baseUrl
    })
  }, [sourceMetadata])

  return (
    <SourceContext.Provider
      value={{
        sourceMetadata,
        setSourceMetadata,
        pdfViewer,
        openPDFViewer,
        closePDFViewer,
        findSourceByUrl
      }}
    >
      {children}
    </SourceContext.Provider>
  )
}

export function useSourceContext() {
  const context = useContext(SourceContext)
  if (!context) {
    throw new Error('useSourceContext must be used within a SourceProvider')
  }
  return context
}
