'use client'

import { useState, useCallback } from 'react'
import { MessageSquare, Download, Trash2 } from 'lucide-react'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { Button } from '@/components/ui/Button'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { Product, Message, LLMProvider } from '@/types'

interface ChatWindowProps {
  product: Product | null
  conversationId: string | null
  messages: Message[]
  onSendMessage: (message: string) => Promise<void>
  onExport: () => void
  onClear: () => void
  isLoading: boolean
  llmProvider?: LLMProvider
}

export function ChatWindow({
  product,
  conversationId,
  messages,
  onSendMessage,
  onExport,
  onClear,
  isLoading,
  llmProvider,
}: ChatWindowProps) {
  const { t } = useTranslation()

  const handleSend = useCallback(
    async (message: string) => {
      await onSendMessage(message)
    },
    [onSendMessage]
  )

  if (!product) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-secondary-50 text-secondary-400">
        <MessageSquare className="w-16 h-16 mb-4" />
        <h2 className="text-xl font-medium text-secondary-600">
          {t('chat.selectProduct')}
        </h2>
        <p className="mt-2 text-sm">
          {t('chat.selectProductDesc')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Header - Fixed at top of chat area */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-200 bg-white flex-shrink-0 z-10">
        <div>
          <h1 className="text-lg font-semibold text-secondary-900">{product.name}</h1>
          {product.description && (
            <p className="text-sm text-secondary-500">{product.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={onExport}>
                <Download className="w-4 h-4 mr-1" />
                {t('chat.export')}
              </Button>
              <Button variant="ghost" size="sm" onClick={onClear}>
                <Trash2 className="w-4 h-4 mr-1" />
                {t('chat.clear')}
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
  )
}
