import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { streamResponse, getOrgLLMConfig, isProviderConfigured, getDefaultProvider } from '@/lib/llm'
import type { LLMProvider } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { productId, message } = await request.json()

    if (!productId || !message) {
      return NextResponse.json({ error: 'productId and message required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Step 1: Get product's organization
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('name, organization_id')
      .eq('id', productId)
      .single()

    if (productError) {
      return NextResponse.json({ step: 1, error: productError.message }, { status: 500 })
    }

    const organizationId = product.organization_id

    // Step 2: Get org LLM config
    let orgLLMConfig = null
    if (organizationId) {
      orgLLMConfig = await getOrgLLMConfig(supabase, organizationId)
    }

    // Step 3: Determine provider and model
    const provider: LLMProvider = orgLLMConfig?.provider || getDefaultProvider()
    const model = orgLLMConfig?.model

    // Step 4: Check if provider is configured
    const isConfigured = isProviderConfigured(provider)

    if (!isConfigured) {
      return NextResponse.json({
        step: 4,
        error: `Provider ${provider} not configured`,
        provider,
        model,
        orgLLMConfig
      }, { status: 500 })
    }

    // Step 5: Try to call the LLM
    try {
      const result = await streamResponse(
        [{ role: 'user' as const, content: message }],
        'You are a helpful assistant. Be very brief.',
        { provider, model }
      )

      // Read a bit of the stream to verify it works
      const reader = result.stream.getReader()
      let responseText = ''
      let chunkCount = 0

      while (chunkCount < 10) {
        const { done, value } = await reader.read()
        if (done) break
        responseText += new TextDecoder().decode(value)
        chunkCount++
      }
      reader.releaseLock()

      return NextResponse.json({
        success: true,
        product: product.name,
        organizationId,
        provider,
        model: model || 'default',
        orgLLMConfig,
        responsePreview: responseText.slice(0, 200),
        chunksReceived: chunkCount
      })
    } catch (llmError) {
      return NextResponse.json({
        step: 5,
        error: `LLM call failed: ${llmError instanceof Error ? llmError.message : String(llmError)}`,
        provider,
        model,
        orgLLMConfig
      }, { status: 500 })
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
