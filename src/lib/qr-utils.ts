// Simple QR code generation using Canvas API
// Generates a QR code for an intervention reference

export function generateQRDataURL(text: string, size: number = 200): string {
  // Simple QR-like pattern generator (visual placeholder)
  // For production, use a library like qrcode
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // White background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)

  // Generate a pseudo-random pattern from the text
  const cellSize = Math.floor(size / 25)
  const hash = simpleHash(text)

  // Position markers (3 corners)
  drawFinderPattern(ctx, 0, 0, cellSize * 7)
  drawFinderPattern(ctx, size - cellSize * 7, 0, cellSize * 7)
  drawFinderPattern(ctx, 0, size - cellSize * 7, cellSize * 7)

  // Data modules
  ctx.fillStyle = '#000000'
  for (let y = 0; y < 25; y++) {
    for (let x = 0; x < 25; x++) {
      // Skip finder pattern areas
      if ((x < 8 && y < 8) || (x >= 17 && y < 8) || (x < 8 && y >= 17)) continue

      const idx = y * 25 + x
      const bit = (hash + idx * 7 + text.charCodeAt(idx % text.length)) % 2
      if (bit === 0) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
      }
    }
  }

  return canvas.toDataURL('image/png')
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

function drawFinderPattern(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  // Outer black border
  ctx.fillStyle = '#000000'
  ctx.fillRect(x, y, size, size)
  // Inner white
  ctx.fillStyle = '#ffffff'
  const inset = size / 7
  ctx.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2)
  // Center black
  ctx.fillStyle = '#000000'
  ctx.fillRect(x + inset * 2, y + inset * 2, size - inset * 4, size - inset * 4)
}
