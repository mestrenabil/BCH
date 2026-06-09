// Simple notification sound utility using Web Audio API
let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioContext
}

export function playNotificationSound(type: 'success' | 'error' | 'warning' | 'info' = 'success') {
  try {
    const ctx = getAudioContext()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    // Different frequencies for different types
    const frequencies: Record<string, number> = {
      success: 800,
      error: 300,
      warning: 500,
      info: 600,
    }

    oscillator.frequency.setValueAtTime(frequencies[type] || 600, ctx.currentTime)
    oscillator.type = 'sine'
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.3)
  } catch {
    // Audio context not available, fail silently
  }
}

export function playSuccessSound() { playNotificationSound('success') }
export function playErrorSound() { playNotificationSound('error') }
export function playWarningSound() { playNotificationSound('warning') }
export function playInfoSound() { playNotificationSound('info') }
