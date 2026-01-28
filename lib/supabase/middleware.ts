import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ORG_STORAGE_KEY = 'tscopilot_current_org_id'
const ORG_HEADER_KEY = 'x-organization-id'

export async function updateSession(request: NextRequest) {
  // Clone headers to add org context
  const requestHeaders = new Headers(request.headers)

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Define protected routes
  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  const isSuperAdminRoute = request.nextUrl.pathname.startsWith('/super-admin')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')
  const isInvitationRoute = request.nextUrl.pathname.startsWith('/invitation')

  // Allow API routes to handle their own auth
  if (isApiRoute) {
    // Inject organization ID from cookie if available
    const orgIdFromCookie = request.cookies.get(ORG_STORAGE_KEY)?.value
    if (orgIdFromCookie) {
      requestHeaders.set(ORG_HEADER_KEY, orgIdFromCookie)
      response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
    }
    return response
  }

  // Allow invitation routes for unauthenticated users
  if (isInvitationRoute) {
    return response
  }

  // Redirect unauthenticated users to login
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Get user profile for role checking
  let profile: { role: string; is_super_admin: boolean } | null = null
  if (user && (isAdminRoute || isSuperAdminRoute)) {
    const { data } = await supabase
      .from('profiles')
      .select('role, is_super_admin')
      .eq('id', user.id)
      .single()
    profile = data
  }

  // Check super admin access
  if (user && isSuperAdminRoute) {
    if (!profile?.is_super_admin) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  // Check org admin access (requires being admin of current org OR super admin)
  if (user && isAdminRoute) {
    // Super admins can access all admin routes
    if (profile?.is_super_admin) {
      return response
    }

    // Get current org from cookie
    const currentOrgId = request.cookies.get(ORG_STORAGE_KEY)?.value

    if (!currentOrgId) {
      // No org selected - check if user has any org where they're admin
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!membership) {
        const url = request.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
      }
    } else {
      // Check if user is admin of current org
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('organization_id', currentOrgId)
        .eq('is_active', true)
        .single()

      if (membership?.role !== 'admin') {
        const url = request.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
      }
    }
  }

  return response
}

/**
 * Get organization ID from request headers (set by middleware)
 */
export function getOrgIdFromRequest(request: NextRequest): string | null {
  return request.headers.get(ORG_HEADER_KEY)
}
