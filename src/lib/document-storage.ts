import path from 'path'

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024

const allowedExtensions = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt', '.csv',
])

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/plain', 'text/csv',
])

const secureDocumentDirectory = path.resolve(process.cwd(), 'storage', 'documents')
const legacyDocumentDirectory = path.resolve(process.cwd(), 'public', 'uploads', 'documents')

function resolveWithin(directory: string, fileName: string): string | null {
  const resolvedPath = path.resolve(directory, fileName)
  return resolvedPath.startsWith(`${directory}${path.sep}`) ? resolvedPath : null
}

export function sanitizeDocumentFileName(fileName: string): string {
  return path.basename(fileName).replace(/[^\p{L}\p{N}._-]/gu, '_').slice(0, 150)
}

export function isAllowedDocument(fileName: string, mimeType?: string): boolean {
  const extension = path.extname(fileName).toLowerCase()
  return allowedExtensions.has(extension) && (!mimeType || allowedMimeTypes.has(mimeType))
}

export function getSecureDocumentDirectory(): string {
  return secureDocumentDirectory
}

export function getSecureDocumentPath(storedFileName: string): string | null {
  if (path.basename(storedFileName) !== storedFileName || !isAllowedDocument(storedFileName)) return null
  return resolveWithin(secureDocumentDirectory, storedFileName)
}

export function getDocumentFilePath(storedPath: string): string | null {
  if (path.basename(storedPath) === storedPath) {
    return getSecureDocumentPath(storedPath)
  }

  const normalizedPath = storedPath.replace(/\\/g, '/')
  const legacyPrefix = 'uploads/documents/'
  if (!normalizedPath.startsWith(legacyPrefix)) return null

  const legacyFileName = normalizedPath.slice(legacyPrefix.length)
  if (path.basename(legacyFileName) !== legacyFileName || !isAllowedDocument(legacyFileName)) return null
  return resolveWithin(legacyDocumentDirectory, legacyFileName)
}
