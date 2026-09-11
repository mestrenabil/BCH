import crypto from 'crypto'

type GoogleServiceAccount = {
  client_email: string
  private_key: string
  token_uri?: string
}

const base64Url = (value: string | Buffer) => Buffer.from(value).toString('base64url')

async function getGoogleAccessToken(credentials: GoogleServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const tokenUri = credentials.token_uri || 'https://oauth2.googleapis.com/token'
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64Url(JSON.stringify({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }))
  const unsignedToken = `${header}.${claims}`
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsignedToken), credentials.private_key)
  const assertion = `${unsignedToken}.${base64Url(signature)}`

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const result = await response.json() as { access_token?: string; error_description?: string }
  if (!response.ok || !result.access_token) throw new Error(result.error_description || 'تعذر الاتصال بخدمة Google Drive')
  return result.access_token
}

export function getRemoteBackupStatus() {
  return {
    googleDrive: Boolean(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_DRIVE_FOLDER_ID),
    webdav: Boolean(process.env.BACKUP_WEBDAV_URL && process.env.BACKUP_WEBDAV_USERNAME && process.env.BACKUP_WEBDAV_PASSWORD),
  }
}

export async function uploadBackupToGoogleDrive(filename: string, content: string) {
  const rawCredentials = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!rawCredentials || !folderId) throw new Error('ربط Google Drive غير مهيأ في الخادم')

  let credentials: GoogleServiceAccount
  try {
    credentials = JSON.parse(rawCredentials) as GoogleServiceAccount
  } catch {
    throw new Error('بيانات حساب خدمة Google Drive غير صالحة')
  }
  if (!credentials.client_email || !credentials.private_key) throw new Error('بيانات حساب خدمة Google Drive ناقصة')

  const accessToken = await getGoogleAccessToken(credentials)
  const boundary = `bch-backup-${crypto.randomUUID()}`
  const metadata = JSON.stringify({ name: filename, parents: [folderId] })
  const body = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n`,
    `--${boundary}--`,
  ].join('')

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })
  const result = await response.json() as { id?: string; name?: string; webViewLink?: string; error?: { message?: string } }
  if (!response.ok || !result.id) throw new Error(result.error?.message || 'فشل رفع النسخة إلى Google Drive')
  return { id: result.id, name: result.name || filename, url: result.webViewLink || null }
}

export async function uploadBackupToWebDav(filename: string, content: string) {
  const baseUrl = process.env.BACKUP_WEBDAV_URL
  const username = process.env.BACKUP_WEBDAV_USERNAME
  const password = process.env.BACKUP_WEBDAV_PASSWORD
  if (!baseUrl || !username || !password) throw new Error('ربط الخادم الخارجي WebDAV غير مهيأ')

  const configuredUrl = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
  if (configuredUrl.protocol !== 'https:' && configuredUrl.hostname !== 'localhost' && configuredUrl.hostname !== '127.0.0.1') {
    throw new Error('يجب أن يستخدم خادم WebDAV اتصال HTTPS')
  }
  const destination = new URL(encodeURIComponent(filename), configuredUrl)
  const response = await fetch(destination, {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: content,
  })
  if (!response.ok) throw new Error(`فشل رفع النسخة إلى الخادم الخارجي (${response.status})`)
  return { name: filename, url: destination.toString() }
}
