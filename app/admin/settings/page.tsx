'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Settings, Loader2, Check, Bot } from 'lucide-react'
import type { OrganizationSettings, LLMProvider } from '@/types'

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Partial<OrganizationSettings>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [configuredProviders, setConfiguredProviders] = useState<LLMProvider[]>([])

  // Get current org from localStorage
  const getCurrentOrgId = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tscopilot_current_org_id')
    }
    return null
  }

  useEffect(() => {
    const fetchData = async () => {
      const orgId = getCurrentOrgId()
      if (!orgId) {
        setIsLoading(false)
        return
      }

      try {
        // Fetch org settings
        const settingsRes = await fetch(`/api/org/${orgId}/settings`)
        if (settingsRes.ok) {
          const data = await settingsRes.json()
          setSettings(data.settings || {})
        }

        // Check which LLM providers are configured
        const providers: LLMProvider[] = []
        // We'll assume all providers are available and let the backend handle validation
        providers.push('claude', 'openai', 'gemini')
        setConfiguredProviders(providers)
      } catch (error) {
        console.error('Failed to fetch settings:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const orgId = getCurrentOrgId()
    if (!orgId) return

    setIsSaving(true)
    setSaveSuccess(false)

    try {
      const response = await fetch(`/api/org/${orgId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-secondary-900">Organization Settings</h1>
        <p className="text-secondary-500">Configure your organization preferences</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* LLM Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-secondary-900">AI Configuration</h2>
            </div>
            <p className="text-sm text-secondary-500 mt-1">
              Choose which AI provider your organization uses for chat
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                LLM Provider
              </label>
              <select
                value={settings.llm_provider || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    llm_provider: (e.target.value || null) as LLMProvider | null,
                  })
                }
                className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Use Platform Default</option>
                {configuredProviders.includes('claude') && (
                  <option value="claude">Claude (Anthropic)</option>
                )}
                {configuredProviders.includes('openai') && (
                  <option value="openai">GPT-4 (OpenAI)</option>
                )}
                {configuredProviders.includes('gemini') && (
                  <option value="gemini">Gemini (Google)</option>
                )}
              </select>
              <p className="text-xs text-secondary-500 mt-1">
                Leave empty to use the platform&apos;s default provider
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Model Name (Optional)
              </label>
              <Input
                type="text"
                value={settings.llm_model || ''}
                onChange={(e) =>
                  setSettings({ ...settings, llm_model: e.target.value || null })
                }
                placeholder="e.g., claude-3-opus-20240229"
              />
              <p className="text-xs text-secondary-500 mt-1">
                Specify a particular model version, or leave empty for default
              </p>
            </div>
          </CardContent>
        </Card>

        {/* System Instructions */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-secondary-900">System Instructions</h2>
            </div>
            <p className="text-sm text-secondary-500 mt-1">
              Custom instructions for the AI assistant in your organization
            </p>
          </CardHeader>
          <CardContent>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Custom System Prompt
              </label>
              <textarea
                value={settings.system_instructions || ''}
                onChange={(e) =>
                  setSettings({ ...settings, system_instructions: e.target.value || null })
                }
                rows={6}
                className="w-full px-3 py-2 border border-secondary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter custom instructions for the AI assistant..."
              />
              <p className="text-xs text-secondary-500 mt-1">
                These instructions will override the default system prompt for your organization
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          {saveSuccess && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <Check className="w-4 h-4" />
              Settings saved
            </span>
          )}
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Settings className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
