import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const COMPLETION_TOKENS_MODELS = ['gpt-5.2', 'o1', 'o1-mini', 'o1-preview']

function usesCompletionTokens(model: string): boolean {
  return COMPLETION_TOKENS_MODELS.some(m => model.startsWith(m))
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const model = searchParams.get('model') || 'gpt-5.2'

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const tokenParam = usesCompletionTokens(model)
      ? { max_completion_tokens: 10 }
      : { max_tokens: 10 }

    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Say "working" in one word.' }],
      ...tokenParam,
    })

    return NextResponse.json({
      success: true,
      model,
      response: response.choices[0]?.message?.content,
      actualModel: response.model
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      model,
      error: error.message || String(error),
      errorType: error.constructor.name,
      status: error.status,
      code: error.code
    }, { status: 500 })
  }
}
