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
  console.log(`\n=== Debugging invitation for: ${emailToCheck} ===\n`)

  // Check invitation
  const { data: invitation, error: invError } = await supabase
    .from('organization_invitations')
    .select('*')
    .eq('email', emailToCheck)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (invError) {
    console.log('Invitation lookup error:', invError.message)
  } else {
    console.log('Invitation found:')
    console.log('  Email in invitation:', JSON.stringify(invitation.email))
    console.log('  Role:', invitation.role)
    console.log('  Expires:', invitation.expires_at)
  }

  // Check profile
  const { data: profile, error: profError } = await supabase
    .from('profiles')
    .select('id, email')
    .ilike('email', emailToCheck)
    .single()

  if (profError) {
    console.log('\nProfile lookup error:', profError.message)

    // Try to find by partial match
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .ilike('email', `%${emailToCheck.split('@')[0]}%`)

    if (profiles && profiles.length > 0) {
      console.log('\nSimilar profiles found:')
      profiles.forEach(p => {
        console.log(`  - ${JSON.stringify(p.email)} (id: ${p.id})`)
      })
    }
  } else {
    console.log('\nProfile found:')
    console.log('  Email in profile:', JSON.stringify(profile.email))
    console.log('  User ID:', profile.id)
  }

  // Check auth users
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

  if (!authError && authUsers) {
    const matchingUser = authUsers.users.find(u =>
      u.email?.toLowerCase() === emailToCheck.toLowerCase()
    )
    if (matchingUser) {
      console.log('\nAuth user found:')
      console.log('  Email in auth:', JSON.stringify(matchingUser.email))
      console.log('  User ID:', matchingUser.id)
    } else {
      console.log('\nNo auth user found with this email')

      // Show all auth users for debugging
      console.log('\nAll auth users:')
      authUsers.users.forEach(u => {
        console.log(`  - ${JSON.stringify(u.email)} (id: ${u.id})`)
      })
    }
  }

  // Compare
  if (invitation && profile) {
    console.log('\n=== Comparison ===')
    console.log('Invitation email:', JSON.stringify(invitation.email))
    console.log('Profile email:   ', JSON.stringify(profile.email))
    console.log('Match (lowercase):', invitation.email.toLowerCase() === profile.email.toLowerCase())
  }
}

debug().catch(console.error)
