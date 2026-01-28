import OpenAI from 'openai'
import type { LLMMessage, LLMResponse, StreamingLLMResponse } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const DEFAULT_MODEL = 'gpt-4o'

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

  const response = await openai.chat.completions.create({
    model,
    messages: formattedMessages,
    max_tokens: options?.maxTokens || 4096,
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

  console.log('OpenAI: Starting stream request with model:', model)

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

  console.log('OpenAI: Sending', formattedMessages.length, 'messages')

  let stream
  try {
    stream = await openai.chat.completions.create({
      model,
      messages: formattedMessages,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 0.7,
      stream: true,
    })
    console.log('OpenAI: Stream created successfully')
  } catch (error) {
    console.error('OpenAI: Error creating stream:', error)
    throw error
  }

  const encoder = new TextEncoder()

  const readableStream = new ReadableStream({
    async start(controller) {
      let chunkCount = 0
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content
          if (content) {
            chunkCount++
            controller.enqueue(encoder.encode(content))
          }
        }
        console.log('OpenAI: Stream completed with', chunkCount, 'chunks')
        controller.close()
      } catch (error) {
        console.error('OpenAI: Stream error:', error)
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
