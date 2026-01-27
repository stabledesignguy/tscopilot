'use client'

import { useState, useEffect, useCallback } from 'react'
import { ProductList } from '@/components/products/ProductList'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { Product, Message, LLMProvider } from '@/types'

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [llmProvider, setLlmProvider] = useState<LLMProvider>('claude')
  const { t } = useTranslation()

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products')
        const data = await response.json()
        setProducts(data.products || [])
      } catch (error) {
        console.error('Failed to fetch products:', error)
      }
    }
    fetchProducts()
  }, [])

  // Load conversation when product changes
  useEffect(() => {
    const loadConversation = async () => {
      if (!selectedProduct) {
        setMessages([])
        setConversationId(null)
        return
      }

      try {
        const response = await fetch(
          `/api/conversations?productId=${selectedProduct.id}`
        )
        const data = await response.json()

        if (data.conversations?.length > 0) {
          const latestConversation = data.conversations[0]
          setConversationId(latestConversation.id)

          // Load messages for this conversation
          const messagesResponse = await fetch(
            `/api/messages?conversationId=${latestConversation.id}`
          )
          const messagesData = await messagesResponse.json()
          setMessages(messagesData.messages || [])
        } else {
          setConversationId(null)
          setMessages([])
        }
      } catch (error) {
        console.error('Failed to load conversation:', error)
        setMessages([])
        setConversationId(null)
      }
    }

    loadConversation()
  }, [selectedProduct])

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!selectedProduct) return

      setIsLoading(true)

      // Optimistically add user message
      const userMessage: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId || '',
        role: 'user',
        content,
        llm_used: null,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMessage])

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            conversationId,
            productId: selectedProduct.id,
            llmProvider,
          }),
        })

        if (!response.ok) {
          throw new Error('Chat request failed')
        }

        // Get conversation ID from header
        const newConversationId = response.headers.get('X-Conversation-Id')
        if (newConversationId && !conversationId) {
          setConversationId(newConversationId)
        }

        const provider =
          (response.headers.get('X-LLM-Provider') as LLMProvider) || llmProvider

        // Stream the response
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let assistantContent = ''

        const assistantMessage: Message = {
          id: `temp-assistant-${Date.now()}`,
          conversation_id: newConversationId || conversationId || '',
          role: 'assistant',
          content: '',
          llm_used: provider,
          created_at: new Date().toISOString(),
        }

        setMessages((prev) => [...prev, assistantMessage])

        while (reader) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          assistantContent += chunk

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id
                ? { ...m, content: assistantContent }
                : m
            )
          )
        }
      } catch (error) {
        console.error('Chat error:', error)
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))
      } finally {
        setIsLoading(false)
      }
    },
    [selectedProduct, conversationId, llmProvider]
  )

  const handleExport = useCallback(() => {
    if (!selectedProduct || messages.length === 0) return

    const text = messages
      .map((m) => {
        const role = m.role === 'user' ? t('chat.you') : t('chat.assistant')
        return `${role}:\n${m.content}\n`
      })
      .join('\n---\n\n')

    const header = `# ${t('chat.conversation', { productName: selectedProduct.name })}\n${t('chat.exported', { date: new Date().toLocaleString() })}\n\n---\n\n`
    const content = header + text

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedProduct.name.toLowerCase().replace(/\s+/g, '-')}-conversation.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [selectedProduct, messages, t])

  const handleClear = useCallback(() => {
    if (confirm(t('chat.clearConfirm'))) {
      setMessages([])
      setConversationId(null)
    }
  }, [t])

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-secondary-200 flex flex-col">
        <ProductList
          products={products}
          selectedProductId={selectedProduct?.id || null}
          onSelectProduct={setSelectedProduct}
        />
      </aside>

      {/* Chat Area */}
      <ChatWindow
        product={selectedProduct}
        conversationId={conversationId}
        messages={messages}
        onSendMessage={handleSendMessage}
        onExport={handleExport}
        onClear={handleClear}
        isLoading={isLoading}
        llmProvider={llmProvider}
      />
    </div>
  )
}
