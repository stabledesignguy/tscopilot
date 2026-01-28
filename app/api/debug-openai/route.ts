import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function GET(request: NextRequest) {
  try {
    const hasKey = !!process.env.OPENAI_API_KEY
    const keyPreview = process.env.OPENAI_API_KEY
      ? `${process.env.OPENAI_API_KEY.slice(0, 7)}...${process.env.OPENAI_API_KEY.slice(-4)}`
      : 'NOT SET'

    if (!hasKey) {
      return NextResponse.json({
        configured: false,
        keyPreview,
        error: 'OPENAI_API_KEY not set'
      })
    }

    // Try a simple API call
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Say "OpenAI is working" in exactly 3 words.' }],
      max_tokens: 20,
    })

    return NextResponse.json({
      configured: true,
      keyPreview,
      testResponse: response.choices[0]?.message?.content || 'No response',
      model: response.model,
      success: true
    })
  } catch (error) {
    return NextResponse.json({
      configured: true,
      error: String(error),
      success: false
    }, { status: 500 })
  }
}
