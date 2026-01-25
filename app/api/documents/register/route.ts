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
    const { filename, productId, filePath, fileSize, mimeType } = body

    if (!filename || !productId || !filePath) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get public URL for the uploaded file
    const {
      data: { publicUrl },
    } = supabase.storage.from('documents').getPublicUrl(filePath)

    // Create document record
    const { data: document, error: docError } = await (supabase
      .from('documents') as any)
      .insert({
        product_id: productId,
        filename: filename,
        file_url: publicUrl,
        file_size: fileSize || 0,
        mime_type: mimeType || 'application/octet-stream',
        processing_status: 'pending',
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 500 })
    }

    // Trigger document processing (async)
    fetch(`${request.nextUrl.origin}/api/documents/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: document.id }),
    }).catch(console.error)

    return NextResponse.json({ document }, { status: 201 })
  } catch (error) {
    console.error('Document register error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
