export type PublicLanguage = 'ar' | 'fr' | 'en' | 'es'

const COMMUNE_TRANSLATIONS: Record<string, { fr: string; en: string; es: string }> = {
  'سلا': { fr: 'Salé', en: 'Salé', es: 'Salé' },
  'سيدي أبي القنادل': { fr: 'Sidi Bouknadel', en: 'Sidi Bouknadel', es: 'Sidi Bouknadel' },
  'عامر': { fr: 'Amer', en: 'Amer', es: 'Amer' },
  'السهول': { fr: 'Shoul', en: 'Shoul', es: 'Shoul' },
}

export function displayCommuneName(commune: string, language: PublicLanguage): string {
  if (language === 'ar') return commune
  return COMMUNE_TRANSLATIONS[commune]?.[language] || commune
}

export function displayLinkedCommune(commune: string, language: PublicLanguage, label: string): string {
  const name = displayCommuneName(commune, language)
  if (language === 'fr') return `Rattaché à la commune de ${name}`
  if (language === 'en') return `Linked to the commune of ${name}`
  if (language === 'es') return `Vinculado a la comuna de ${name}`
  return `${label} ${name}`
}
