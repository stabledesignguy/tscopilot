import { GoogleGenerativeAI } from '@google/generative-ai'
import type { LLMMessage, LLMResponse, StreamingLLMResponse } from '@/types'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '')

const DEFAULT_MODEL = 'gemini-1.5-pro'

export async function generateGeminiResponse(
  messages: LLMMessage[],
  systemPrompt?: string,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<LLMResponse> {
  const model = genAI.getGenerativeModel({
    model: options?.model || DEFAULT_MODEL,
    systemInstruction: systemPrompt,
  })

  const chat = model.startChat({
    history: messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      maxOutputTokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 0.7,
    },
  })

  const lastMessage = messages[messages.length - 1]
  const result = await chat.sendMessage(lastMessage.content)
  const response = result.response

  return {
    content: response.text(),
    provider: 'gemini',
    model: options?.model || DEFAULT_MODEL,
    usage: response.usageMetadata
      ? {
          promptTokens: response.usageMetadata.promptTokenCount || 0,
          completionTokens: response.usageMetadata.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata.totalTokenCount || 0,
        }
      : undefined,
  }
}

export async function streamGeminiResponse(
  messages: LLMMessage[],
  systemPrompt?: string,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<StreamingLLMResponse> {
  const model = genAI.getGenerativeModel({
    model: options?.model || DEFAULT_MODEL,
    systemInstruction: systemPrompt,
  })

  const chat = model.startChat({
    history: messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      maxOutputTokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 0.7,
    },
  })

  const lastMessage = messages[messages.length - 1]
  const result = await chat.sendMessageStream(lastMessage.content)

  const encoder = new TextEncoder()

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) {
            controller.enqueue(encoder.encode(text))
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
    provider: 'gemini',
    model: options?.model || DEFAULT_MODEL,
  }
}
