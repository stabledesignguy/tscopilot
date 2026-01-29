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

async function check() {
  console.log(`\n=== Checking membership for: ${emailToCheck} ===\n`)

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', emailToCheck)
    .single()

  if (!profile) {
    console.log('No profile found for this email')
    return
  }

  console.log('Profile found:')
  console.log('  ID:', profile.id)
  console.log('  Email:', profile.email)
  console.log('  Name:', profile.full_name || profile.name || '(not set)')

  // Check invitation status
  const { data: invitations } = await supabase
    .from('organization_invitations')
    .select('*, organization:organizations(name)')
    .eq('email', emailToCheck)

  console.log('\nInvitations:')
  if (invitations && invitations.length > 0) {
    invitations.forEach((inv: any) => {
      console.log(`  - Org: ${inv.organization?.name}`)
      console.log(`    Accepted: ${inv.accepted_at ? 'Yes (' + inv.accepted_at + ')' : 'No'}`)
    })
  } else {
    console.log('  None found')
  }

  // Check organization memberships
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('*, organization:organizations(name, slug)')
    .eq('user_id', profile.id)

  console.log('\nOrganization Memberships:')
  if (memberships && memberships.length > 0) {
    memberships.forEach((mem: any) => {
      console.log(`  - Org: ${mem.organization?.name} (${mem.organization?.slug})`)
      console.log(`    Role: ${mem.role}`)
      console.log(`    Active: ${mem.is_active}`)
    })
  } else {
    console.log('  None found - user is not a member of any organization!')
  }

  // List all organizations for reference
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, slug')

  console.log('\nAll Organizations in system:')
  if (orgs && orgs.length > 0) {
    orgs.forEach((org: any) => {
      console.log(`  - ${org.name} (${org.slug}) - ID: ${org.id}`)
    })
  } else {
    console.log('  None')
  }
}

check().catch(console.error)
