export function parseNavVisibilityJson(value: string | null | undefined): Record<string, boolean> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter(([, entryValue]) => typeof entryValue === 'boolean') as Array<[string, boolean]>
    )
  } catch {
    return {}
  }
}

export function normalizeNavVisibilityJson(value: unknown, allowedKeys: readonly string[]): string {
  let parsedValue: unknown = value
  if (typeof value === 'string') {
    try {
      parsedValue = JSON.parse(value)
    } catch {
      return '{}'
    }
  }

  if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
    return '{}'
  }

  const allowedSet = new Set(allowedKeys)
  const sanitized = Object.fromEntries(
    Object.entries(parsedValue).filter(([key, entryValue]) => allowedSet.has(key) && typeof entryValue === 'boolean')
  )

  return JSON.stringify(sanitized)
}
