'use client'

import { useEffect, useRef } from 'react'
import { Bot, User } from 'lucide-react'
import type { Message, LLMProvider } from '@/types'

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
}

const llmLabels: Record<LLMProvider, string> = {
  claude: 'Claude',
  openai: 'ChatGPT',
  gemini: 'Gemini',
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 message-fade-in ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-600" />
              </div>
            )}
            <div
              className={`max-w-[80%] ${
                message.role === 'user'
                  ? 'bg-primary-600 text-white rounded-2xl rounded-tr-md px-4 py-3'
                  : 'bg-slate-100 text-slate-900 rounded-2xl rounded-tl-md px-4 py-3'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content}
              </p>
              {message.role === 'assistant' && message.llm_used && (
                <p className="mt-2 text-xs opacity-60">
                  Powered by {llmLabels[message.llm_used]}
                </p>
              )}
            </div>
            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                <User className="w-4 h-4 text-slate-600" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start message-fade-in">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-600" />
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-slate-400 rounded-full loading-dot" />
                <span className="w-2 h-2 bg-slate-400 rounded-full loading-dot" />
                <span className="w-2 h-2 bg-slate-400 rounded-full loading-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
