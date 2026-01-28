import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  streamResponse,
  getDefaultProvider,
  buildRAGPrompt,
  defaultSystemPrompt,
  isProviderConfigured,
  getSystemInstructions,
  getOrgLLMConfig,
} from '@/lib/llm'
import { retrieveRelevantChunks } from '@/lib/rag/retriever'
import type { LLMProvider, LLMMessage } from '@/types'

// Force Node.js runtime (not Edge)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0
export const maxDuration = 60

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export async function GET() {
  // Check which LLM providers are configured
  const providers = {
    claude: isProviderConfigured('claude'),
    openai: isProviderConfigured('openai'),
    gemini: isProviderConfigured('gemini'),
  }
  const defaultProvider = getDefaultProvider()

  return NextResponse.json(
    {
      status: 'Chat API is running',
      method: 'GET',
      providers,
      defaultProvider,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      }
    }
  )
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { message, conversationId, productId, llmProvider } = body

    if (!message || !productId) {
      return NextResponse.json(
        { error: 'Message and product ID are required' },
        { status: 400 }
      )
    }

    // Get product info including organization (needed for conversation creation)
    const { data: product } = await (supabase
      .from('products') as any)
      .select('name, organization_id')
      .eq('id', productId)
      .single()

    const organizationId = product?.organization_id

    // Get or create conversation
    let activeConversationId = conversationId

    // If conversationId provided, verify it belongs to this product
    if (activeConversationId) {
      const { data: existingConv } = await (supabase
        .from('conversations') as any)
        .select('product_id')
        .eq('id', activeConversationId)
        .single()

      // If conversation doesn't exist or belongs to different product, create new one
      if (!existingConv || existingConv.product_id !== productId) {
        console.log('Conversation mismatch - creating new conversation for product:', productId)
        activeConversationId = null
      }
    }

    if (!activeConversationId) {
      const { data: newConversation, error: convError } = await (supabase
        .from('conversations') as any)
        .insert({
          user_id: user.id,
          product_id: productId,
          organization_id: organizationId,
          title: message.slice(0, 50),
        })
        .select()
        .single()

      if (convError) {
        return NextResponse.json({ error: convError.message }, { status: 500 })
      }
      activeConversationId = newConversation.id
      console.log('Created new conversation:', activeConversationId, 'for product:', productId, 'in org:', organizationId)
    }

    // Save user message
    const { error: msgError } = await (supabase.from('messages') as any).insert({
      conversation_id: activeConversationId,
      role: 'user',
      content: message,
      llm_used: null,
    })

    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 500 })
    }

    // Get conversation history
    const { data: history } = await (supabase
      .from('messages') as any)
      .select('role, content')
      .eq('conversation_id', activeConversationId)
      .order('created_at', { ascending: true })
      .limit(20)

    const messages: LLMMessage[] =
      history
        ?.filter((m: any) => m.content && m.content.trim().length > 0) // Filter out empty messages
        .map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })) || []

    // Fetch custom system instructions - prioritizes org settings, then org instructions, then global
    const customInstructions = await getSystemInstructions(supabase, organizationId)

    // Retrieve relevant document chunks for RAG
    let systemPrompt = customInstructions || defaultSystemPrompt
    let sourceMetadata: Array<{
      filename: string
      url: string
      pageInfo?: {
        pageNumbers: number[]
        primaryPage: number
        searchText: string
      }
    }> = []

    try {
      console.log('RAG: Product name:', product?.name, '| Product ID:', productId)
      console.log('RAG: Query:', message.slice(0, 50))
      const chunks = await retrieveRelevantChunks(message, productId, 15)
      console.log('RAG: Retrieved', chunks.length, 'chunks')
      if (chunks.length > 0) {
        console.log('RAG: Top chunk score:', chunks[0]?.score)
        console.log('RAG: Sources:', chunks.map(c => c.document?.filename).join(', '))
        console.log('RAG: PageInfo available:', chunks.filter(c => c.pageInfo).length, 'of', chunks.length, 'chunks')

        // Build context with source information
        const contextParts = chunks.map((c, index) => {
          const pageRef = c.pageInfo?.primaryPage ? `#page=${c.pageInfo.primaryPage}` : ''
          const sourceInfo = c.document
            ? `[Source ${index + 1}: ${c.document.filename}](${c.document.file_url}${pageRef})`
            : `[Source ${index + 1}]`
          return `${sourceInfo}\n${c.chunk.content}`
        })
        const context = contextParts.join('\n\n---\n\n')

        // Build sources list for the prompt (including page info)
        const sources = chunks
          .filter(c => c.document)
          .map((c, index) => ({
            index: index + 1,
            filename: c.document!.filename,
            url: c.document!.file_url,
            pageNumbers: c.pageInfo?.pageNumbers,
            primaryPage: c.pageInfo?.primaryPage,
          }))

        // Build source metadata with page info for frontend
        sourceMetadata = chunks
          .filter(c => c.document)
          .map(c => ({
            filename: c.document!.filename,
            url: c.document!.file_url,
            pageInfo: c.pageInfo
          }))

        systemPrompt = buildRAGPrompt(context, product?.name || 'this product', sources, customInstructions || undefined)
        console.log('RAG: Using RAG prompt with context length:', context.length)
      } else {
        console.log('RAG: No chunks found, using default prompt')
      }
    } catch (error) {
      console.error('RAG retrieval error:', error)
      // Continue without RAG context
    }

    // Get organization LLM config if available
    let orgLLMConfig = null
    if (organizationId) {
      orgLLMConfig = await getOrgLLMConfig(supabase, organizationId)
    }

    // Generate streaming response
    // Priority: explicit param > org setting > platform default
    const provider: LLMProvider = llmProvider || orgLLMConfig?.provider || getDefaultProvider()
    const model = orgLLMConfig?.model

    // Check if the provider is configured
    if (!isProviderConfigured(provider)) {
      return NextResponse.json(
        { error: `LLM provider '${provider}' is not configured. Please add the API key in Vercel environment variables.` },
        { status: 500 }
      )
    }

    console.log('LLM: Sending request to provider:', provider)
    console.log('LLM: System prompt length:', systemPrompt.length)
    console.log('LLM: Messages count:', messages.length)

    let streamResult
    try {
      streamResult = await streamResponse(messages, systemPrompt, {
        provider,
        model,
      })
    } catch (llmError) {
      console.error('LLM stream error:', llmError)
      return NextResponse.json(
        { error: `LLM failed: ${llmError instanceof Error ? llmError.message : 'Unknown error'}` },
        { status: 500 }
      )
    }

    const { stream } = streamResult

    // Create a transform stream to accumulate the response
    let fullResponse = ''
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk)
        fullResponse += text
        controller.enqueue(chunk)
      },
      async flush() {
        // Only save assistant message if it has content
        if (fullResponse && fullResponse.trim().length > 0) {
          await (supabase.from('messages') as any).insert({
            conversation_id: activeConversationId,
            role: 'assistant',
            content: fullResponse,
            llm_used: provider,
          })

          // Update conversation timestamp
          await (supabase
            .from('conversations') as any)
            .update({ updated_at: new Date().toISOString() })
            .eq('id', activeConversationId)
        } else {
          console.warn('LLM returned empty response, not saving to database')
        }
      },
    })

    const responseStream = stream.pipeThrough(transformStream)

    // Prepare headers with source metadata
    const headers: Record<string, string> = {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-store, max-age=0',
      'X-Conversation-Id': activeConversationId,
      'X-LLM-Provider': provider,
    }

    // Add source metadata if available (URL-encoded JSON for header safety)
    if (sourceMetadata.length > 0) {
      headers['X-Source-Metadata'] = encodeURIComponent(JSON.stringify(sourceMetadata))
    }

    return new NextResponse(responseStream, { headers })
  } catch (error) {
    console.error('Chat error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Chat failed: ${errorMessage}` },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }
}
