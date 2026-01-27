'use client'

import { useEffect, useRef, useCallback } from 'react'

interface PDFHighlightLayerProps {
  searchText: string
  pageNumber: number
  containerRef: React.RefObject<HTMLDivElement>
}

// Normalize text for fuzzy matching
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim()
}

// Find text matches in the text layer
function findTextMatches(
  textLayer: HTMLElement,
  searchText: string
): HTMLElement[] {
  const normalizedSearch = normalizeText(searchText)
  if (!normalizedSearch || normalizedSearch.length < 10) return []

  const textSpans = textLayer.querySelectorAll('span')
  const matches: HTMLElement[] = []

  // Build text content map from spans
  let fullText = ''
  const spanMap: Array<{ span: HTMLElement; start: number; end: number }> = []

  textSpans.forEach((span) => {
    const start = fullText.length
    const spanText = span.textContent || ''
    fullText += spanText + ' '
    spanMap.push({ span: span as HTMLElement, start, end: fullText.length })
  })

  const normalizedFull = normalizeText(fullText)

  // Try to find the search text in the normalized full text
  // Use a sliding window approach for fuzzy matching
  const searchWords = normalizedSearch.split(' ').filter(w => w.length > 2)
  if (searchWords.length === 0) return []

  // Find spans containing search words
  const matchedSpans = new Set<HTMLElement>()

  searchWords.slice(0, 5).forEach((word) => {
    spanMap.forEach(({ span }) => {
      const spanText = normalizeText(span.textContent || '')
      if (spanText.includes(word)) {
        matchedSpans.add(span)
      }
    })
  })

  // If we have enough word matches, consider it a match
  if (matchedSpans.size >= Math.min(3, searchWords.length)) {
    matches.push(...matchedSpans)
  }

  return matches
}

export function PDFHighlightLayer({
  searchText,
  pageNumber,
  containerRef
}: PDFHighlightLayerProps) {
  const highlightsRef = useRef<HTMLDivElement[]>([])

  const clearHighlights = useCallback(() => {
    highlightsRef.current.forEach((el) => el.remove())
    highlightsRef.current = []
  }, [])

  const applyHighlights = useCallback(() => {
    if (!containerRef.current || !searchText) return

    clearHighlights()

    // Find the text layer for the current page
    const textLayer = containerRef.current.querySelector(
      `.react-pdf__Page[data-page-number="${pageNumber}"] .react-pdf__Page__textContent`
    ) as HTMLElement

    if (!textLayer) return

    const matches = findTextMatches(textLayer, searchText)

    matches.forEach((span) => {
      const rect = span.getBoundingClientRect()
      const containerRect = containerRef.current!.getBoundingClientRect()

      const highlight = document.createElement('div')
      highlight.className = 'pdf-highlight'
      highlight.style.cssText = `
        position: absolute;
        left: ${rect.left - containerRect.left + containerRef.current!.scrollLeft}px;
        top: ${rect.top - containerRect.top + containerRef.current!.scrollTop}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        background-color: rgba(255, 235, 59, 0.4);
        pointer-events: none;
        z-index: 10;
        border-radius: 2px;
      `

      containerRef.current!.appendChild(highlight)
      highlightsRef.current.push(highlight)
    })
  }, [searchText, pageNumber, containerRef, clearHighlights])

  useEffect(() => {
    // Apply highlights after a short delay to ensure text layer is rendered
    const timer = setTimeout(applyHighlights, 500)
    return () => {
      clearTimeout(timer)
      clearHighlights()
    }
  }, [applyHighlights, clearHighlights])

  // Re-apply on resize
  useEffect(() => {
    const handleResize = () => {
      clearHighlights()
      setTimeout(applyHighlights, 100)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [applyHighlights, clearHighlights])

  return null
}
