import { Resend } from 'resend'

// Initialize Resend with API key
const apiKey = process.env.RESEND_API_KEY
const resend = apiKey ? new Resend(apiKey) : null

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@example.com'
const FROM_NAME = process.env.RESEND_FROM_NAME || 'TScopilot'

interface SendEmailParams {
  to: string
  subject: string
  text: string
  html: string
}

export async function sendEmail({ to, subject, text, html }: SendEmailParams): Promise<boolean> {
  if (!resend) {
    console.warn('Resend API key not configured - email not sent')
    return false
  }

  try {
    const { error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      text,
      html,
    })

    if (error) {
      console.error('Resend error:', error)
      return false
    }

    console.log(`Email sent to ${to}: ${subject}`)
    return true
  } catch (error) {
    console.error('Resend error:', error)
    return false
  }
}

interface InvitationEmailParams {
  to: string
  organizationName: string
  inviterEmail?: string
  role: string
  invitationUrl: string
  expiresAt: Date
}

export async function sendInvitationEmail({
  to,
  organizationName,
  inviterEmail,
  role,
  invitationUrl,
  expiresAt,
}: InvitationEmailParams): Promise<boolean> {
  const subject = `You've been invited to join ${organizationName}`

  const text = `
You've been invited to join ${organizationName} as a ${role}.

${inviterEmail ? `Invited by: ${inviterEmail}` : ''}

Click the link below to accept the invitation:
${invitationUrl}

This invitation expires on ${expiresAt.toLocaleDateString()}.

If you didn't expect this invitation, you can safely ignore this email.
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      You've been invited to join <strong>${organizationName}</strong> as a <strong>${role}</strong>.
    </p>

    ${inviterEmail ? `<p style="color: #6b7280; font-size: 14px;">Invited by: ${inviterEmail}</p>` : ''}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${invitationUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Accept Invitation
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
      This invitation expires on <strong>${expiresAt.toLocaleDateString()}</strong>.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      If you didn't expect this invitation, you can safely ignore this email.
    </p>

    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 10px;">
      If the button doesn't work, copy and paste this link:<br>
      <a href="${invitationUrl}" style="color: #667eea; word-break: break-all;">${invitationUrl}</a>
    </p>
  </div>
</body>
</html>
`.trim()

  return sendEmail({ to, subject, text, html })
}

interface AddedToOrgEmailParams {
  to: string
  organizationName: string
  inviterEmail?: string
  role: string
  appUrl: string
}

export async function sendAddedToOrgEmail({
  to,
  organizationName,
  inviterEmail,
  role,
  appUrl,
}: AddedToOrgEmailParams): Promise<boolean> {
  const subject = `You've been added to ${organizationName}`

  const text = `
You've been added to ${organizationName} as a ${role}.

${inviterEmail ? `Added by: ${inviterEmail}` : ''}

You can access the organization by logging in:
${appUrl}

If you didn't expect this, please contact your administrator.
`.trim()

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Welcome!</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      You've been added to <strong>${organizationName}</strong> as a <strong>${role}</strong>.
    </p>

    ${inviterEmail ? `<p style="color: #6b7280; font-size: 14px;">Added by: ${inviterEmail}</p>` : ''}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${appUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Go to App
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      If you didn't expect this, please contact your administrator.
    </p>
  </div>
</body>
</html>
`.trim()

  return sendEmail({ to, subject, text, html })
}
