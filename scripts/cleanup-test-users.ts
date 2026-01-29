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

const emailsToDelete = [
  'marco.a.ventura@gmail.com',
  'marcoaventura@gmail.com',
  'leilabirdie@icloud.com'
]

async function cleanupTestUsers() {
  console.log('Starting cleanup for:', emailsToDelete)

  for (const email of emailsToDelete) {
    console.log(`\n--- Processing: ${email} ---`)

    // 1. Delete pending invitations
    const { data: invitations, error: invError } = await supabase
      .from('organization_invitations')
      .delete()
      .eq('email', email)
      .select()

    if (invError) {
      console.log(`  Invitations error: ${invError.message}`)
    } else {
      console.log(`  Deleted ${invitations?.length || 0} invitation(s)`)
    }

    // 2. Find profile by email
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (profile) {
      // 3. Delete organization memberships
      const { data: members, error: memError } = await supabase
        .from('organization_members')
        .delete()
        .eq('user_id', profile.id)
        .select()

      if (memError) {
        console.log(`  Members error: ${memError.message}`)
      } else {
        console.log(`  Deleted ${members?.length || 0} membership(s)`)
      }

      // 4. Delete profile
      const { error: profError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profile.id)

      if (profError) {
        console.log(`  Profile error: ${profError.message}`)
      } else {
        console.log(`  Deleted profile`)
      }

      // 5. Delete auth user
      const { error: authError } = await supabase.auth.admin.deleteUser(profile.id)

      if (authError) {
        console.log(`  Auth user error: ${authError.message}`)
      } else {
        console.log(`  Deleted auth user`)
      }
    } else {
      console.log(`  No profile found for this email`)
    }
  }

  console.log('\n✓ Cleanup complete!')
}

cleanupTestUsers().catch(console.error)
