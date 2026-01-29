import { Resend } from 'resend'
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

const resend = new Resend(env.RESEND_API_KEY)

async function testEmail() {
  console.log('Sending test email to leilabirdie@icloud.com...')
  console.log('From:', env.RESEND_FROM_EMAIL || 'noreply@example.com')

  const { data, error } = await resend.emails.send({
    from: `TScopilot <${env.RESEND_FROM_EMAIL || 'noreply@example.com'}>`,
    to: 'leilabirdie@icloud.com',
    subject: 'Test Email from TScopilot',
    text: 'This is a test email to verify Resend is working.',
    html: '<p>This is a <strong>test email</strong> to verify Resend is working.</p>',
  })

  if (error) {
    console.error('Email FAILED:', error)
  } else {
    console.log('Email sent successfully!')
    console.log('Email ID:', data?.id)
  }
}

testEmail().catch(console.error)
