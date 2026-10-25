// Precios de la wishlist (#35, #36): precio actual en la tienda de Steam (ES) e historial propio, y mínimos históricos de
// IsThereAnyDeal (Steam y todas las tiendas). Solo servidor: recibe el cliente con service_role.
// Condiciones de la API de IsThereAnyDeal: se cita la fuente con enlace, no se alteran los datos y se cachea (aquí, un día).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './supabase/database.types'

type Client = SupabaseClient<Database>
type PriceRow = Database['public']['Tables']['hubgames_game_prices']['Insert']

const STORE_API = 'https://store.steampowered.com/api'
const ITAD_API = 'https://api.isthereanydeal.com'
/** Id de la tienda de Steam en IsThereAnyDeal. */
const ITAD_STEAM_SHOP = 61
/** appdetails admite varios appids a la vez solo con filters=price_overview. */
const STORE_BATCH = 100
/** Máximo de ids por petición en historylow y storelow. */
const ITAD_BATCH = 200
/** Juegos que IsThereAnyDeal no conoce: se vuelve a buscar al mes. */
const ITAD_RECHECK_MS = 30 * 24 * 3600_000
/** Los mínimos se refrescan como mucho una vez cada 20 h (cron diario, aunque se pulse "Sincronizar ahora"). */
const LOWS_MAX_AGE_MS = 20 * 3600_000

export interface PriceSyncResult {
    pricesUpdated: number
    snapshots: number
    itadMatched: number
    lowsUpdated: number
    /** Motivo por el que no se consultó IsThereAnyDeal, si no se hizo. */
    itadSkipped: string | null
}

interface StorePrice {
    currency: string
    initial: number
    final: number
    discount_percent: number
}

interface ItadLow {
    shop: { id: number; name: string }
    price: { amountInt: number; currency: string }
    timestamp: string
}

function chunks<T>(items: T[], size: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
    return out
}

/** Día de Madrid con 6 h de retraso, como la foto de horas: el cron de madrugada cuenta como el día anterior. */
export function priceDay(now: number = Date.now()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(now - 6 * 3600_000))
}

/** Precio actual de varios juegos. Los que no están a la venta (gratis, sin lanzar o retirados) vuelven como null. */
async function fetchStorePrices(appids: number[]): Promise<Map<number, StorePrice | null>> {
    const out = new Map<number, StorePrice | null>()
    for (const part of chunks(appids, STORE_BATCH)) {
        const res = await fetch(`${STORE_API}/appdetails?appids=${part.join(',')}&filters=price_overview&cc=es`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`appdetails (precios): ${res.status}`)
        const body = (await res.json()) as Record<string, { success?: boolean; data?: { price_overview?: StorePrice } | [] }>
        for (const appid of part) {
            const entry = body[String(appid)]
            const price = entry?.success && !Array.isArray(entry.data) ? entry.data?.price_overview : undefined
            out.set(appid, price ? price : null)
        }
    }
    return out
}

async function itadPost<T>(path: string, body: unknown): Promise<T> {
    const key = process.env.ITAD_API_KEY
    const sep = path.includes('?') ? '&' : '?'
    const res = await fetch(`${ITAD_API}${path}${sep}key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
    })
    if (!res.ok) throw new Error(`IsThereAnyDeal ${path.split('?')[0]}: ${res.status}`)
    return (await res.json()) as T
}

/**
 * Actualiza precio, historial y mínimos de los juegos indicados. Lo usan la sincronización diaria y "Añadir a la wishlist".
 * IsThereAnyDeal va después de guardar el precio de Steam: si falla, el precio ya queda guardado.
 */
export async function refreshPrices(supabase: Client, appids: number[], now: number = Date.now()): Promise<PriceSyncResult> {
    const result: PriceSyncResult = { pricesUpdated: 0, snapshots: 0, itadMatched: 0, lowsUpdated: 0, itadSkipped: null }
    if (appids.length === 0) return result

    const known = new Map<number, Database['public']['Tables']['hubgames_game_prices']['Row']>()
    for (const part of chunks(appids, STORE_BATCH)) {
        const { data, error } = await supabase.from('hubgames_game_prices').select('*').in('appid', part)
        if (error) throw new Error(`No se pudieron leer los precios: ${error.message}`)
        for (const row of data) known.set(row.appid, row)
    }

    // Precio actual. Solo se escribe foto si cambia respecto al último conocido (varias el mismo día: queda la última).
    const prices = await fetchStorePrices(appids)
    const syncedAt = new Date(now).toISOString()
    const day = priceDay(now)
    const rows: PriceRow[] = []
    const snapshots: Database['public']['Tables']['hubgames_price_snapshots']['Insert'][] = []
    for (const appid of appids) {
        const price = prices.get(appid) ?? null
        const prev = known.get(appid)
        rows.push({
            appid,
            currency: price?.currency ?? null,
            price_initial: price?.initial ?? null,
            price_final: price?.final ?? null,
            discount_percent: price?.discount_percent ?? null,
            price_synced_at: syncedAt,
        })
        const changed =
            !prev ||
            prev.price_final !== price?.final ||
            prev.price_initial !== price?.initial ||
            prev.discount_percent !== price?.discount_percent
        if (price && changed) {
            snapshots.push({ appid, date: day, price_initial: price.initial, price_final: price.final, discount_percent: price.discount_percent })
        }
    }
    for (const part of chunks(rows, 500)) {
        const { error } = await supabase.from('hubgames_game_prices').upsert(part, { onConflict: 'appid' })
        if (error) throw new Error(`No se pudieron guardar los precios: ${error.message}`)
    }
    for (const part of chunks(snapshots, 500)) {
        const { error } = await supabase.from('hubgames_price_snapshots').upsert(part, { onConflict: 'appid,date' })
        if (error) throw new Error(`No se pudo guardar el historial de precios: ${error.message}`)
    }
    result.pricesUpdated = rows.length
    result.snapshots = snapshots.length

    if (!process.env.ITAD_API_KEY) {
        result.itadSkipped = 'Falta ITAD_API_KEY'
        return result
    }

    // Id de IsThereAnyDeal a partir del appid (una sola vez por juego; los que no conoce se reintentan al mes).
    const itadIds = new Map<number, string>()
    for (const [appid, row] of known) if (row.itad_id) itadIds.set(appid, row.itad_id)
    const toLookup = appids.filter((id) => {
        const row = known.get(id)
        return !row?.itad_id && (!row?.itad_checked_at || now - Date.parse(row.itad_checked_at) > ITAD_RECHECK_MS)
    })
    for (const part of chunks(toLookup, ITAD_BATCH)) {
        const found = await itadPost<Record<string, string | null>>(
            `/lookup/id/shop/${ITAD_STEAM_SHOP}/v1`,
            part.map((id) => `app/${id}`),
        )
        const update = part.map((appid) => {
            const id = found[`app/${appid}`] ?? null
            if (id) itadIds.set(appid, id)
            return { appid, itad_id: id, itad_checked_at: syncedAt }
        })
        const { error } = await supabase.from('hubgames_game_prices').upsert(update, { onConflict: 'appid' })
        if (error) throw new Error(`No se pudo guardar el id de IsThereAnyDeal: ${error.message}`)
        result.itadMatched += update.filter((u) => u.itad_id).length
    }

    // Mínimo histórico en Steam y en todas las tiendas, región ES.
    const due = appids.filter((appid) => {
        const synced = known.get(appid)?.lows_synced_at
        return itadIds.has(appid) && (!synced || now - Date.parse(synced) > LOWS_MAX_AGE_MS)
    })
    for (const part of chunks(due, ITAD_BATCH)) {
        const ids = part.map((appid) => itadIds.get(appid)!)
        const [allLows, steamLows] = await Promise.all([
            itadPost<{ id: string; low: ItadLow | null }[]>('/games/historylow/v1?country=ES', ids),
            itadPost<{ id: string; lows: ItadLow[] }[]>(`/games/storelow/v2?country=ES&shops=${ITAD_STEAM_SHOP}`, ids),
        ])
        const allById = new Map(allLows.map((g) => [g.id, g.low]))
        const steamById = new Map(steamLows.map((g) => [g.id, g.lows.find((l) => l.shop.id === ITAD_STEAM_SHOP) ?? null]))
        const update = part.map((appid) => {
            const id = itadIds.get(appid)!
            const all = allById.get(id) ?? null
            const steam = steamById.get(id) ?? null
            return {
                appid,
                steam_low: steam?.price.amountInt ?? null,
                steam_low_at: steam?.timestamp ?? null,
                all_low: all?.price.amountInt ?? null,
                all_low_shop: all?.shop.name ?? null,
                all_low_at: all?.timestamp ?? null,
                lows_synced_at: syncedAt,
            }
        })
        const { error } = await supabase.from('hubgames_game_prices').upsert(update, { onConflict: 'appid' })
        if (error) throw new Error(`No se pudieron guardar los mínimos: ${error.message}`)
        result.lowsUpdated += update.length
    }
    return result
}
