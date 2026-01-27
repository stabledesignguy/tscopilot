import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { defaultSystemPrompt } from '@/lib/llm'

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await (supabase
      .from('system_instructions') as any)
      .select('*')
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      instructions: data?.instructions || null,
      defaultInstructions: defaultSystemPrompt,
      updatedAt: data?.updated_at || null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { instructions } = body

    if (typeof instructions !== 'string') {
      return NextResponse.json(
        { error: 'Instructions must be a string' },
        { status: 400 }
      )
    }

    // Check if a record already exists
    const { data: existing } = await (supabase
      .from('system_instructions') as any)
      .select('id')
      .limit(1)
      .single()

    let result
    if (existing) {
      // Update existing record
      result = await (supabase
        .from('system_instructions') as any)
        .update({
          instructions,
          updated_by: user.id,
        })
        .eq('id', existing.id)
        .select()
        .single()
    } else {
      // Insert new record
      result = await (supabase
        .from('system_instructions') as any)
        .insert({
          instructions,
          updated_by: user.id,
        })
        .select()
        .single()
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      instructions: result.data.instructions,
      updatedAt: result.data.updated_at,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()

    // Check if user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete all system instructions (reset to default)
    const { error } = await (supabase
      .from('system_instructions') as any)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
