'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  Download,
  Loader2
} from 'lucide-react'
import { PDFHighlightLayer } from './PDFHighlightLayer'
import type { SourcePageInfo } from '@/components/chat/SourceContext'

import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

interface PDFViewerProps {
  url: string
  filename: string
  pageInfo?: SourcePageInfo
  onClose: () => void
}

export function PDFViewer({ url, filename, pageInfo, onClose }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(pageInfo?.primaryPage || 1)
  const [scale, setScale] = useState<number>(1.0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [highlightPageIndex, setHighlightPageIndex] = useState<number>(0)

  const containerRef = useRef<HTMLDivElement>(null)

  // Get pages with highlights
  const highlightPages = pageInfo?.pageNumbers || []
  const searchText = pageInfo?.searchText || ''

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setIsLoading(false)
    // Navigate to primary page on load
    if (pageInfo?.primaryPage && pageInfo.primaryPage <= numPages) {
      setCurrentPage(pageInfo.primaryPage)
    }
  }, [pageInfo])

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF load error:', error)
    setError('Failed to load PDF. Try opening in a new tab.')
    setIsLoading(false)
  }, [])

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page)
    }
  }, [numPages])

  const goToPrevPage = useCallback(() => {
    goToPage(currentPage - 1)
  }, [currentPage, goToPage])

  const goToNextPage = useCallback(() => {
    goToPage(currentPage + 1)
  }, [currentPage, goToPage])

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(s + 0.25, 3))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(s - 0.25, 0.5))
  }, [])

  const resetZoom = useCallback(() => {
    setScale(1.0)
  }, [])

  const goToNextHighlight = useCallback(() => {
    if (highlightPages.length === 0) return
    const nextIndex = (highlightPageIndex + 1) % highlightPages.length
    setHighlightPageIndex(nextIndex)
    goToPage(highlightPages[nextIndex])
  }, [highlightPages, highlightPageIndex, goToPage])

  const openInNewTab = useCallback(() => {
    window.open(url, '_blank')
  }, [url])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          goToPrevPage()
          break
        case 'ArrowRight':
          goToNextPage()
          break
        case '+':
        case '=':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            zoomIn()
          }
          break
        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            zoomOut()
          }
          break
        case 'n':
          if (highlightPages.length > 1) {
            goToNextHighlight()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, goToPrevPage, goToNextPage, zoomIn, zoomOut, goToNextHighlight, highlightPages.length])

  // Close on backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative flex flex-col w-full h-full max-w-6xl max-h-[95vh] m-4 bg-white rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-secondary-50">
          <div className="flex items-center gap-3">
            <h3 className="font-medium text-secondary-900 truncate max-w-md">
              {filename}
            </h3>
            {highlightPages.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                {highlightPages.length} highlight{highlightPages.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Page navigation */}
            <div className="flex items-center gap-1 px-2 py-1 bg-white rounded border">
              <button
                onClick={goToPrevPage}
                disabled={currentPage <= 1}
                className="p-1 rounded hover:bg-secondary-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Previous page (Left arrow)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm min-w-[80px] text-center">
                {currentPage} / {numPages || '?'}
              </span>
              <button
                onClick={goToNextPage}
                disabled={currentPage >= numPages}
                className="p-1 rounded hover:bg-secondary-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Next page (Right arrow)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Highlight navigation */}
            {highlightPages.length > 1 && (
              <button
                onClick={goToNextHighlight}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded border border-yellow-300"
                title="Go to next highlight (N)"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Next highlight
              </button>
            )}

            {/* Zoom controls */}
            <div className="flex items-center gap-1 px-2 py-1 bg-white rounded border">
              <button
                onClick={zoomOut}
                disabled={scale <= 0.5}
                className="p-1 rounded hover:bg-secondary-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Zoom out (Ctrl+-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={resetZoom}
                className="px-2 py-1 text-sm hover:bg-secondary-100 rounded"
                title="Reset zoom"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                onClick={zoomIn}
                disabled={scale >= 3}
                className="p-1 rounded hover:bg-secondary-100 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Zoom in (Ctrl++)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Actions */}
            <button
              onClick={openInNewTab}
              className="p-2 rounded hover:bg-secondary-100"
              title="Open in new tab"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <a
              href={url}
              download={filename}
              className="p-2 rounded hover:bg-secondary-100"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-secondary-100"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PDF Content */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-secondary-200 relative"
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <p className="text-secondary-600">{error}</p>
              <button
                onClick={openInNewTab}
                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                Open in new tab
              </button>
            </div>
          )}

          <div className="flex justify-center p-4">
            <Document
              file={url}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={null}
              className="pdf-document"
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-lg"
              />
            </Document>
          </div>

          {/* Highlight layer */}
          {searchText && highlightPages.includes(currentPage) && (
            <PDFHighlightLayer
              searchText={searchText}
              pageNumber={currentPage}
              containerRef={containerRef as React.RefObject<HTMLDivElement>}
            />
          )}
        </div>

        {/* Footer with keyboard shortcuts hint */}
        <div className="px-4 py-2 border-t bg-secondary-50 text-xs text-secondary-500">
          <span className="mr-4">
            <kbd className="px-1 py-0.5 bg-secondary-200 rounded">Esc</kbd> Close
          </span>
          <span className="mr-4">
            <kbd className="px-1 py-0.5 bg-secondary-200 rounded">&larr;</kbd>
            <kbd className="px-1 py-0.5 bg-secondary-200 rounded">&rarr;</kbd> Navigate
          </span>
          <span className="mr-4">
            <kbd className="px-1 py-0.5 bg-secondary-200 rounded">Ctrl</kbd>+
            <kbd className="px-1 py-0.5 bg-secondary-200 rounded">+/-</kbd> Zoom
          </span>
          {highlightPages.length > 1 && (
            <span>
              <kbd className="px-1 py-0.5 bg-secondary-200 rounded">N</kbd> Next highlight
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
