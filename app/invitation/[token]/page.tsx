'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Building2, Loader2, CheckCircle, XCircle, LogIn } from 'lucide-react'
import Link from 'next/link'

interface InvitationData {
  email: string
  role: string
  organization: {
    name: string
    slug: string
    logo_url: string | null
  }
  expires_at: string
}

export default function InvitationPage() {
  const params = useParams()
  const token = params.token as string
  const router = useRouter()
  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAccepting, setIsAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [needsAuth, setNeedsAuth] = useState(false)

  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const response = await fetch(`/api/invitations?token=${token}`)
        const data = await response.json()

        if (response.ok) {
          setInvitation(data.invitation)
        } else {
          setError(data.error || 'Failed to load invitation')
        }
      } catch (err) {
        setError('Failed to load invitation')
      } finally {
        setIsLoading(false)
      }
    }

    fetchInvitation()
  }, [token])

  const handleAccept = async () => {
    setIsAccepting(true)
    setError(null)

    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await response.json()

      if (response.ok) {
        setAccepted(true)
        // Redirect to home after a short delay
        setTimeout(() => {
          router.push('/')
        }, 2000)
      } else if (response.status === 401) {
        setNeedsAuth(true)
      } else {
        setError(data.error || 'Failed to accept invitation')
      }
    } catch (err) {
      setError('Failed to accept invitation')
    } finally {
      setIsAccepting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-secondary-900 mb-2">
              Invalid Invitation
            </h1>
            <p className="text-secondary-500 mb-6">{error}</p>
            <Link href="/auth/login">
              <Button variant="outline">Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-secondary-900 mb-2">
              Welcome to {invitation?.organization.name}!
            </h1>
            <p className="text-secondary-500 mb-4">
              You have successfully joined the organization.
            </p>
            <p className="text-sm text-secondary-400">
              Redirecting you to the app...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (needsAuth) {
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 justify-center mb-4">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                {invitation?.organization.logo_url ? (
                  <img
                    src={invitation.organization.logo_url}
                    alt={invitation.organization.name}
                    className="w-8 h-8 rounded-lg"
                  />
                ) : (
                  <Building2 className="w-6 h-6 text-primary-600" />
                )}
              </div>
              <div className="text-left">
                <h2 className="font-semibold text-secondary-900">
                  {invitation?.organization.name}
                </h2>
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-center">
            <LogIn className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-secondary-900 mb-2">
              Sign In Required
            </h1>
            <p className="text-secondary-500 mb-6">
              Please sign in or create an account with the email address{' '}
              <strong>{invitation?.email}</strong> to accept this invitation.
            </p>
            <Link href={`/auth/login?redirect=/invitation/${token}`}>
              <Button className="w-full">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In to Continue
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3 justify-center">
            <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center">
              {invitation?.organization.logo_url ? (
                <img
                  src={invitation.organization.logo_url}
                  alt={invitation.organization.name}
                  className="w-12 h-12 rounded-lg"
                />
              ) : (
                <Building2 className="w-8 h-8 text-primary-600" />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-center">
          <h1 className="text-xl font-semibold text-secondary-900 mb-2">
            You&apos;re invited to join
          </h1>
          <h2 className="text-2xl font-bold text-primary-600 mb-4">
            {invitation?.organization.name}
          </h2>

          <p className="text-secondary-500 mb-2">
            You&apos;ve been invited to join as a{' '}
            <span className="font-medium text-secondary-700 capitalize">
              {invitation?.role}
            </span>
          </p>
          <p className="text-sm text-secondary-400 mb-6">
            Invitation sent to {invitation?.email}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Button
            onClick={handleAccept}
            disabled={isAccepting}
            className="w-full"
          >
            {isAccepting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Accepting...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Accept Invitation
              </>
            )}
          </Button>

          <p className="mt-4 text-xs text-secondary-400">
            This invitation expires on{' '}
            {new Date(invitation?.expires_at || '').toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
