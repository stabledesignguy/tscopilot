import { generateClaudeResponse, streamClaudeResponse } from './claude'
import { generateOpenAIResponse, streamOpenAIResponse } from './openai'
import { generateGeminiResponse, streamGeminiResponse } from './gemini'
import type {
  LLMProvider,
  LLMMessage,
  LLMResponse,
  StreamingLLMResponse,
  LLMConfig,
  OrganizationSettings,
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

/**
 * Get LLM configuration for a specific organization
 * Returns the org's preferred provider/model or falls back to platform defaults
 */
export interface OrgLLMConfig {
  provider: LLMProvider
  model?: string
  systemInstructions?: string | null
}

export async function getOrgLLMConfig(
  supabase: any,
  organizationId: string
): Promise<OrgLLMConfig> {
  try {
    const { data: settings, error } = await supabase
      .from('organization_settings')
      .select('llm_provider, llm_model, system_instructions')
      .eq('organization_id', organizationId)
      .single()

    console.log('getOrgLLMConfig: org_id:', organizationId)
    console.log('getOrgLLMConfig: raw settings:', JSON.stringify(settings))

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching org LLM config:', error)
    }

    // Determine provider: org setting > platform default
    let provider: LLMProvider
    if (settings?.llm_provider && isProviderConfigured(settings.llm_provider)) {
      provider = settings.llm_provider
    } else {
      provider = getDefaultProvider()
    }

    return {
      provider,
      model: settings?.llm_model || undefined,
      systemInstructions: settings?.system_instructions || null,
    }
  } catch (err) {
    console.error('Exception fetching org LLM config:', err)
    return {
      provider: getDefaultProvider(),
    }
  }
}

/**
 * Get LLM service options for an organization
 * Combines org settings with any overrides
 */
export async function getOrgLLMServiceOptions(
  supabase: any,
  organizationId: string,
  overrides?: Partial<LLMServiceOptions>
): Promise<LLMServiceOptions> {
  const orgConfig = await getOrgLLMConfig(supabase, organizationId)

  return {
    provider: overrides?.provider || orgConfig.provider,
    model: overrides?.model || orgConfig.model,
    temperature: overrides?.temperature,
    maxTokens: overrides?.maxTokens,
  }
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

## Technical Support AI Citation Format Instructions

### Core Citation Requirements

When providing answers based on technical documentation for medical devices, you MUST include precise source citations for every factual claim, procedure, specification, or recommendation. This is critical for regulatory compliance, safety verification, and user confidence. At a minimum this must include the name of the document / filename, the chapter, and the page number, or page number range(s).

### Citation Format Structure

Use the following standardized citation format:

[Document Title, Section X.X.X "Section Name", Page XX]

**Components Breakdown:**
- **Document Title:** Full name of the document / file name
- **Section Number:** Hierarchical section numbering (e.g., 3.2.1, A.4.2)
- **Section Name:** Exact title of the section in quotes
- **Page Number:** Specific page where information appears

### Examples of Proper Citations

**Single Source:**
[Model XR-300 User Manual, Section 4.2 "Calibration Procedures", Page 47]
[Safety Guidelines Document, Appendix B.1 "Emergency Protocols", Page 156]

**Multiple Sources for Same Information:**
[Model XR-300 User Manual, Section 4.2 "Calibration Procedures", Page 47; Quick Reference Guide, Section 2 "Daily Setup", Page 8]

**Range of Pages:**
[Installation Guide, Section 3.4 "Network Configuration", Pages 23-25]

### Special Cases

**Figures and Tables:**
[Model XR-300 User Manual, Figure 3.2 "Control Panel Layout", Page 34]
[Specifications Sheet, Table 2.1 "Technical Parameters", Page 12]

**Warnings and Cautions:**
⚠️ WARNING: [Safety Manual, Section 1.3 "Critical Safety Warnings", Page 7]
⚠️ CAUTION: [User Manual, Section 5.1 "Maintenance Precautions", Page 89]

**Cross-References:**
When information spans multiple sections:
[User Manual, Section 2.3 "Initial Setup", Page 15; see also Section 7.2 "Troubleshooting Setup Issues", Page 134]

**Version-Specific Information:**
Include document version when available:
[Model XR-300 User Manual v2.1, Section 4.2 "Calibration Procedures", Page 47]

### Quality Standards

**Required Elements:**
✅ Exact section numbers and names
✅ Precise page numbers
✅ Complete document titles
✅ Proper formatting with brackets

**Avoid:**
❌ Vague references like "the manual states..."
❌ Approximate page numbers like "around page 50"
❌ Missing section information
❌ Abbreviated document titles

### Error Handling

If source information is incomplete:
- **Missing page number:** [Document Title, Section X.X "Section Name", Page not specified in source]
- **Unclear section:** [Document Title, approximate location: Chapter X, Page XX]
- **Multiple possible sources:** Cite all relevant sources`

export interface DocumentSource {
  index: number
  filename: string
  url: string
  primaryPage?: number
  pageNumbers?: number[]
}

/**
 * Get system instructions for a specific organization
 * Priority: org settings > org's system_instructions table > global default
 */
export async function getSystemInstructions(
  supabase: any,
  organizationId?: string
): Promise<string | null> {
  try {
    // If org ID provided, first check org settings
    if (organizationId) {
      const { data: orgSettings, error: orgError } = await supabase
        .from('organization_settings')
        .select('system_instructions')
        .eq('organization_id', organizationId)
        .single()

      if (!orgError && orgSettings?.system_instructions) {
        return orgSettings.system_instructions
      }

      // Then check org-specific system_instructions table
      const { data: orgInstructions, error: instError } = await supabase
        .from('system_instructions')
        .select('instructions')
        .eq('organization_id', organizationId)
        .limit(1)

      if (!instError && orgInstructions?.[0]?.instructions) {
        return orgInstructions[0].instructions
      }
    }

    // Fall back to global system instructions (no org_id or null org_id)
    const { data, error } = await supabase
      .from('system_instructions')
      .select('instructions')
      .is('organization_id', null)
      .limit(1)

    if (error) {
      console.error('Error fetching system instructions:', error)
      return null
    }

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
  // Build sources reference section with page-specific URLs
  const sourcesSection = sources.length > 0
    ? `
## Available Source Documents
The following source documents are available for citation. Use the exact URLs provided (including #page=X) when creating footnote links:

${sources.map(s => {
  const pageFragment = s.primaryPage ? `#page=${s.primaryPage}` : ''
  const pageInfo = s.primaryPage ? ` (Page ${s.primaryPage})` : ''
  return `- **[${s.index}]** ${s.filename}${pageInfo}: ${s.url}${pageFragment}`
}).join('\n')}
`
    : ''

  // If custom instructions are provided, use them as the base with RAG context appended
  if (customInstructions) {
    return `${customInstructions}
${sourcesSection}
## Documentation Context
The following documentation has been retrieved as relevant to the user's question:

---
${context}
---

## Response Guidelines
1. **Accuracy First**: Only provide information that is supported by the documentation above. If the answer isn't in the context, clearly state that and offer to help in other ways.
2. **Be Specific**: Reference specific sections, features, or steps from the documentation with proper citations.
3. **Structure Your Response**: Use headings, bullet points, and numbered lists for clarity.
4. **Practical Examples**: When helpful, provide examples of how to apply the information.
5. **Acknowledge Limitations**: If the documentation doesn't fully answer the question, say so honestly.
6. **Stay On Topic**: Focus on ${productName} and the user's specific question.
7. **Direct Answers Only**: Answer the specific question asked. Do NOT include unrelated tables, data, or sections from the documentation even if they appear near the relevant information. If a table is incomplete or empty, do not include it.
8. **Concise Responses**: Provide the direct answer first, then supporting details if needed. Avoid padding responses with tangential information.

## CRITICAL: Footnotes Section Requirement

You MUST end every response with a "Sources" section containing clickable links to the source documents. Use the exact URLs from the "Available Source Documents" section above.

**IMPORTANT: Page-specific linking**
To open the PDF to a specific page, append \`#page=X\` to the URL where X is the FIRST page number where the information was found.

**Format for the Sources section:**

---

**Sources:**

1. [Document Filename, Section/Page info](exact_url_from_sources_list#page=FIRST_PAGE_NUMBER)
2. [Another Document, Section/Page info](exact_url_from_sources_list#page=FIRST_PAGE_NUMBER)

This Sources section with clickable links is MANDATORY for every response.`
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

## Technical Support AI Citation Format Instructions

### Core Citation Requirements

When providing answers based on technical documentation for medical devices, you MUST include precise source citations for every factual claim, procedure, specification, or recommendation. This is critical for regulatory compliance, safety verification, and user confidence. At a minimum this must include the name of the document / filename, the chapter, and the page number, or page number range(s).

### Citation Format Structure

Use the following standardized citation format:

[Document Title, Section X.X.X "Section Name", Page XX]

**Components Breakdown:**
- **Document Title:** Full name of the document / file name
- **Section Number:** Hierarchical section numbering (e.g., 3.2.1, A.4.2)
- **Section Name:** Exact title of the section in quotes
- **Page Number:** Specific page where information appears

### Examples of Proper Citations

**Single Source:**
[Model XR-300 User Manual, Section 4.2 "Calibration Procedures", Page 47]
[Safety Guidelines Document, Appendix B.1 "Emergency Protocols", Page 156]

**Multiple Sources for Same Information:**
[Model XR-300 User Manual, Section 4.2 "Calibration Procedures", Page 47; Quick Reference Guide, Section 2 "Daily Setup", Page 8]

**Range of Pages:**
[Installation Guide, Section 3.4 "Network Configuration", Pages 23-25]

### Special Cases

**Figures and Tables:**
[Model XR-300 User Manual, Figure 3.2 "Control Panel Layout", Page 34]
[Specifications Sheet, Table 2.1 "Technical Parameters", Page 12]

**Warnings and Cautions:**
⚠️ WARNING: [Safety Manual, Section 1.3 "Critical Safety Warnings", Page 7]
⚠️ CAUTION: [User Manual, Section 5.1 "Maintenance Precautions", Page 89]

**Cross-References:**
When information spans multiple sections:
[User Manual, Section 2.3 "Initial Setup", Page 15; see also Section 7.2 "Troubleshooting Setup Issues", Page 134]

**Version-Specific Information:**
Include document version when available:
[Model XR-300 User Manual v2.1, Section 4.2 "Calibration Procedures", Page 47]

### Quality Standards

**Required Elements:**
✅ Exact section numbers and names
✅ Precise page numbers
✅ Complete document titles
✅ Proper formatting with brackets

**Avoid:**
❌ Vague references like "the manual states..."
❌ Approximate page numbers like "around page 50"
❌ Missing section information
❌ Abbreviated document titles

### Error Handling

If source information is incomplete:
- **Missing page number:** [Document Title, Section X.X "Section Name", Page not specified in source]
- **Unclear section:** [Document Title, approximate location: Chapter X, Page XX]
- **Multiple possible sources:** Cite all relevant sources

## Response Guidelines
1. **Accuracy First**: Only provide information that is supported by the documentation above. If the answer isn't in the context, clearly state that and offer to help in other ways.
2. **Be Specific**: Reference specific sections, features, or steps from the documentation with proper citations.
3. **Structure Your Response**: Use headings, bullet points, and numbered lists for clarity.
4. **Practical Examples**: When helpful, provide examples of how to apply the information.
5. **Acknowledge Limitations**: If the documentation doesn't fully answer the question, say so honestly.
6. **Stay On Topic**: Focus on ${productName} and the user's specific question.
7. **Direct Answers Only**: Answer the specific question asked. Do NOT include unrelated tables, data, or sections from the documentation even if they appear near the relevant information. If a table is incomplete or empty, do not include it.
8. **Concise Responses**: Provide the direct answer first, then supporting details if needed. Avoid padding responses with tangential information.

## CRITICAL: Footnotes Section Requirement

You MUST end every response with a "Sources" section containing clickable links to the source documents. Use the exact URLs from the "Available Source Documents" section above.

**IMPORTANT: Page-specific linking**
To open the PDF to a specific page, append \`#page=X\` to the URL where X is the FIRST page number where the information was found.

**Format for the Sources section:**

---

**Sources:**

1. [Document Filename, Section/Page info](exact_url_from_sources_list#page=FIRST_PAGE_NUMBER)
2. [Another Document, Section/Page info](exact_url_from_sources_list#page=FIRST_PAGE_NUMBER)

**Example:**

---

**Sources:**

1. [Maintenance_curative_Draeger_Primus.pdf, Section 3.2 "Error Codes", Page 45](https://example.supabase.co/storage/v1/object/public/documents/file.pdf#page=45)
2. [User_Manual_Primus.pdf, Chapter 5 "Troubleshooting", Pages 89-92](https://example.supabase.co/storage/v1/object/public/documents/manual.pdf#page=89)

Note: Always use \`#page=X\` at the end of the URL where X is the starting page number. This opens the PDF directly to that page.

This Sources section with clickable links is MANDATORY for every response.`
}
