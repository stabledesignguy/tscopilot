import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const ORG_STORAGE_KEY = 'tscopilot_current_org_id'

// Helper to get current org ID from cookie
async function getCurrentOrgId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(ORG_STORAGE_KEY)?.value || null
}

// Route segment config for App Router
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const orgId = searchParams.get('organizationId') || await getCurrentOrgId()

    let query = supabase
      .from('documents')
      .select('*, products:products(id, name, organization_id)')
      .order('created_at', { ascending: false })

    if (productId) {
      query = query.eq('product_id', productId)
    }

    const { data: documents, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filter by organization if provided
    let filteredDocuments = documents || []
    if (orgId) {
      filteredDocuments = filteredDocuments.filter(
        (doc: any) => doc.products?.organization_id === orgId
      )
    }

    return NextResponse.json({ documents: filteredDocuments })
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

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const productId = formData.get('productId') as string

    if (!file || !productId) {
      return NextResponse.json(
        { error: 'File and product ID are required' },
        { status: 400 }
      )
    }

    // Get the product to check its organization
    const { data: product } = await supabase
      .from('products')
      .select('organization_id')
      .eq('id', productId)
      .single()

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Check if user has permission
    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    const productOrgId = (product as any).organization_id
    if (!profile?.is_super_admin && productOrgId) {
      const { data: membership } = await (supabase
        .from('organization_members') as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', productOrgId)
        .eq('is_active', true)
        .single()

      if (membership?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PDF, DOCX, TXT, MD' },
        { status: 400 }
      )
    }

    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${productId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file)

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('documents').getPublicUrl(fileName)

    // Create document record
    const { data: document, error: docError } = await (supabase
      .from('documents') as any)
      .insert({
        product_id: productId,
        filename: file.name,
        file_url: publicUrl,
        file_size: file.size,
        mime_type: file.type,
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
    console.error('Document upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('id')

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // Get document info with product's organization
    const { data: document } = await supabase
      .from('documents')
      .select('file_url, product_id, products(organization_id)')
      .eq('id', documentId)
      .single()

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check if user has permission
    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    const orgId = (document as any).products?.organization_id
    if (!profile?.is_super_admin && orgId) {
      const { data: membership } = await (supabase
        .from('organization_members') as any)
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .single()

      if (membership?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    if (document) {
      // Extract file path from URL
      const urlParts = (document as any).file_url.split('/documents/')
      if (urlParts[1]) {
        await supabase.storage.from('documents').remove([urlParts[1]])
      }
    }

    // Delete document chunks
    await supabase.from('document_chunks').delete().eq('document_id', documentId)

    // Delete document record
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)

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
