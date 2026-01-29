import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Parse .env.local file manually
const envPath = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env: Record<string, string> = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
  }
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const emailToCheck = 'leilabirdie@icloud.com'

async function debug() {
  console.log(`\n=== Checking invitation for: ${emailToCheck} ===\n`)

  // Check if invitation exists
  const { data: invitations, error: invError } = await supabase
    .from('organization_invitations')
    .select('*, organization:organizations(name)')
    .eq('email', emailToCheck)
    .order('created_at', { ascending: false })

  if (invError) {
    console.log('Error fetching invitations:', invError.message)
  } else if (!invitations || invitations.length === 0) {
    console.log('No invitations found for this email')
  } else {
    console.log(`Found ${invitations.length} invitation(s):`)
    invitations.forEach((inv: any, i: number) => {
      console.log(`\n  Invitation ${i + 1}:`)
      console.log(`    Organization: ${inv.organization?.name}`)
      console.log(`    Role: ${inv.role}`)
      console.log(`    Created: ${inv.created_at}`)
      console.log(`    Expires: ${inv.expires_at}`)
      console.log(`    Accepted: ${inv.accepted_at || 'No'}`)
    })
  }

  // Check if user exists in auth
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const matchingUser = authUsers?.users?.find(u =>
    u.email?.toLowerCase() === emailToCheck.toLowerCase()
  )

  console.log('\n=== Auth User Status ===')
  if (matchingUser) {
    console.log('  Auth user exists:')
    console.log('    ID:', matchingUser.id)
    console.log('    Email:', matchingUser.email)
    console.log('    Created:', matchingUser.created_at)
    console.log('    Confirmed:', matchingUser.email_confirmed_at ? 'Yes' : 'No')
  } else {
    console.log('  No auth user found for this email')
  }

  // Test generating a magic link
  console.log('\n=== Testing Magic Link Generation ===')
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: emailToCheck,
    options: {
      redirectTo: 'https://tscopilot.vercel.app/auth/callback',
    }
  })

  if (linkError) {
    console.log('  Magic link generation FAILED:', linkError.message)
  } else {
    console.log('  Magic link generated successfully!')
    console.log('  Link:', linkData.properties?.action_link?.substring(0, 80) + '...')
  }

  // Check Resend config
  console.log('\n=== Resend Configuration ===')
  console.log('  RESEND_API_KEY:', env.RESEND_API_KEY ? 'Set (' + env.RESEND_API_KEY.substring(0, 8) + '...)' : 'NOT SET')
  console.log('  RESEND_FROM_EMAIL:', env.RESEND_FROM_EMAIL || 'NOT SET (will use default)')
}

debug().catch(console.error)
