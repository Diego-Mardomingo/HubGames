// Sincronización de la biblioteca de Steam (#12). Módulo compartido: lo usan el script de GitHub Actions
// (scripts/sync-steam-library.ts) y, más adelante, un route handler. Recibe el cliente con service_role.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from './supabase/database.types'
import { getSteamSpyDetails, getSteamStoreDetails, parseSteamDate, sleep } from '../../scripts/steam-utils'

type Client = SupabaseClient<Database>

const STEAM_API = 'https://api.steampowered.com'
/** El Store admite ~200 peticiones cada 5 min (1,5 s por ficha); se deja margen. */
const STORE_DELAY_MS = 1600
const RATE_LIMIT_BACKOFF_MS = 60_000
const MAX_RETRIES = 3
const UPSERT_CHUNK = 500
const IN_CHUNK = 200

interface OwnedGame {
    appid: number
    name?: string
    playtime_forever?: number
    playtime_2weeks?: number
    rtime_last_played?: number
}

export interface SteamSyncOptions {
    /** Instante (ms epoch) a partir del cual no se piden más fichas. Lo que quede se completa en la siguiente ejecución. */
    deadline?: number
    log?: (msg: string) => void
}

export interface SteamSyncResult {
    ownedGames: number
    newToTray: number
    catalogFetched: number
    catalogPending: number
}

export class SteamSyncError extends Error {}

function chunks<T>(items: T[], size: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
    return out
}

async function fetchOwnedGames(steamid: string): Promise<OwnedGame[]> {
    const key = process.env.STEAM_WEB_API_KEY
    if (!key) throw new SteamSyncError('Falta STEAM_WEB_API_KEY')
    const res = await fetch(
        `${STEAM_API}/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamid}&include_appinfo=1&include_played_free_games=1&format=json`,
        { cache: 'no-store' },
    )
    if (!res.ok) throw new SteamSyncError(`GetOwnedGames: ${res.status}`)
    const response = (await res.json())?.response
    // Sin `games` el perfil o los detalles de juego son privados (o la cuenta no tiene juegos).
    if (!Array.isArray(response?.games)) {
        throw new SteamSyncError('Steam no devuelve juegos: revisa que el perfil y los detalles de juego sean públicos')
    }
    return response.games
}

/** Reintenta con espera si Steam responde 429 (límite de velocidad). */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await fn()
        } catch (e) {
            const limited = e instanceof Error && /\b(429|403)\b/.test(e.message)
            if (!limited || attempt >= MAX_RETRIES) throw e
            await sleep(RATE_LIMIT_BACKOFF_MS * attempt)
        }
    }
}

async function missingFromCatalog(supabase: Client, appids: number[]): Promise<number[]> {
    const known = new Set<number>()
    for (const part of chunks(appids, IN_CHUNK)) {
        const { data, error } = await supabase.from('hubgames_juegos_steam').select('steam_appid').in('steam_appid', part)
        if (error) throw new SteamSyncError(`No se pudo leer el catálogo: ${error.message}`)
        for (const row of data) known.add(row.steam_appid)
    }
    return appids.filter((id) => !known.has(id))
}

/** Ficha completa (Store + SteamSpy). Si el Store no la tiene (juego retirado), guarda una ficha mínima para no reintentar. */
async function fetchCatalogRow(game: OwnedGame): Promise<Database['public']['Tables']['hubgames_juegos_steam']['Insert']> {
    const store = await withRetry(() => getSteamStoreDetails(game.appid))
    if (!store) return { steam_appid: game.appid, name: game.name || `App ${game.appid}`, last_synced_at: new Date().toISOString() }

    const spy = await withRetry(() => getSteamSpyDetails(game.appid)).catch(() => null)
    const positive = spy?.positive ?? 0
    const negative = spy?.negative ?? 0
    return {
        steam_appid: game.appid,
        name: store.name,
        type: store.type || null,
        required_age: store.required_age ?? null,
        is_free: store.is_free ?? false,
        short_description: store.short_description || null,
        detailed_description: store.detailed_description || null,
        about_the_game: store.about_the_game || null,
        supported_languages: store.supported_languages || null,
        developers: store.developers || [],
        publishers: store.publishers || [],
        website: store.website || null,
        header_image: store.header_image || null,
        capsule_image: store.capsule_image || null,
        capsule_imagev5: store.capsule_imagev5 || null,
        background: store.background || null,
        background_raw: store.background_raw || null,
        release_date_text: store.release_date?.date || null,
        release_date: parseSteamDate(store.release_date?.date),
        coming_soon: store.release_date?.coming_soon ?? null,
        metacritic_score: store.metacritic?.score ?? null,
        metacritic_url: store.metacritic?.url ?? null,
        categories: (store.categories || []) as Json,
        genres: (store.genres || []) as Json,
        screenshots: (store.screenshots || []) as Json,
        movies: (store.movies || []) as Json,
        price_overview: (store.price_overview || null) as Json,
        packages: (store.packages || null) as Json,
        platforms: (store.platforms || {}) as Json,
        recommendations_total: store.recommendations?.total ?? null,
        achievements_total: store.achievements?.total ?? null,
        steamspy_score_rank: spy?.score_rank ? Number(spy.score_rank) || null : null,
        steamspy_positive: positive,
        steamspy_negative: negative,
        steamspy_userscore: positive + negative > 0 ? Math.round((positive / (positive + negative)) * 100) : null,
        steamspy_owners: spy?.owners || null,
        steamspy_average_forever: spy?.average_forever ?? null,
        steamspy_average_2weeks: spy?.average_2weeks ?? null,
        steamspy_median_forever: spy?.median_forever ?? null,
        steamspy_median_2weeks: spy?.median_2weeks ?? null,
        steamspy_ccu: spy?.ccu ?? null,
        steamspy_tags: (spy?.tags || {}) as Json,
        steamspy_raw: (spy || null) as Json,
        steam_store_raw: store as unknown as Json,
        last_synced_at: new Date().toISOString(),
    }
}

/** Importa la biblioteca de un usuario. Idempotente: repetirla no duplica ni pisa el estado que ya tengan los juegos. */
export async function syncSteamLibrary(supabase: Client, userId: string, options: SteamSyncOptions = {}): Promise<SteamSyncResult> {
    const log = options.log ?? (() => {})

    const { data: link, error: linkError } = await supabase
        .from('hubgames_user_steam')
        .select('steamid')
        .eq('user_id', userId)
        .maybeSingle()
    if (linkError) throw new SteamSyncError(`No se pudo leer la vinculación: ${linkError.message}`)
    if (!link) throw new SteamSyncError('El usuario no tiene Steam vinculado')

    const owned = await fetchOwnedGames(link.steamid)
    log(`Biblioteca: ${owned.length} juegos`)

    // Horas y última partida. first_seen_at no se envía: lo fija el default al insertar y se conserva al actualizar.
    for (const part of chunks(owned, UPSERT_CHUNK)) {
        const { error } = await supabase.from('hubgames_user_steam_games').upsert(
            part.map((g) => ({
                user_id: userId,
                appid: g.appid,
                playtime_forever: g.playtime_forever ?? 0,
                playtime_2weeks: g.playtime_2weeks ?? 0,
                rtime_last_played: g.rtime_last_played ? new Date(g.rtime_last_played * 1000).toISOString() : null,
            })),
            { onConflict: 'user_id,appid' },
        )
        if (error) throw new SteamSyncError(`No se pudo guardar la biblioteca: ${error.message}`)
    }

    // Los juegos nuevos entran en la Bandeja; los que ya tienen estado se dejan como están.
    const { data: existing, error: existingError } = await supabase.from('hubgames_user_games').select('appid').eq('user_id', userId)
    if (existingError) throw new SteamSyncError(`No se pudieron leer tus juegos: ${existingError.message}`)
    const tracked = new Set(existing.map((r) => r.appid))
    const fresh = owned.filter((g) => !tracked.has(g.appid))
    for (const part of chunks(fresh, UPSERT_CHUNK)) {
        const { error } = await supabase
            .from('hubgames_user_games')
            .upsert(part.map((g) => ({ user_id: userId, appid: g.appid, status: 'bandeja', status_source: 'auto' })), {
                onConflict: 'user_id,appid',
                ignoreDuplicates: true,
            })
        if (error) throw new SteamSyncError(`No se pudo crear la bandeja: ${error.message}`)
    }
    log(`Nuevos en la bandeja: ${fresh.length}`)

    // Fichas que aún no están en el catálogo, con límite de velocidad.
    const byId = new Map(owned.map((g) => [g.appid, g]))
    const missing = await missingFromCatalog(supabase, [...byId.keys()])
    log(`Fichas por traer: ${missing.length}`)
    let fetched = 0
    for (const appid of missing) {
        if (options.deadline && Date.now() >= options.deadline) break
        if (fetched > 0) await sleep(STORE_DELAY_MS)
        const row = await fetchCatalogRow(byId.get(appid)!)
        const { error } = await supabase.from('hubgames_juegos_steam').upsert(row, { onConflict: 'steam_appid' })
        if (error) throw new SteamSyncError(`No se pudo guardar la ficha ${appid}: ${error.message}`)
        fetched++
        if (fetched % 25 === 0) log(`Fichas: ${fetched}/${missing.length}`)
    }

    const { error: touchError } = await supabase
        .from('hubgames_user_steam')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('user_id', userId)
    if (touchError) throw new SteamSyncError(`No se pudo marcar la sincronización: ${touchError.message}`)

    return { ownedGames: owned.length, newToTray: fresh.length, catalogFetched: fetched, catalogPending: missing.length - fetched }
}
