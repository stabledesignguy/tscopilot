import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const model = searchParams.get('model') || 'gpt-5.2'

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Say "working" in one word.' }],
      max_tokens: 10,
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
