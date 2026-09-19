import nodemailer from 'nodemailer'

type EmailDeliveryStatus = 'SENT' | 'NOT_CONFIGURED' | 'FAILED'

type ComplaintReferenceEmail = {
  recipient: string
  reference: string
  commune: string
}

function formatArabicCommune(commune: string): string {
  const withoutPrefix = commune.trim().replace(/^جماعة\s+/u, '').trim()
  const withoutWrappingQuotes = withoutPrefix
    .replace(/^[\s'"«»‘’“”]+/u, '')
    .replace(/[\s'"«»‘’“”]+$/u, '')
    .trim()

  return `جماعة ${withoutWrappingQuotes || withoutPrefix}`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
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
    const communeLabel = formatArabicCommune(commune)
    const safeCommuneLabel = escapeHtml(communeLabel)
    const safeReference = escapeHtml(reference)
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
      text: `تم استلام بلاغكم لدى ${communeLabel}. مرجع التتبع الخاص بكم هو: ${reference}. احتفظوا بهذا المرجع لتتبع حالة البلاغ عبر المنصة.`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#1e293b;max-width:620px;margin:auto"><div style="border:1px solid #d1fae5;border-radius:16px;overflow:hidden"><div style="background:#047857;color:#fff;padding:18px 24px"><h2 style="margin:0;font-size:20px">تم استلام بلاغكم بنجاح</h2></div><div style="padding:24px"><p>توصلنا ببلاغكم لدى <strong>${safeCommuneLabel}</strong>.</p><p style="margin-bottom:8px">مرجع التتبع الخاص بكم:</p><p style="direction:ltr;text-align:center;font-family:monospace;font-size:18px;font-weight:700;color:#047857;background:#ecfdf5;border-radius:10px;padding:14px">${safeReference}</p><p>يرجى الاحتفاظ بهذا المرجع لتتبع حالة البلاغ عبر المنصة.</p><p style="font-size:12px;color:#64748b">لا تشاركوا مرجع التتبع مع أشخاص غير معنيين.</p></div></div></div>`,
    })
    return 'SENT'
  } catch (error) {
    console.error('Complaint reference email error:', error)
    return 'FAILED'
  }
}


const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: 'قيد الاستلام',
  EN_COURS: 'قيد المعالجة',
  TRAITEE: 'تمت المعالجة',
  REJETEE: 'تم إغلاق البلاغ دون متابعة',
}

export async function sendComplaintStatusEmail(input: ComplaintReferenceEmail & { status: string; workOrderReference?: string | null; notes?: string | null }): Promise<EmailDeliveryStatus> {
  const configuration = smtpConfiguration()
  if (!configuration) return 'NOT_CONFIGURED'
  try {
    const communeLabel = formatArabicCommune(input.commune)
    const statusLabel = COMPLAINT_STATUS_LABELS[input.status] || input.status
    const transporter = nodemailer.createTransport({ host: configuration.host, port: configuration.port, secure: configuration.secure, auth: configuration.auth })
    await transporter.sendMail({
      from: configuration.from,
      to: input.recipient,
      subject: `تحديث حالة بلاغكم ${input.reference} — ${statusLabel}`,
      text: `تم تحديث حالة بلاغكم لدى ${communeLabel} إلى: ${statusLabel}. احتفظوا بمرجع التتبع ${input.reference}.`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#1e293b"><h2>تحديث حالة البلاغ</h2><p>الجماعة: <strong>${escapeHtml(communeLabel)}</strong></p><p>الحالة الحالية: <strong>${escapeHtml(statusLabel)}</strong></p>${input.workOrderReference ? `<p>مرجع أمر العمل: <strong>${escapeHtml(input.workOrderReference)}</strong></p>` : ''}${input.notes ? `<p>ملاحظة الإدارة: ${escapeHtml(input.notes)}</p>` : ''}<p>مرجع التتبع: <strong>${escapeHtml(input.reference)}</strong></p></div>`,
    })
    return 'SENT'
  } catch (error) {
    console.error('Complaint status email error:', error)
    return 'FAILED'
  }
}
