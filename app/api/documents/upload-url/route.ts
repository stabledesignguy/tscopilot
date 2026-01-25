import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { filename, productId, contentType } = body

    if (!filename || !productId) {
      return NextResponse.json(
        { error: 'Filename and product ID are required' },
        { status: 400 }
      )
    }

    // Generate unique file path
    const fileExt = filename.split('.').pop()
    const filePath = `${productId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    // Create signed upload URL (valid for 1 hour)
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUploadUrl(filePath)

    if (error) {
      console.error('Signed URL error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      path: filePath,
      token: data.token,
    })
  } catch (error) {
    console.error('Upload URL error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
