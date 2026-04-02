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

export function dateToLegacyJudi(date: Date): string {
    const d = String(date.getUTCDate()).padStart(2, '0')
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const y = date.getUTCFullYear()
    return `${d}-${m}-${y}`
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
