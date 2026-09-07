import path from 'path'

export const MAX_CSVR_PHOTO_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB

const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const securePhotoDirectory = path.resolve(process.cwd(), 'storage', 'csvr-photos')

function resolveWithin(directory: string, fileName: string): string | null {
  const resolvedPath = path.resolve(directory, fileName)
  return resolvedPath.startsWith(`${directory}${path.sep}`) ? resolvedPath : null
}

export function sanitizeCsvrPhotoName(fileName: string): string {
  return path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150)
}

export function isAllowedCsvrPhoto(fileName: string, mimeType?: string): boolean {
  const extension = path.extname(fileName).toLowerCase()
  return allowedExtensions.has(extension) && (!mimeType || allowedMimeTypes.has(mimeType))
}

export function getCsvrPhotoDirectory(): string {
  return securePhotoDirectory
}

export function getCsvrPhotoPath(storedFileName: string): string | null {
  if (path.basename(storedFileName) !== storedFileName || !isAllowedCsvrPhoto(storedFileName)) return null
  return resolveWithin(securePhotoDirectory, storedFileName)
}
