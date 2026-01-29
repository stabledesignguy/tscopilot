'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

/**
 * Client-side callback handler for auth flows that use URL fragments
 * (implicit flow with access_token in hash)
 */
export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient()

      // Check for tokens in URL fragment (hash)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      if (accessToken && refreshToken) {
        // Set session from tokens in URL fragment
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (sessionError) {
          setError(sessionError.message)
          return
        }

        // Get the user to auto-accept pending invitations
        const { data: { user } } = await supabase.auth.getUser()

        if (user?.email) {
          // Call API to accept pending invitations
          try {
            await fetch('/api/auth/accept-invitations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            })
          } catch (e) {
            // Non-critical - continue even if this fails
            console.error('Failed to auto-accept invitations:', e)
          }
        }

        // Redirect to home
        router.push('/')
        return
      }

      // Check for code in query params (PKCE flow)
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError) {
          setError(exchangeError.message)
          return
        }

        router.push('/')
        return
      }

      // No auth params found
      setError('No authentication parameters found')
    }

    handleCallback()
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="text-primary-600 hover:underline"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary-50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
        <p className="text-secondary-600">Completing sign in...</p>
      </div>
    </div>
  )
}
