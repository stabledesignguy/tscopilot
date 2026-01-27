'use client'

import { useState, useRef, type FormEvent, type KeyboardEvent } from 'react'
import { Send, Paperclip } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/useTranslation'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({
  onSend,
  disabled,
  placeholder,
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { t } = useTranslation()

  const actualPlaceholder = placeholder || t('chat.placeholder')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (message.trim() && !disabled) {
      onSend(message.trim())
      setMessage('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`
    }
  }

  return (
    <div className="border-t border-secondary-200 bg-white p-2 sm:p-4 flex-shrink-0">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
        <div className="relative flex items-end gap-2 bg-secondary-50 rounded-2xl border border-secondary-200 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={actualPlaceholder}
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent px-3 sm:px-4 py-2.5 sm:py-3 text-sm resize-none focus:outline-none disabled:opacity-50 max-h-[200px]"
          />
          <div className="flex items-center gap-1 pr-2 pb-2">
            <button
              type="submit"
              disabled={disabled || !message.trim()}
              className="p-2 rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-secondary-400 text-center hidden sm:block">
          {t('chat.enterToSend')}
        </p>
      </form>
    </div>
  )
}
