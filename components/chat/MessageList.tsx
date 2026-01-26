'use client'

import { useEffect, useRef } from 'react'
import { Bot, User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message } from '@/types'

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
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
              {message.role === 'user' ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </p>
              ) : (
                <div className="prose prose-sm prose-slate max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-xl font-bold text-slate-900 mt-4 mb-2 first:mt-0">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-lg font-bold text-slate-900 mt-4 mb-2 first:mt-0">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-base font-bold text-slate-800 mt-3 mb-1 first:mt-0">
                          {children}
                        </h3>
                      ),
                      h4: ({ children }) => (
                        <h4 className="text-sm font-bold text-slate-800 mt-2 mb-1 first:mt-0">
                          {children}
                        </h4>
                      ),
                      p: ({ children }) => (
                        <p className="text-sm leading-relaxed mb-3 last:mb-0">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-outside ml-4 mb-3 space-y-1 text-sm">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-outside ml-4 mb-3 space-y-1 text-sm">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="leading-relaxed">{children}</li>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-slate-900">
                          {children}
                        </strong>
                      ),
                      em: ({ children }) => (
                        <em className="italic">{children}</em>
                      ),
                      code: ({ className, children, ...props }) => {
                        const isInline = !className
                        return isInline ? (
                          <code className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-xs font-mono">
                            {children}
                          </code>
                        ) : (
                          <code
                            className="block bg-slate-800 text-slate-100 p-3 rounded-lg text-xs font-mono overflow-x-auto my-2"
                            {...props}
                          >
                            {children}
                          </code>
                        )
                      },
                      pre: ({ children }) => (
                        <pre className="bg-slate-800 text-slate-100 p-3 rounded-lg text-xs font-mono overflow-x-auto my-3">
                          {children}
                        </pre>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-primary-500 pl-3 py-1 my-3 bg-primary-50 rounded-r text-sm italic">
                          {children}
                        </blockquote>
                      ),
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-700 underline"
                        >
                          {children}
                        </a>
                      ),
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-3">
                          <table className="min-w-full text-sm border-collapse border border-slate-300 rounded">
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-slate-200">{children}</thead>
                      ),
                      th: ({ children }) => (
                        <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border border-slate-300 px-3 py-2">
                          {children}
                        </td>
                      ),
                      hr: () => <hr className="my-4 border-slate-300" />,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
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
