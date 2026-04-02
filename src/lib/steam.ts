import type { Game, GameDetails, SearchParams } from '@/lib/game-types'

const STEAM_STORE_BASE_URL = 'https://store.steampowered.com/api'
const STEAMSPY_BASE_URL = 'https://steamspy.com/api.php'

type CacheEntry = {
    expiresAt: number
    value: unknown
}

const cache = new Map<string, CacheEntry>()

type SteamStoreAppDetails = {
    steam_appid: number
    name: string
    short_description?: string
    detailed_description?: string
    about_the_game?: string
    header_image?: string
    background?: string
    background_raw?: string
    release_date?: {
        date?: string
        coming_soon?: boolean
    }
    metacritic?: {
        score?: number
    }
    developers?: string[]
    publishers?: string[]
    genres?: Array<{ id: string; description: string }>
    categories?: Array<{ id: number; description: string }>
    screenshots?: Array<{ id: number; path_full: string }>
    platforms?: {
        windows?: boolean
        mac?: boolean
        linux?: boolean
    }
}

type SteamSpyDetails = {
    appid?: number
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

async function fetchJsonWithCache<T>(url: string, ttlMs: number): Promise<T> {
    const now = Date.now()
    const cached = cache.get(url)
    if (cached && cached.expiresAt > now) {
        return cached.value as T
    }

    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
        },
    })

    if (!response.ok) {
        throw new Error(`Steam request failed: ${response.status} ${response.statusText}`)
    }

    const value = await response.json()
    cache.set(url, { value, expiresAt: now + ttlMs })
    return value as T
}

function stripHtml(html?: string): string {
    if (!html) return ''
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseReleaseDate(dateText?: string): string {
    if (!dateText) return ''
    const parsed = new Date(dateText)
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0]
    }

    // Steam suele devolver fechas como "10 Oct, 2019"
    const normalized = Date.parse(dateText.replace(',', ''))
    if (!Number.isNaN(normalized)) {
        return new Date(normalized).toISOString().split('T')[0]
    }
    return ''
}

function platformListFromSteam(details: SteamStoreAppDetails): Array<{ platform: { id: number; name: string } }> {
    const platforms: Array<{ platform: { id: number; name: string } }> = []
    if (details.platforms?.windows) platforms.push({ platform: { id: 4, name: 'PC (Windows)' } })
    if (details.platforms?.mac) platforms.push({ platform: { id: 5, name: 'Mac' } })
    if (details.platforms?.linux) platforms.push({ platform: { id: 6, name: 'Linux' } })
    return platforms
}

function genresFromSteam(details: SteamStoreAppDetails): Array<{ id: number; name: string }> {
    return (details.genres || []).map((genre) => ({
        id: Number(genre.id) || 0,
        name: genre.description,
    }))
}

function toGameSummary(details: SteamStoreAppDetails): Game {
    return {
        id: details.steam_appid,
        name: details.name,
        background_image: details.header_image || '',
        released: parseReleaseDate(details.release_date?.date),
        metacritic: details.metacritic?.score ?? null,
        genres: genresFromSteam(details),
        platforms: platformListFromSteam(details),
    }
}

async function getSteamStoreAppDetails(appid: number): Promise<SteamStoreAppDetails | null> {
    const url = `${STEAM_STORE_BASE_URL}/appdetails?appids=${appid}&cc=ES&l=spanish`
    const json = await fetchJsonWithCache<Record<string, { success: boolean; data?: SteamStoreAppDetails }>>(url, 1000 * 60 * 60)
    const payload = json[String(appid)]
    if (!payload?.success || !payload.data) return null
    return payload.data
}

async function getSteamSpyAppDetails(appid: number): Promise<SteamSpyDetails | null> {
    const url = `${STEAMSPY_BASE_URL}?request=appdetails&appid=${appid}`
    const json = await fetchJsonWithCache<SteamSpyDetails>(url, 1000 * 60 * 60)
    return json || null
}

async function getTopSteamSpyAppIds(): Promise<number[]> {
    const [in2Weeks, forever] = await Promise.all([
        fetchJsonWithCache<Record<string, { appid: number }>>(`${STEAMSPY_BASE_URL}?request=top100in2weeks`, 1000 * 60 * 30),
        fetchJsonWithCache<Record<string, { appid: number }>>(`${STEAMSPY_BASE_URL}?request=top100forever`, 1000 * 60 * 30),
    ])

    const ids = new Set<number>()
    for (const app of Object.values(in2Weeks || {})) ids.add(app.appid)
    for (const app of Object.values(forever || {})) ids.add(app.appid)
    return Array.from(ids)
}

function matchesDateFilter(released: string, dates?: string): boolean {
    if (!dates || !released) return true
    const [start, end] = dates.split(',')
    if (!start || !end) return true
    return released >= start && released <= end
}

function matchesMetacriticFilter(score: number | null, metacritic?: string): boolean {
    if (!metacritic || score === null) return true
    const [min, max] = metacritic.split(',').map((value) => Number(value))
    if (Number.isNaN(min) || Number.isNaN(max)) return true
    return score >= min && score <= max
}

function matchesPlatformFilter(platforms: Array<{ platform: { id: number } }>, platformIds?: string): boolean {
    if (!platformIds) return true
    const wanted = platformIds.split(',').filter(Boolean)
    if (wanted.length === 0) return true

    // RAWG platform IDs históricos del proyecto:
    // 4: PC, 5: Mac, 6: Linux. Para consolas, Steam no ofrece mapeo fiable.
    const supported = new Set(platforms.map((platform) => String(platform.platform.id)))
    return wanted.every((platformId) => supported.has(platformId))
}

function sortGames(games: Game[], ordering?: string): Game[] {
    if (ordering === '-metacritic') {
        return [...games].sort((a, b) => (b.metacritic ?? 0) - (a.metacritic ?? 0))
    }
    if (ordering === '-added') {
        return [...games].sort((a, b) => b.released.localeCompare(a.released))
    }
    return games
}

export async function searchGames(params: SearchParams) {
    const page = Number(params.page || 1)
    const pageSize = Number(params.page_size || 20)
    const term = params.search?.trim()

    let appIds: number[] = []

    if (term) {
        const url = `${STEAM_STORE_BASE_URL}/storesearch/?term=${encodeURIComponent(term)}&l=spanish&cc=ES`
        const searchResponse = await fetchJsonWithCache<{ items?: Array<{ id: number }> }>(url, 1000 * 60 * 5)
        appIds = (searchResponse.items || []).map((item) => item.id)
    } else {
        appIds = await getTopSteamSpyAppIds()
    }

    if (appIds.length === 0) {
        return { results: [], next: null, previous: null, count: 0 }
    }

    const details = await Promise.all(
        appIds.slice(0, 120).map(async (appid) => {
            const store = await getSteamStoreAppDetails(appid)
            return store ? toGameSummary(store) : null
        })
    )

    let results = details
        .filter((game): game is Game => game !== null)
        .filter((game) => Boolean(game.background_image))
    results = results.filter((game) =>
        matchesDateFilter(game.released, params.dates) &&
        matchesMetacriticFilter(game.metacritic, params.metacritic) &&
        matchesPlatformFilter(game.platforms, params.platforms)
    )

    results = sortGames(results, params.ordering)

    const start = (page - 1) * pageSize
    const end = start + pageSize
    const paginated = results.slice(start, end)
    const next = end < results.length ? `?page=${page + 1}` : null
    const previous = page > 1 ? `?page=${page - 1}` : null

    return {
        results: paginated,
        next,
        previous,
        count: results.length,
    }
}

export async function getGameDetails(id: number): Promise<GameDetails> {
    const [store, steamSpy] = await Promise.all([
        getSteamStoreAppDetails(id),
        getSteamSpyAppDetails(id),
    ])

    if (!store) {
        throw new Error('Failed to fetch Steam game details')
    }

    const tags = Object.keys(steamSpy?.tags || {}).slice(0, 12).map((name, index) => ({
        id: index + 1,
        name,
    }))

    return {
        ...toGameSummary(store),
        description_raw: stripHtml(store.detailed_description || store.about_the_game || store.short_description),
        developers: (store.developers || []).map((name, index) => ({ id: index + 1, name })),
        publishers: (store.publishers || []).map((name, index) => ({ id: index + 1, name })),
        rating: steamSpy?.userscore ? Math.min(5, Math.max(0, steamSpy.userscore / 20)) : 0,
        tags,
        background_image_additional: store.background || store.background_raw || store.header_image,
        esrb_rating: null,
        playtime: steamSpy?.average_forever ? Math.round(steamSpy.average_forever / 60) : 0,
        metacritic: store.metacritic?.score ?? null,
        genres: genresFromSteam(store),
        platforms: platformListFromSteam(store),
    }
}

export async function getGameScreenshots(id: number) {
    const store = await getSteamStoreAppDetails(id)
    if (!store) {
        throw new Error('Failed to fetch Steam game screenshots')
    }

    return {
        results: (store.screenshots || []).map((screenshot) => ({
            id: screenshot.id,
            image: screenshot.path_full,
        })),
    }
}
