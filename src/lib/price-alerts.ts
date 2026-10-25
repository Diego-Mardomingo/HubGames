// Avisos push de precio de la wishlist (#37): criterio por juego y decisión de avisar o no.
// Sin dependencias del cliente de Supabase, para probarlo con node:test y usarlo en el script diario.
import { formatPrice, isAtHistoricalLow } from './wishlist'

export const ALERT_MODES = ['minimo', 'precio', 'descuento', 'off'] as const
export type AlertMode = (typeof ALERT_MODES)[number]

export const ALERT_MODE_LABELS: Record<AlertMode, string> = {
    minimo: 'Mínimo histórico',
    precio: 'Precio objetivo',
    descuento: 'Descuento mínimo',
    off: 'Sin avisos',
}

/** Fila de hubgames_price_alerts. Sin fila, el criterio es 'minimo'. */
export interface PriceAlert {
    mode: AlertMode
    target_price: number | null
    target_discount: number | null
    last_notified_price: number | null
}

export interface AlertGame {
    appid: number
    name: string | null
    price_initial: number | null
    price_final: number | null
    discount_percent: number | null
    steam_low: number | null
}

export const DEFAULT_ALERT: PriceAlert = { mode: 'minimo', target_price: null, target_discount: null, last_notified_price: null }

/** ¿El precio de hoy cumple el criterio? Solo con precio en Steam; 'off' nunca. */
export function meetsAlert(game: AlertGame, alert: PriceAlert): boolean {
    if (game.price_final === null) return false
    switch (alert.mode) {
        case 'minimo':
            return isAtHistoricalLow({ ...game, all_low: null })
        case 'precio':
            return alert.target_price !== null && game.price_final <= alert.target_price
        case 'descuento':
            return alert.target_discount !== null && (game.discount_percent ?? 0) >= alert.target_discount
        case 'off':
            return false
    }
}

export type AlertDecision =
    /** Avisar y apuntar este precio como avisado. */
    | { action: 'notify'; price: number }
    /** Dejó de cumplirse: borrar lo avisado para que la próxima oferta vuelva a avisar. */
    | { action: 'reset' }
    | { action: 'none' }

/**
 * Sin repetir: mientras se cumpla el criterio, solo se vuelve a avisar si el precio baja de lo ya avisado. Cuando deja
 * de cumplirse (acaba la oferta o cambias el criterio) se olvida lo avisado.
 */
export function decideAlert(game: AlertGame, alert: PriceAlert | null): AlertDecision {
    const a = alert ?? DEFAULT_ALERT
    if (!meetsAlert(game, a)) return a.last_notified_price !== null ? { action: 'reset' } : { action: 'none' }
    const price = game.price_final!
    if (a.last_notified_price !== null && price >= a.last_notified_price) return { action: 'none' }
    return { action: 'notify', price }
}

export interface PushPayload {
    title: string
    body: string
    url: string
    tag: string
}

/** Notificación de un juego. Al pulsarla se abre su ficha. */
export function alertPayload(game: AlertGame, alert: PriceAlert | null): PushPayload {
    const a = alert ?? DEFAULT_ALERT
    const name = game.name ?? `App ${game.appid}`
    const price = formatPrice(game.price_final) ?? ''
    const discount = (game.discount_percent ?? 0) > 0 ? ` (-${game.discount_percent}%)` : ''
    const reason =
        a.mode === 'precio' && a.target_price !== null
            ? `Ha bajado de tu precio objetivo (${formatPrice(a.target_price)}).`
            : a.mode === 'descuento' && a.target_discount !== null
              ? `Tiene un ${game.discount_percent}% de descuento (pedías ${a.target_discount}% o más).`
              : '¡Está en su mínimo histórico en Steam!'
    return { title: `${name} a ${price}${discount}`, body: reason, url: `/juego/${game.appid}`, tag: `precio-${game.appid}` }
}

/** Con más de MAX_ALERTS_PER_DAY avisos el mismo día, uno solo que lleva a la wishlist. */
export const MAX_ALERTS_PER_DAY = 3

export function summaryPayload(count: number): PushPayload {
    return {
        title: `${count} juegos de tu wishlist han bajado de precio`,
        body: 'Mira cuáles en tu wishlist.',
        url: '/wishlist',
        tag: 'precio-resumen',
    }
}

/** Texto corto del criterio para la lista ("Aviso: ≤ 9,99 €"). */
export function alertLabel(alert: PriceAlert | null): string {
    const a = alert ?? DEFAULT_ALERT
    if (a.mode === 'precio' && a.target_price !== null) return `Aviso si baja de ${formatPrice(a.target_price)}`
    if (a.mode === 'descuento' && a.target_discount !== null) return `Aviso con -${a.target_discount}% o más`
    if (a.mode === 'off') return 'Sin avisos'
    return 'Aviso en mínimo histórico'
}

/** "12,99" o "12.99" → 1299 céntimos. null si no es un precio válido. */
export function parseEuros(input: string): number | null {
    const clean = input.trim().replace('€', '').trim().replace(',', '.')
    if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
    return Math.round(Number(clean) * 100)
}
