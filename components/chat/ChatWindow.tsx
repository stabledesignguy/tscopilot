'use client'

import { useCallback, useEffect } from 'react'
import { MessageSquare, Download, Trash2, ArrowLeft } from 'lucide-react'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { SourceProvider, useSourceContext, type SourceMetadata } from './SourceContext'
import { Button } from '@/components/ui/Button'
import { useTranslation } from '@/lib/i18n/useTranslation'
import dynamic from 'next/dynamic'
import type { Product, Message, LLMProvider } from '@/types'

// Dynamically import PDFViewer to reduce initial bundle size
const PDFViewer = dynamic(
  () => import('@/components/pdf/PDFViewer').then(mod => ({ default: mod.PDFViewer })),
  { ssr: false, loading: () => null }
)

interface ChatWindowProps {
  product: Product | null
  conversationId: string | null
  messages: Message[]
  onSendMessage: (message: string) => Promise<void>
  onExport: () => void
  onClear: () => void
  isLoading: boolean
  llmProvider?: LLMProvider
  onBack?: () => void
  sourceMetadata?: SourceMetadata[]
}

export function ChatWindow(props: ChatWindowProps) {
  return (
    <SourceProvider>
      <ChatWindowInner {...props} />
    </SourceProvider>
  )
}

function ChatWindowInner({
  product,
  conversationId,
  messages,
  onSendMessage,
  onExport,
  onClear,
  isLoading,
  llmProvider,
  onBack,
  sourceMetadata,
}: ChatWindowProps) {
  const { t } = useTranslation()
  const { setSourceMetadata, pdfViewer, closePDFViewer } = useSourceContext()

  // Sync source metadata from props to context when it changes
  useEffect(() => {
    if (sourceMetadata && sourceMetadata.length > 0) {
      setSourceMetadata(sourceMetadata)
    }
  }, [sourceMetadata, setSourceMetadata])

  const handleSend = useCallback(
    async (message: string) => {
      await onSendMessage(message)
    },
    [onSendMessage]
  )

  if (!product) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-secondary-50 text-secondary-400 p-4">
        <MessageSquare className="w-12 sm:w-16 h-12 sm:h-16 mb-3 sm:mb-4" />
        <h2 className="text-lg sm:text-xl font-medium text-secondary-600 text-center">
          {t('chat.selectProduct')}
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-center max-w-xs">
          {t('chat.selectProductDesc')}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Header - Fixed at top of chat area */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-secondary-200 bg-white flex-shrink-0 z-10">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="md:hidden flex-shrink-0 p-1.5 -ml-1 text-secondary-500 hover:text-secondary-700 hover:bg-secondary-100 rounded-lg transition-colors"
                aria-label={t('common.back')}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-secondary-900 truncate">{product.name}</h1>
              {product.description && (
                <p className="text-xs sm:text-sm text-secondary-500 truncate hidden sm:block">{product.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {messages.length > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={onExport} className="px-2 sm:px-3">
                  <Download className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">{t('chat.export')}</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={onClear} className="px-2 sm:px-3">
                  <Trash2 className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">{t('chat.clear')}</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-secondary-400">
            <MessageSquare className="w-12 h-12 mb-3" />
            <p className="text-sm">{t('chat.askAnything', { productName: product.name })}</p>
          </div>
        ) : (
          <MessageList messages={messages} isLoading={isLoading} />
        )}

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          disabled={isLoading}
          placeholder={t('chat.askAbout', { productName: product.name })}
        />
      </div>

      {/* PDF Viewer Modal */}
      {pdfViewer.isOpen && pdfViewer.url && pdfViewer.filename && (
        <PDFViewer
          url={pdfViewer.url}
          filename={pdfViewer.filename}
          pageInfo={pdfViewer.pageInfo}
          onClose={closePDFViewer}
        />
      )}
    </>
  )
}
