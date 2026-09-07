import path from 'path'

export const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const secureImageDirectory = path.resolve(process.cwd(), 'storage', 'product-images')

function resolveWithin(directory: string, fileName: string): string | null {
  const resolvedPath = path.resolve(directory, fileName)
  return resolvedPath.startsWith(`${directory}${path.sep}`) ? resolvedPath : null
}

export function sanitizeProductImageName(fileName: string): string {
  return path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150)
}

export function isAllowedProductImage(fileName: string, mimeType?: string): boolean {
  const extension = path.extname(fileName).toLowerCase()
  return allowedExtensions.has(extension) && (!mimeType || allowedMimeTypes.has(mimeType))
}

export function getProductImageDirectory(): string {
  return secureImageDirectory
}

export function getProductImagePath(storedFileName: string): string | null {
  if (path.basename(storedFileName) !== storedFileName || !isAllowedProductImage(storedFileName)) return null
  return resolveWithin(secureImageDirectory, storedFileName)
}
