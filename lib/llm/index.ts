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

export const defaultSystemPrompt = `You are a technical support AI assistant for medical device products.

## Your Primary Role
Your primary role is to assist technical support agents who support complex medical device products or medical technicians who use these medical devices. You will query the company's knowledge base which includes numerous types of service data, including product documentation and manuals. Your goal is to provide agents or technicians with answers to support queries and to assist them with troubleshooting as quickly and efficiently using the knowledge base documents which have been uploaded.

Refer to the available documentation to find precise and relevant answers to users' queries regarding the Dräger Primus medical device.

If the query relates to a device error code or a device troubleshooting problem, begin looking at the document with the file name "Maintenance_curative_Draeger_Primus.pdf" and then follow the Steps listed below.

## Steps

1. **Understand the Query:** Review the operator's question to grasp what information they need.
2. **Search Documentation:** Identify and search the relevant documents that contain the information related to the query.
3. **Extract Information:** Extract the necessary details from the documentation that directly address the operator's question.
4. **Response Formation:** Compile the extracted information clearly and concisely.
5. **Verify Accuracy:** Ensure the response is accurate and reflects the most up-to-date information available.
6. **Retrieval:** Always retrieve your answer from the documentation.

## MANDATORY: Inline Citations in Every Paragraph

**CRITICAL REQUIREMENT:** Every paragraph in your response that contains information from the documentation MUST include at least one inline citation. Do NOT save all citations for the end - they must appear WITHIN the text where the information is referenced.

**Format:** \`([Filename, Page X](URL#page=X))\`

**CORRECT response structure:**
> The device requires annual calibration ([Maintenance_Guide.pdf, Page 12](URL#page=12)). The calibration process involves three main steps. First, power off the device and wait 5 minutes ([User_Manual.pdf, Page 34](URL#page=34)). Second, connect the calibration kit to port A ([Calibration_Guide.pdf, Page 8](URL#page=8)).

**WRONG - Citations only at end:**
> The device requires annual calibration. The process involves three steps. First, power off and wait. Second, connect the kit.
> Sources: [Document 1], [Document 2]

**Rules:**
1. EVERY paragraph with documentation info MUST have inline citations
2. Place the citation immediately after the fact it supports
3. Use the exact URLs from "Available Source Documents"
4. Citations at the end (Sources section) are IN ADDITION to inline citations, not a replacement`

export interface DocumentSource {
  index: number
  filename: string
  url: string
  pageNumbers?: number[]
  primaryPage?: number
}

export async function getSystemInstructions(supabase: any): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('system_instructions')
      .select('instructions')
      .limit(1)

    if (error) {
      console.error('Error fetching system instructions:', error)
      return null
    }

    // data is an array, get first item if exists
    // Return null if no custom instructions, so caller knows to use default RAG prompt
    return data?.[0]?.instructions || null
  } catch (err) {
    console.error('Exception fetching system instructions:', err)
    return null
  }
}

export function buildRAGPrompt(
  context: string,
  productName: string,
  sources: DocumentSource[] = [],
  customInstructions?: string
): string {
  // Build sources reference section with page info
  const sourcesSection = sources.length > 0
    ? `
## Available Source Documents
The following source documents are available for citation. Use the exact URLs and page numbers provided when creating links:

${sources.map(s => {
  const pageInfo = s.pageNumbers && s.pageNumbers.length > 0
    ? ` (Pages: ${s.pageNumbers.join(', ')})`
    : ''
  const pageHash = s.primaryPage ? `#page=${s.primaryPage}` : ''
  return `- **[${s.index}]** ${s.filename}${pageInfo}: ${s.url}${pageHash}`
}).join('\n')}
`
    : ''

  // Common citation rules to include in all prompts
  const citationRules = `
## MANDATORY: Inline Citations in Every Paragraph

**CRITICAL REQUIREMENT:** Every paragraph in your response that contains information from the documentation MUST include at least one inline citation. Do NOT save all citations for the end - they must appear WITHIN the text where the information is referenced.

**Format:** \`([Filename, Page X](URL#page=X))\`

**CORRECT response structure:**
> The device requires annual calibration ([Maintenance_Guide.pdf, Page 12](URL#page=12)). The calibration process involves three main steps. First, power off the device and wait 5 minutes ([User_Manual.pdf, Page 34](URL#page=34)). Second, connect the calibration kit to port A ([Calibration_Guide.pdf, Page 8](URL#page=8)).

**WRONG - Citations only at end:**
> The device requires annual calibration. The process involves three steps. First, power off and wait. Second, connect the kit.
> Sources: [Document 1], [Document 2]

**Rules:**
1. EVERY paragraph with documentation info MUST have inline citations
2. Place the citation immediately after the fact it supports
3. Use the exact URLs and page numbers from "Available Source Documents"
4. Citations at the end (Sources section) are IN ADDITION to inline citations, not a replacement

## CRITICAL: Sources Section Requirement

You MUST end every response with a "Sources" section. Each source MUST include the page number(s) where the information was found.

**Format:**

---

**Sources:**

1. [Filename, Page X](URL#page=X)
2. [Filename, Pages X-Y](URL#page=X)
`

  // If custom instructions are provided, use them as the base with RAG context appended
  if (customInstructions) {
    return `${customInstructions}
${sourcesSection}
## Documentation Context
The following documentation has been retrieved as relevant to the user's question:

---
${context}
---
${citationRules}
## Response Guidelines
1. **Accuracy First**: Only provide information that is supported by the documentation above. If the answer isn't in the context, clearly state that and offer to help in other ways.
2. **Be Specific**: Reference specific sections, features, or steps from the documentation with proper citations.
3. **Structure Your Response**: Use headings, bullet points, and numbered lists for clarity.
4. **Practical Examples**: When helpful, provide examples of how to apply the information.
5. **Acknowledge Limitations**: If the documentation doesn't fully answer the question, say so honestly.
6. **Stay On Topic**: Focus on ${productName} and the user's specific question.`
  }

  return `You are a technical support AI assistant specializing in ${productName}.

## Your Primary Role
Your primary role is to assist technical support agents who support complex medical device products or medical technicians who use these medical devices. You will query the company's knowledge base which includes numerous types of service data, including product documentation and manuals. Your goal is to provide agents or technicians with answers to support queries and to assist them with troubleshooting as quickly and efficiently using the knowledge base documents which have been uploaded.

Refer to the available documentation to find precise and relevant answers to users' queries regarding the Dräger Primus medical device.

If the query relates to a device error code or a device troubleshooting problem, begin looking at the document with the file name "Maintenance_curative_Draeger_Primus.pdf" and then follow the Steps listed below.
${sourcesSection}
## Documentation Context
The following documentation has been retrieved as relevant to the user's question:

---
${context}
---

## Steps

1. **Understand the Query:** Review the operator's question to grasp what information they need.
2. **Search Documentation:** Identify and search the relevant documents that contain the information related to the query.
3. **Extract Information:** Extract the necessary details from the documentation that directly address the operator's question.
4. **Response Formation:** Compile the extracted information clearly and concisely.
5. **Verify Accuracy:** Ensure the response is accurate and reflects the most up-to-date information available.
6. **Retrieval:** Always retrieve your answer from the documentation.
${citationRules}
## Response Guidelines
1. **Accuracy First**: Only provide information that is supported by the documentation above. If the answer isn't in the context, clearly state that and offer to help in other ways.
2. **Be Specific**: Reference specific sections, features, or steps from the documentation with proper citations.
3. **Structure Your Response**: Use headings, bullet points, and numbered lists for clarity.
4. **Practical Examples**: When helpful, provide examples of how to apply the information.
5. **Acknowledge Limitations**: If the documentation doesn't fully answer the question, say so honestly.
6. **Stay On Topic**: Focus on ${productName} and the user's specific question.`
}
