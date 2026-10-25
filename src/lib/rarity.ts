// Rareza de los logros para el lenguaje visual del rediseño: cinco niveles, cada uno con su color (--rar-*).
// Según el % global de jugadores que lo tienen. Puro, con tests en rarity.test.ts.

export type RarityTier = 'comun' | 'poco' | 'rara' | 'epica' | 'leg'

export const RARITY_TIERS: readonly RarityTier[] = ['comun', 'poco', 'rara', 'epica', 'leg']

export const RARITY_TIER_LABELS: Record<RarityTier, string> = {
    comun: 'Común',
    poco: 'Poco común',
    rara: 'Rara',
    epica: 'Épica',
    leg: 'Legendaria',
}

/** Legendaria < 1 %, épica < 5 %, rara < 15 %, poco común < 40 %, común ≥ 40 %. null si Steam no da el dato. */
export function rarityTier(percent: number | null | undefined): RarityTier | null {
    if (percent === null || percent === undefined || Number.isNaN(percent)) return null
    if (percent < 1) return 'leg'
    if (percent < 5) return 'epica'
    if (percent < 15) return 'rara'
    if (percent < 40) return 'poco'
    return 'comun'
}

/** Variable CSS del color de la rareza (definida en globals.css para los dos temas). */
export function rarityColor(tier: RarityTier): string {
    return `var(--rar-${tier})`
}
