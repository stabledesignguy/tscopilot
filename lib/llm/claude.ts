import Anthropic from '@anthropic-ai/sdk'
import type { LLMMessage, LLMResponse, StreamingLLMResponse } from '@/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'

export async function generateClaudeResponse(
  messages: LLMMessage[],
  systemPrompt?: string,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<LLMResponse> {
  const model = options?.model || DEFAULT_MODEL

  const response = await anthropic.messages.create({
    model,
    max_tokens: options?.maxTokens || 4096,
    temperature: options?.temperature ?? 0.7,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  })

  const textContent = response.content.find((c) => c.type === 'text')
  const content = textContent?.type === 'text' ? textContent.text : ''

  return {
    content,
    provider: 'claude',
    model,
    usage: {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    },
  }
}

export async function streamClaudeResponse(
  messages: LLMMessage[],
  systemPrompt?: string,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<StreamingLLMResponse> {
  const model = options?.model || DEFAULT_MODEL

  const stream = await anthropic.messages.stream({
    model,
    max_tokens: options?.maxTokens || 4096,
    temperature: options?.temperature ?? 0.7,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  })

  const encoder = new TextEncoder()

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })

  return {
    stream: readableStream,
    provider: 'claude',
    model,
  }
}
