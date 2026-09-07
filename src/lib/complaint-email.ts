import nodemailer from 'nodemailer'

type EmailDeliveryStatus = 'SENT' | 'NOT_CONFIGURED' | 'FAILED'

type ComplaintReferenceEmail = {
  recipient: string
  reference: string
  commune: string
}

function smtpConfiguration() {
  const host = process.env.SMTP_HOST?.trim()
  const from = process.env.SMTP_FROM?.trim()
  if (!host || !from) return null

  const portValue = Number(process.env.SMTP_PORT || 587)
  const port = Number.isInteger(portValue) && portValue > 0 ? portValue : 587
  const user = process.env.SMTP_USER?.trim()
  const password = process.env.SMTP_PASSWORD

  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    from,
    auth: user && password ? { user, pass: password } : undefined,
  }
}

export async function sendComplaintReferenceEmail({ recipient, reference, commune }: ComplaintReferenceEmail): Promise<EmailDeliveryStatus> {
  const configuration = smtpConfiguration()
  if (!configuration) {
    console.warn('Complaint reference email skipped: SMTP_HOST and SMTP_FROM are not configured.')
    return 'NOT_CONFIGURED'
  }

  try {
    const transporter = nodemailer.createTransport({
      host: configuration.host,
      port: configuration.port,
      secure: configuration.secure,
      auth: configuration.auth,
    })
    await transporter.sendMail({
      from: configuration.from,
      to: recipient,
      subject: `تم استلام بلاغكم — المرجع ${reference}`,
      text: `تم استلام بلاغكم لدى ${commune}. مرجع التتبع الخاص بكم هو: ${reference}. احتفظوا بهذا المرجع لتتبع حالة البلاغ عبر المنصة.`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;color:#1e293b"><h2>تم استلام بلاغكم</h2><p>توصلنا ببلاغكم لدى <strong>${commune}</strong>.</p><p>مرجع التتبع الخاص بكم:</p><p style="font-family:monospace;font-size:18px;font-weight:700;color:#047857">${reference}</p><p>يرجى الاحتفاظ به لتتبع حالة البلاغ عبر المنصة.</p></div>`,
    })
    return 'SENT'
  } catch (error) {
    console.error('Complaint reference email error:', error)
    return 'FAILED'
  }
}
