import OpenAI from 'openai'
import type { LLMMessage, LLMResponse, StreamingLLMResponse } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const DEFAULT_MODEL = 'gpt-4o'

// Models that use max_completion_tokens instead of max_tokens
const COMPLETION_TOKENS_MODELS = ['gpt-5.2', 'o1', 'o1-mini', 'o1-preview']

function usesCompletionTokens(model: string): boolean {
  return COMPLETION_TOKENS_MODELS.some(m => model.startsWith(m))
}

export async function generateOpenAIResponse(
  messages: LLMMessage[],
  systemPrompt?: string,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<LLMResponse> {
  const model = options?.model || DEFAULT_MODEL

  const formattedMessages: OpenAI.ChatCompletionMessageParam[] = []

  if (systemPrompt) {
    formattedMessages.push({ role: 'system', content: systemPrompt })
  }

  messages.forEach((m) => {
    formattedMessages.push({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    })
  })

  const tokenParam = usesCompletionTokens(model)
    ? { max_completion_tokens: options?.maxTokens || 4096 }
    : { max_tokens: options?.maxTokens || 4096 }

  const response = await openai.chat.completions.create({
    model,
    messages: formattedMessages,
    ...tokenParam,
    temperature: options?.temperature ?? 0.7,
  })

  return {
    content: response.choices[0]?.message?.content || '',
    provider: 'openai',
    model,
    usage: response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined,
  }
}

export async function streamOpenAIResponse(
  messages: LLMMessage[],
  systemPrompt?: string,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<StreamingLLMResponse> {
  const model = options?.model || DEFAULT_MODEL

  const formattedMessages: OpenAI.ChatCompletionMessageParam[] = []

  if (systemPrompt) {
    formattedMessages.push({ role: 'system', content: systemPrompt })
  }

  messages.forEach((m) => {
    formattedMessages.push({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    })
  })

  const tokenParam = usesCompletionTokens(model)
    ? { max_completion_tokens: options?.maxTokens || 4096 }
    : { max_tokens: options?.maxTokens || 4096 }

  const stream = await openai.chat.completions.create({
    model,
    messages: formattedMessages,
    ...tokenParam,
    temperature: options?.temperature ?? 0.7,
    stream: true,
  })

  const encoder = new TextEncoder()

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content
          if (content) {
            controller.enqueue(encoder.encode(content))
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
    provider: 'openai',
    model,
  }
}
