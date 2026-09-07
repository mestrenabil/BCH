export function normalizeCommuneName(value: string | null | undefined): string {
  if (!value) return ''

  return value
    .trim()
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/^(?:جماعة|المجموعة الترابية|البلدية|commune(?:\s+de)?|municipalité(?:\s+de)?)\s*/i, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ة/g, 'ه')
    .replace(/[\s\-_'’.,()/]/g, '')
    .toLowerCase()
}

export function communeNamesMatch(first: string | null | undefined, second: string | null | undefined): boolean {
  const normalizedFirst = normalizeCommuneName(first)
  const normalizedSecond = normalizeCommuneName(second)
  return Boolean(normalizedFirst && normalizedSecond && normalizedFirst === normalizedSecond)
}

export function findMatchingCommune(allowedCommunes: string[], candidates: Array<string | null | undefined>): string | null {
  return allowedCommunes.find((allowedCommune) => (
    candidates.some((candidate) => communeNamesMatch(allowedCommune, candidate))
  )) || null
}
