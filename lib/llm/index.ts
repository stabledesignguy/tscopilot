import { generateClaudeResponse, streamClaudeResponse } from './claude'
import { generateOpenAIResponse, streamOpenAIResponse } from './openai'
import { generateGeminiResponse, streamGeminiResponse } from './gemini'
import type {
  LLMProvider,
  LLMMessage,
  LLMResponse,
  StreamingLLMResponse,
  LLMConfig,
} from '@/types'

export interface LLMServiceOptions {
  provider: LLMProvider
  model?: string
  temperature?: number
  maxTokens?: number
}

export async function generateResponse(
  messages: LLMMessage[],
  systemPrompt?: string,
  options: LLMServiceOptions = { provider: 'claude' }
): Promise<LLMResponse> {
  const { provider, ...restOptions } = options

  switch (provider) {
    case 'claude':
      return generateClaudeResponse(messages, systemPrompt, restOptions)
    case 'openai':
      return generateOpenAIResponse(messages, systemPrompt, restOptions)
    case 'gemini':
      return generateGeminiResponse(messages, systemPrompt, restOptions)
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`)
  }
}

export async function streamResponse(
  messages: LLMMessage[],
  systemPrompt?: string,
  options: LLMServiceOptions = { provider: 'claude' }
): Promise<StreamingLLMResponse> {
  const { provider, ...restOptions } = options

  switch (provider) {
    case 'claude':
      return streamClaudeResponse(messages, systemPrompt, restOptions)
    case 'openai':
      return streamOpenAIResponse(messages, systemPrompt, restOptions)
    case 'gemini':
      return streamGeminiResponse(messages, systemPrompt, restOptions)
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`)
  }
}

export function getDefaultProvider(): LLMProvider {
  // Priority: Claude > OpenAI > Gemini
  if (process.env.ANTHROPIC_API_KEY) return 'claude'
  if (process.env.OPENAI_API_KEY) return 'openai'
  if (process.env.GOOGLE_AI_API_KEY) return 'gemini'
  return 'claude' // Default fallback
}

export function isProviderConfigured(provider: LLMProvider): boolean {
  switch (provider) {
    case 'claude':
      return !!process.env.ANTHROPIC_API_KEY
    case 'openai':
      return !!process.env.OPENAI_API_KEY
    case 'gemini':
      return !!process.env.GOOGLE_AI_API_KEY
    default:
      return false
  }
}

export function getConfiguredProviders(): LLMProvider[] {
  const providers: LLMProvider[] = []
  if (process.env.ANTHROPIC_API_KEY) providers.push('claude')
  if (process.env.OPENAI_API_KEY) providers.push('openai')
  if (process.env.GOOGLE_AI_API_KEY) providers.push('gemini')
  return providers
}

export const defaultSystemPrompt = `You are a helpful AI assistant that answers questions about technical products.
You have access to documentation and knowledge about various products.
Be concise, accurate, and helpful in your responses.
If you don't know something, say so rather than making up information.
When referencing documentation, cite the relevant sections when possible.`

export function buildRAGPrompt(context: string, productName: string): string {
  return `You are a helpful AI assistant specializing in answering questions about ${productName}.

Use the following documentation context to answer the user's question. If the answer is not in the context, say so and provide general guidance if possible.

---
DOCUMENTATION CONTEXT:
${context}
---

Remember to:
1. Be accurate and cite the documentation when relevant
2. Be concise but thorough
3. If the question cannot be answered from the context, acknowledge this
4. Provide practical examples when helpful`
}
