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

const emailToAccept = 'leilabirdie@icloud.com'

async function acceptInvitation() {
  console.log(`\n=== Accepting invitation for: ${emailToAccept} ===\n`)

  // Get the profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', emailToAccept)
    .single()

  if (profileError || !profile) {
    console.error('Profile not found:', profileError?.message)
    return
  }

  console.log('Profile ID:', profile.id)

  // Get the pending invitation
  const { data: invitation, error: invError } = await supabase
    .from('organization_invitations')
    .select('*')
    .eq('email', emailToAccept)
    .is('accepted_at', null)
    .single()

  if (invError || !invitation) {
    console.error('No pending invitation found:', invError?.message)
    return
  }

  console.log('Invitation found for org:', invitation.organization_id)
  console.log('Role:', invitation.role)

  // Create organization membership
  const { data: membership, error: memError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: invitation.organization_id,
      user_id: profile.id,
      role: invitation.role,
      invited_by: invitation.invited_by,
      is_active: true,
    })
    .select()
    .single()

  if (memError) {
    console.error('Failed to create membership:', memError.message)
    return
  }

  console.log('Membership created:', membership.id)

  // Mark invitation as accepted
  const { error: updateError } = await supabase
    .from('organization_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  if (updateError) {
    console.error('Failed to mark invitation as accepted:', updateError.message)
    return
  }

  console.log('\n✓ Invitation accepted successfully!')
  console.log('User is now a member of the organization.')
}

acceptInvitation().catch(console.error)
