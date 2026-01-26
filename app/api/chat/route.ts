import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  streamResponse,
  getDefaultProvider,
  buildRAGPrompt,
  defaultSystemPrompt,
  isProviderConfigured,
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

    // Get or create conversation
    let activeConversationId = conversationId
    if (!activeConversationId) {
      const { data: newConversation, error: convError } = await (supabase
        .from('conversations') as any)
        .insert({
          user_id: user.id,
          product_id: productId,
          title: message.slice(0, 50),
        })
        .select()
        .single()

      if (convError) {
        return NextResponse.json({ error: convError.message }, { status: 500 })
      }
      activeConversationId = newConversation.id
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

    // Get product info
    const { data: product } = await (supabase
      .from('products') as any)
      .select('name')
      .eq('id', productId)
      .single()

    // Get conversation history
    const { data: history } = await (supabase
      .from('messages') as any)
      .select('role, content')
      .eq('conversation_id', activeConversationId)
      .order('created_at', { ascending: true })
      .limit(20)

    const messages: LLMMessage[] =
      history?.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })) || []

    // Retrieve relevant document chunks for RAG
    let systemPrompt = defaultSystemPrompt
    try {
      const chunks = await retrieveRelevantChunks(message, productId, 5)
      if (chunks.length > 0) {
        const context = chunks.map((c) => c.chunk.content).join('\n\n---\n\n')
        systemPrompt = buildRAGPrompt(context, product?.name || 'this product')
      }
    } catch (error) {
      console.error('RAG retrieval error:', error)
      // Continue without RAG context
    }

    // Generate streaming response
    const provider: LLMProvider = llmProvider || getDefaultProvider()

    // Check if the provider is configured
    if (!isProviderConfigured(provider)) {
      return NextResponse.json(
        { error: `LLM provider '${provider}' is not configured. Please add the API key in Vercel environment variables.` },
        { status: 500 }
      )
    }

    const { stream } = await streamResponse(messages, systemPrompt, {
      provider,
    })

    // Create a transform stream to accumulate the response
    let fullResponse = ''
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk)
        fullResponse += text
        controller.enqueue(chunk)
      },
      async flush() {
        // Save assistant message after streaming completes
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
      },
    })

    const responseStream = stream.pipeThrough(transformStream)

    return new NextResponse(responseStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-store, max-age=0',
        'X-Conversation-Id': activeConversationId,
        'X-LLM-Provider': provider,
      },
    })
  } catch (error) {
    console.error('Chat error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Chat failed: ${errorMessage}` },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  }
}
