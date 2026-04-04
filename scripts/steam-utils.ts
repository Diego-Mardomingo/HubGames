import { createClient } from '@supabase/supabase-js'

const STEAMSPY_BASE_URL = 'https://steamspy.com/api.php'
const STEAM_STORE_BASE_URL = 'https://store.steampowered.com/api'
const STEAM_WEB_BASE_URL = 'https://api.steampowered.com'

type SteamSpyDetails = {
    appid?: number
    name?: string
    score_rank?: string
    positive?: number
    negative?: number
    userscore?: number
    owners?: string
    average_forever?: number
    average_2weeks?: number
    median_forever?: number
    median_2weeks?: number
    ccu?: number
    tags?: Record<string, number>
}

export type SteamStoreDetails = {
    steam_appid: number
    name: string
    type?: string
    required_age?: number
    is_free?: boolean
    short_description?: string
    detailed_description?: string
    about_the_game?: string
    supported_languages?: string
    developers?: string[]
    publishers?: string[]
    website?: string
    header_image?: string
    capsule_image?: string
    capsule_imagev5?: string
    background?: string
    background_raw?: string
    release_date?: {
        date?: string
        coming_soon?: boolean
    }
    metacritic?: {
        score?: number
        url?: string
    }
    categories?: Array<{ id: number; description: string }>
    genres?: Array<{ id: string; description: string }>
    screenshots?: Array<{ id: number; path_full: string }>
    movies?: unknown[]
    recommendations?: { total?: number }
    achievements?: { total?: number }
    price_overview?: unknown
    packages?: unknown
    platforms?: {
        windows?: boolean
        mac?: boolean
        linux?: boolean
    }
}

export function createServiceRoleClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
    }
    return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

export async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) {
        throw new Error(`Request failed ${response.status} for ${url}`)
    }
    return response.json() as Promise<T>
}

export async function getTopAppIdsFromSteamSpy(): Promise<number[]> {
    const [in2Weeks, owned, forever] = await Promise.all([
        fetchJson<Record<string, { appid: number }>>(`${STEAMSPY_BASE_URL}?request=top100in2weeks`),
        fetchJson<Record<string, { appid: number }>>(`${STEAMSPY_BASE_URL}?request=top100owned`),
        fetchJson<Record<string, { appid: number }>>(`${STEAMSPY_BASE_URL}?request=top100forever`),
    ])

    const all = new Set<number>()
    for (const row of Object.values(in2Weeks || {})) all.add(row.appid)
    for (const row of Object.values(owned || {})) all.add(row.appid)
    for (const row of Object.values(forever || {})) all.add(row.appid)
    return Array.from(all)
}

export type SteamSpyTop100Request = 'top100in2weeks' | 'top100owned' | 'top100forever'

/** Orden por ranking SteamSpy (claves numéricas ascendentes). */
export async function getSteamSpyTop100Ranked(request: SteamSpyTop100Request): Promise<number[]> {
    const data = await fetchJson<Record<string, { appid?: number }>>(
        `${STEAMSPY_BASE_URL}?request=${request}`
    )
    const entries = Object.entries(data || {}).filter(
        ([k, v]) => /^\d+$/.test(k) && typeof v?.appid === 'number'
    )
    entries.sort((a, b) => Number(a[0]) - Number(b[0]))
    return entries.map(([, v]) => v.appid as number)
}

export async function getTop100In2WeeksAppIds(): Promise<number[]> {
    return getSteamSpyTop100Ranked('top100in2weeks')
}

/**
 * Listado global SteamSpy por página (~1000 appids). Sirve para seguir descubriendo juegos
 * relevantes de cualquier época cuando los tops ya están en la pool.
 */
export async function getSteamSpyAllPage(page: number): Promise<number[]> {
    try {
        const data = await fetchJson<Record<string, { appid?: number }>>(
            `${STEAMSPY_BASE_URL}?request=all&page=${page}`
        )
        return Object.values(data || {})
            .map((row) => row?.appid)
            .filter((id): id is number => typeof id === 'number' && id > 0)
    } catch {
        return []
    }
}

function extractAppIdsFromFeaturedItemsList(items: unknown): number[] {
    if (!Array.isArray(items)) return []
    const ids: number[] = []
    for (const raw of items) {
        const item = raw as { id?: number; type?: number; url?: string }
        if (typeof item.id === 'number') {
            if (item.type === 1) continue
            ids.push(item.id)
        }
        if (item.url && typeof item.url === 'string') {
            const m = item.url.match(/store\.steampowered\.com\/app\/(\d+)/)
            if (m) ids.push(Number(m[1]))
        }
    }
    return ids
}

/**
 * Solo la sección "Nuevos lanzamientos" del storefront (misma API que featuredcategories).
 */
export async function getAppIdsFromSteamNewReleases(): Promise<number[]> {
    const data = await fetchJson<Record<string, unknown>>(
        `${STEAM_STORE_BASE_URL}/featuredcategories?cc=ES&l=spanish`
    )
    const section = data.new_releases
    if (!section || typeof section !== 'object') return []
    const items = (section as { items?: unknown }).items
    const raw = extractAppIdsFromFeaturedItemsList(items)
    const seen = new Set<number>()
    const out: number[] = []
    for (const id of raw) {
        if (!seen.has(id)) {
            seen.add(id)
            out.push(id)
        }
    }
    return out
}

/**
 * Solo la sección "Más vendidos" del storefront (misma API que featuredcategories).
 */
export async function getAppIdsFromSteamTopSellers(): Promise<number[]> {
    const data = await fetchJson<Record<string, unknown>>(
        `${STEAM_STORE_BASE_URL}/featuredcategories?cc=ES&l=spanish`
    )
    const section = data.top_sellers
    if (!section || typeof section !== 'object') return []
    const items = (section as { items?: unknown }).items
    const raw = extractAppIdsFromFeaturedItemsList(items)
    const seen = new Set<number>()
    const out: number[] = []
    for (const id of raw) {
        if (!seen.has(id)) {
            seen.add(id)
            out.push(id)
        }
    }
    return out
}

/**
 * App IDs from the public Steam Store API (featured, offers, top sellers, new releases, etc.).
 * No API key required. See https://wiki.teamfortress.com/wiki/User:WindBOT/Steam_Web_API#Storefront
 */
export async function getAppIdsFromSteamFeaturedCategories(): Promise<number[]> {
    const data = await fetchJson<Record<string, unknown>>(
        `${STEAM_STORE_BASE_URL}/featuredcategories?cc=ES&l=spanish`
    )
    const ids = new Set<number>()
    for (const section of Object.values(data)) {
        if (!section || typeof section !== 'object') continue
        const items = (section as { items?: unknown }).items
        if (!Array.isArray(items)) continue
        for (const raw of items) {
            const item = raw as { id?: number; type?: number; url?: string }
            if (typeof item.id === 'number') {
                if (item.type === 1) continue
                ids.add(item.id)
            }
            if (item.url && typeof item.url === 'string') {
                const m = item.url.match(/store\.steampowered\.com\/app\/(\d+)/)
                if (m) ids.add(Number(m[1]))
            }
        }
    }
    return Array.from(ids)
}

export async function getSteamStoreDetails(appid: number): Promise<SteamStoreDetails | null> {
    const payload = await fetchJson<Record<string, { success: boolean; data?: SteamStoreDetails }>>(
        `${STEAM_STORE_BASE_URL}/appdetails?appids=${appid}&cc=ES&l=spanish`
    )
    const target = payload[String(appid)]
    if (!target?.success || !target.data) return null
    return target.data
}

export async function getSteamSpyDetails(appid: number): Promise<SteamSpyDetails | null> {
    return fetchJson<SteamSpyDetails>(`${STEAMSPY_BASE_URL}?request=appdetails&appid=${appid}`)
}

export async function getCurrentPlayers(appid: number): Promise<number | null> {
    const key = process.env.STEAM_WEB_API_KEY
    const keyParam = key ? `&key=${key}` : ''
    try {
        const result = await fetchJson<{ response?: { player_count?: number } }>(
            `${STEAM_WEB_BASE_URL}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}${keyParam}`
        )
        return result.response?.player_count ?? null
    } catch {
        return null
    }
}

export function parseSteamDate(dateText?: string): string | null {
    if (!dateText) return null
    const direct = new Date(dateText)
    if (!Number.isNaN(direct.getTime())) return direct.toISOString().slice(0, 10)
    const fallback = new Date(dateText.replace(',', ''))
    if (!Number.isNaN(fallback.getTime())) return fallback.toISOString().slice(0, 10)
    return null
}

export function ownersMidpoint(owners?: string): number {
    if (!owners) return 0
    const [minRaw, maxRaw] = owners.split('..').map((value) => Number(value.replace(/[^\d]/g, '')))
    if (!Number.isFinite(minRaw) || !Number.isFinite(maxRaw)) return 0
    return (minRaw + maxRaw) / 2
}

export function startOfWeekSunday(date: Date): Date {
    const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    const day = value.getUTCDay()
    value.setUTCDate(value.getUTCDate() - day)
    return value
}

export function dateToIso(value: Date): string {
    return value.toISOString().slice(0, 10)
}

/** YYYY-MM-DD según calendario en Europa/Madrid (p. ej. `selected_daily_date` alineado con `fecha` JUDI). */
export function dateToIsoMadrid(value: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(value)
}

/** DD-MM-YYYY según calendario en Europa/Madrid (misma regla que la UI del juego del día). */
export function dateToLegacyJudi(date: Date): string {
    const ymd = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date)
    const [y, m, d] = ymd.split('-')
    return `${d}-${m}-${y}`
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
