'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

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
    .replace(/[^\w\sàâäéèêëïîôùûüç]/g, '') // Keep French accented chars
    .trim()
}

export function PDFHighlightLayer({
  searchText,
  pageNumber,
  containerRef
}: PDFHighlightLayerProps) {
  const highlightsRef = useRef<HTMLDivElement[]>([])
  const [attempts, setAttempts] = useState(0)

  const clearHighlights = useCallback(() => {
    highlightsRef.current.forEach((el) => el.remove())
    highlightsRef.current = []
  }, [])

  const applyHighlights = useCallback(() => {
    if (!containerRef.current || !searchText) {
      return false
    }

    clearHighlights()

    // Try multiple selectors for the text layer
    const selectors = [
      `.react-pdf__Page__textContent`,
      `.textLayer`,
      `[data-page-number="${pageNumber}"] .react-pdf__Page__textContent`,
      `.react-pdf__Page .react-pdf__Page__textContent`
    ]

    let textLayer: HTMLElement | null = null
    for (const selector of selectors) {
      textLayer = containerRef.current.querySelector(selector) as HTMLElement
      if (textLayer) break
    }

    if (!textLayer) {
      return false
    }

    // Get all text spans
    const textSpans = textLayer.querySelectorAll('span')

    if (textSpans.length === 0) {
      return false
    }

    // Normalize search text and extract words
    const normalizedSearch = normalizeText(searchText)
    const searchWords = normalizedSearch.split(' ').filter(w => w.length > 2)

    // Find spans containing search words
    const matchedSpans: HTMLElement[] = []

    textSpans.forEach((span) => {
      const spanText = normalizeText(span.textContent || '')
      if (!spanText) return

      // Check if this span contains any of the search words
      const hasMatch = searchWords.slice(0, 8).some(word => spanText.includes(word))
      if (hasMatch) {
        matchedSpans.push(span as HTMLElement)
      }
    })

    // Create highlight overlays
    matchedSpans.forEach((span) => {
      const rect = span.getBoundingClientRect()
      const containerRect = containerRef.current!.getBoundingClientRect()

      // Skip if span has no size
      if (rect.width === 0 || rect.height === 0) return

      const highlight = document.createElement('div')
      highlight.className = 'pdf-highlight'
      highlight.style.cssText = `
        position: absolute;
        left: ${rect.left - containerRect.left + containerRef.current!.scrollLeft}px;
        top: ${rect.top - containerRect.top + containerRef.current!.scrollTop}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        background-color: rgba(255, 235, 59, 0.5);
        pointer-events: none;
        z-index: 10;
        border-radius: 2px;
        mix-blend-mode: multiply;
      `

      containerRef.current!.appendChild(highlight)
      highlightsRef.current.push(highlight)
    })

    return highlightsRef.current.length > 0
  }, [searchText, pageNumber, containerRef, clearHighlights])

  useEffect(() => {
    // Try multiple times with increasing delays
    const delays = [100, 300, 600, 1000, 2000]
    let currentAttempt = 0
    let timerId: NodeJS.Timeout

    const tryHighlight = () => {
      const success = applyHighlights()
      if (!success && currentAttempt < delays.length - 1) {
        currentAttempt++
        setAttempts(currentAttempt)
        timerId = setTimeout(tryHighlight, delays[currentAttempt])
      }
    }

    timerId = setTimeout(tryHighlight, delays[0])

    return () => {
      clearTimeout(timerId)
      clearHighlights()
    }
  }, [applyHighlights, clearHighlights, searchText, pageNumber])

  // Re-apply on resize
  useEffect(() => {
    const handleResize = () => {
      clearHighlights()
      setTimeout(applyHighlights, 200)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [applyHighlights, clearHighlights])

  return null
}
