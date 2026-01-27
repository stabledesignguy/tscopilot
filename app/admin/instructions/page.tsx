'use client'

import { useState, useEffect } from 'react'
import { Loader2, Save, RotateCcw, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useTranslation } from '@/lib/i18n/useTranslation'

export default function SystemInstructionsPage() {
  const [instructions, setInstructions] = useState('')
  const [defaultInstructions, setDefaultInstructions] = useState('')
  const [originalInstructions, setOriginalInstructions] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const { t } = useTranslation()

  useEffect(() => {
    fetchInstructions()
  }, [])

  const fetchInstructions = async () => {
    try {
      const response = await fetch('/api/system-instructions')
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      const currentInstructions = data.instructions || data.defaultInstructions
      setInstructions(currentInstructions)
      setOriginalInstructions(currentInstructions)
      setDefaultInstructions(data.defaultInstructions)
    } catch (error) {
      console.error('Failed to fetch instructions:', error)
      setMessage({ type: 'error', text: t('common.error') })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/system-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save')
      }

      setOriginalInstructions(instructions)
      setMessage({ type: 'success', text: t('admin.saveSuccess') })
    } catch (error) {
      console.error('Failed to save instructions:', error)
      setMessage({ type: 'error', text: t('admin.saveFailed') })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm(t('admin.resetConfirm'))) {
      return
    }

    setIsSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/system-instructions', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reset')
      }

      setInstructions(defaultInstructions)
      setOriginalInstructions(defaultInstructions)
      setMessage({ type: 'success', text: t('admin.saveSuccess') })
    } catch (error) {
      console.error('Failed to reset instructions:', error)
      setMessage({ type: 'error', text: t('admin.saveFailed') })
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanges = instructions !== originalInstructions

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">
            {t('admin.systemInstructions')}
          </h1>
          <p className="text-secondary-500">
            {t('admin.systemInstructionsSubtitle')}
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {t('common.save')}
        </Button>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={t('admin.instructionsPlaceholder')}
            className="w-full h-[500px] p-4 font-mono text-sm text-secondary-700 bg-secondary-50 border-0 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mt-4">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={isSaving}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          {t('admin.resetToDefault')}
        </Button>
        <span className="text-sm text-secondary-400">
          {t('admin.characterCount').replace('{count}', instructions.length.toLocaleString())}
        </span>
      </div>

      <div className="flex items-start gap-2 mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          These instructions define how the AI assistant responds to user questions about your products.
          Changes will take effect for new conversations.
        </p>
      </div>
    </div>
  )
}
