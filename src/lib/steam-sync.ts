// Sincronización con Steam: biblioteca (#12), logros (#13), foto diaria de horas (#15), wishlist (#35) y registro (#14). Módulo compartido: lo usan el script de GitHub Actions
// (scripts/steam-sync.ts) y el route handler de "Sincronizar ahora" (src/app/api/steam/sync). Recibe el cliente con service_role.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from './supabase/database.types'
import { getSteamSpyDetails, getSteamStoreDetails, parseSteamDate, sleep } from '../../scripts/steam-utils'
import { evaluateGame } from './tracker-rules'
import { goalMinutes } from './game-goal'
import { refreshPrices, type PriceSyncResult } from './prices'
import type { GameStatus } from './tracker'
import { achievementIconUrl } from './steam-icon'

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

async function getSteamId(supabase: Client, userId: string): Promise<string> {
    const { data: link, error } = await supabase
        .from('hubgames_user_steam')
        .select('steamid')
        .eq('user_id', userId)
        .maybeSingle()
    if (error) throw new SteamSyncError(`No se pudo leer la vinculación: ${error.message}`)
    if (!link) throw new SteamSyncError('El usuario no tiene Steam vinculado')
    return link.steamid
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

type CatalogRow = Database['public']['Tables']['hubgames_juegos_steam']['Insert']

/** Ficha completa (Store + SteamSpy). Si el Store no la tiene (juego retirado), guarda una ficha mínima para no reintentar. */
async function fetchCatalogRow(game: OwnedGame): Promise<CatalogRow> {
    return (
        (await fetchStoreCatalogRow(game.appid)) ?? {
            steam_appid: game.appid,
            name: game.name || `App ${game.appid}`,
            last_synced_at: new Date().toISOString(),
        }
    )
}

/**
 * Ficha completa (Store + SteamSpy), o null si el Store no tiene ese appid. También la usa la ficha /juego (#22),
 * con `retry = false`: una página no puede quedarse esperando un minuto por el límite de velocidad.
 */
export async function fetchStoreCatalogRow(appid: number, retry = true): Promise<CatalogRow | null> {
    const call = retry ? withRetry : <T,>(fn: () => Promise<T>) => fn()
    const store = await call(() => getSteamStoreDetails(appid))
    if (!store) return null

    const spy = await call(() => getSteamSpyDetails(appid)).catch(() => null)
    const positive = spy?.positive ?? 0
    const negative = spy?.negative ?? 0
    return {
        steam_appid: appid,
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

/** Trae las fichas que aún no están en el catálogo, con límite de velocidad y hasta el `deadline`. */
async function fillCatalog(
    supabase: Client,
    games: OwnedGame[],
    options: SteamSyncOptions,
): Promise<{ fetched: number; pending: number }> {
    const log = options.log ?? (() => {})
    const byId = new Map(games.map((g) => [g.appid, g]))
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
    return { fetched, pending: missing.length - fetched }
}

/** Importa la biblioteca de un usuario. Idempotente: repetirla no duplica ni pisa el estado que ya tengan los juegos. */
export async function syncSteamLibrary(supabase: Client, userId: string, options: SteamSyncOptions = {}): Promise<SteamSyncResult> {
    const log = options.log ?? (() => {})

    const owned = await fetchOwnedGames(await getSteamId(supabase, userId))
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
                // Si era del grupo familiar y lo has comprado, pasa a ser tuyo.
                source: 'own',
                family_gone_at: null,
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

    // Fichas de lo tuyo y de lo que te presta el grupo familiar (#86): al actualizar el grupo solo da tiempo a traer unas pocas.
    const borrowed = await selectAll<{ appid: number }>((from, to) =>
        supabase.from('hubgames_user_steam_games').select('appid').eq('user_id', userId).eq('source', 'family').is('family_gone_at', null).order('appid').range(from, to),
    )
    const ownedIds = new Set(owned.map((g) => g.appid))
    const { fetched, pending } = await fillCatalog(supabase, [...owned, ...borrowed.filter((b) => !ownedIds.has(b.appid))], options)

    const { error: touchError } = await supabase
        .from('hubgames_user_steam')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('user_id', userId)
    if (touchError) throw new SteamSyncError(`No se pudo marcar la sincronización: ${touchError.message}`)

    return { ownedGames: owned.length, newToTray: fresh.length, catalogFetched: fetched, catalogPending: pending }
}

// ─── Wishlist y precios (#35, #36) ───────────────────────────────────────────

interface WishlistItem {
    appid: number
    priority?: number
    date_added?: number
}

export interface WishlistSyncResult {
    /** null: Steam no devolvió la lista (vacía o privada) y no se ha tocado la guardada. */
    steamItems: number | null
    purchased: number
    catalogFetched: number
    catalogPending: number
    prices: PriceSyncResult | null
    pricesError: string | null
}

/** Juegos de la wishlist de Steam, o null si no viene la lista (no se distingue entre vacía y privada). */
async function fetchWishlist(steamid: string): Promise<WishlistItem[] | null> {
    const key = process.env.STEAM_WEB_API_KEY
    const res = await fetch(`${STEAM_API}/IWishlistService/GetWishlist/v1/?steamid=${steamid}${key ? `&key=${key}` : ''}`, {
        cache: 'no-store',
    })
    if (!res.ok) throw new SteamSyncError(`GetWishlist: ${res.status}`)
    const items = (await res.json())?.response?.items
    return Array.isArray(items) ? items : null
}

/**
 * Wishlist de Steam (reemplaza la anterior que vino de Steam; la manual se respeta), quita los juegos ya comprados
 * (la sincronización de la biblioteca los mete en la Bandeja), trae sus fichas y actualiza precios y mínimos.
 */
export async function syncWishlist(supabase: Client, userId: string, options: SteamSyncOptions = {}): Promise<WishlistSyncResult> {
    const log = options.log ?? (() => {})
    const items = await fetchWishlist(await getSteamId(supabase, userId))
    log(items ? `Wishlist de Steam: ${items.length} juegos` : 'Wishlist de Steam: sin datos (vacía o privada), se deja como estaba')

    if (items) {
        const rows = items.map((i) => ({
            user_id: userId,
            appid: i.appid,
            source: 'steam',
            priority: i.priority ?? 0,
            date_added: i.date_added ? new Date(i.date_added * 1000).toISOString() : new Date().toISOString(),
        }))
        for (const part of chunks(rows, UPSERT_CHUNK)) {
            const { error } = await supabase.from('hubgames_user_wishlist').upsert(part, { onConflict: 'user_id,appid' })
            if (error) throw new SteamSyncError(`No se pudo guardar la wishlist: ${error.message}`)
        }
        const keep = new Set(items.map((i) => i.appid))
        const stored = await selectAll<{ appid: number }>((from, to) =>
            supabase.from('hubgames_user_wishlist').select('appid').eq('user_id', userId).eq('source', 'steam').order('appid').range(from, to),
        )
        const gone = stored.map((r) => r.appid).filter((id) => !keep.has(id))
        for (const part of chunks(gone, IN_CHUNK)) {
            const { error } = await supabase.from('hubgames_user_wishlist').delete().eq('user_id', userId).in('appid', part)
            if (error) throw new SteamSyncError(`No se pudo limpiar la wishlist: ${error.message}`)
        }
    }

    // Comprados: salen de la wishlist (los manuales también). Ya están en la biblioteca y, si son nuevos, en la Bandeja.
    const wished = await selectAll<{ appid: number }>((from, to) =>
        supabase.from('hubgames_user_wishlist').select('appid').eq('user_id', userId).order('appid').range(from, to),
    )
    const owned = new Set<number>()
    for (const part of chunks(wished.map((w) => w.appid), IN_CHUNK)) {
        const { data, error } = await supabase
            .from('hubgames_user_steam_games')
            .select('appid')
            .eq('user_id', userId)
            .eq('source', 'own')
            .in('appid', part)
        if (error) throw new SteamSyncError(error.message)
        for (const row of data) owned.add(row.appid)
    }
    for (const part of chunks([...owned], IN_CHUNK)) {
        const { error } = await supabase.from('hubgames_user_wishlist').delete().eq('user_id', userId).in('appid', part)
        if (error) throw new SteamSyncError(`No se pudieron quitar los comprados de la wishlist: ${error.message}`)
    }
    if (owned.size) log(`Comprados (salen de la wishlist): ${owned.size}`)

    const appids = wished.map((w) => w.appid).filter((id) => !owned.has(id))
    const { fetched, pending } = await fillCatalog(supabase, appids.map((appid) => ({ appid })), options)

    // Los pendientes sin comprar también llevan precio y mínimo (se añaden con su ficha desde /api/pendientes).
    const unownedPending = await selectAll<{ appid: number | null }>((from, to) =>
        supabase.from('hubgames_library').select('appid').eq('user_id', userId).eq('owned', false).order('appid').range(from, to),
    )
    const priced = [...new Set([...appids, ...unownedPending.flatMap((r) => (r.appid === null ? [] : [r.appid]))])]

    // Precios: un fallo (Steam o IsThereAnyDeal) deja la sincronización como parcial, pero no tumba el resto.
    let prices: PriceSyncResult | null = null
    let pricesError: string | null = null
    try {
        prices = await refreshPrices(supabase, priced)
        log(`Precios: ${prices.pricesUpdated}, fotos nuevas: ${prices.snapshots}, mínimos: ${prices.lowsUpdated}`)
        if (prices.itadSkipped) log(`IsThereAnyDeal: ${prices.itadSkipped}`)
    } catch (e) {
        pricesError = e instanceof Error ? e.message : String(e)
        log(`Precios fallaron: ${pricesError}`)
    }

    return { steamItems: items?.length ?? null, purchased: owned.size, catalogFetched: fetched, catalogPending: pending, prices, pricesError }
}

// ─── Logros (#13) ────────────────────────────────────────────────────────────

/** Pausa entre llamadas a la Web API (límite ~100.000 al día; basta con no ir a ráfagas). */
const WEB_API_DELAY_MS = 300
/** Rareza global: se refresca como mucho una vez por semana y en tandas, para no concentrar llamadas un mismo día. */
const PERCENTS_MAX_AGE_MS = 7 * 24 * 3600_000
const PERCENTS_PER_RUN = 30
/** Esquema (nombres, iconos): se vuelve a pedir si tiene más de 30 días y el juego se ha jugado. */
const SCHEMA_MAX_AGE_MS = 30 * 24 * 3600_000

interface SchemaAchievement {
    name: string
    displayName?: string
    description?: string
    icon?: string
    icongray?: string
    hidden?: number
}

interface PlayerAchievement {
    apiname: string
    achieved: number
    unlocktime: number
}

export interface AchievementSyncResult {
    gamesDue: number
    gamesSynced: number
    gamesFailed: number
    percentsRefreshed: number
    apiCalls: number
}

type AppRow = Database['public']['Tables']['hubgames_steam_achievement_apps']['Row']

async function selectAll<T>(
    page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
    const out: T[] = []
    for (let from = 0; ; from += 1000) {
        const { data, error } = await page(from, from + 999)
        if (error) throw new SteamSyncError(error.message)
        out.push(...(data ?? []))
        if (!data || data.length < 1000) return out
    }
}

/** Sincroniza los logros de los juegos jugados desde la última vez (o que aún no tienen datos). */
export async function syncSteamAchievements(
    supabase: Client,
    userId: string,
    options: SteamSyncOptions = {},
): Promise<AchievementSyncResult> {
    const log = options.log ?? (() => {})
    const key = process.env.STEAM_WEB_API_KEY
    if (!key) throw new SteamSyncError('Falta STEAM_WEB_API_KEY')
    const steamid = await getSteamId(supabase, userId)

    let apiCalls = 0
    async function steamGet<T>(path: string): Promise<{ status: number; body: T | null }> {
        if (apiCalls > 0) await sleep(WEB_API_DELAY_MS)
        apiCalls++
        const res = await fetch(`${STEAM_API}${path}&key=${key}`, { cache: 'no-store' })
        const body = res.ok || res.status === 400 ? ((await res.json().catch(() => null)) as T | null) : null
        return { status: res.status, body }
    }

    async function refreshPercents(appid: number): Promise<void> {
        const { status, body } = await steamGet<{
            achievementpercentages?: { achievements?: { name: string; percent: string | number }[] }
        }>(`/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${appid}`)
        if (status !== 200) throw new SteamSyncError(`GetGlobalAchievementPercentagesForApp ${appid}: ${status}`)
        // Solo se actualizan logros que ya están en el esquema, para no crear filas sin nombre.
        const known = new Set(
            (
                await selectAll<{ apiname: string }>((from, to) =>
                    supabase.from('hubgames_steam_achievement_schema').select('apiname').eq('appid', appid).range(from, to),
                )
            ).map((r) => r.apiname),
        )
        const rows = (body?.achievementpercentages?.achievements ?? [])
            .filter((a) => known.has(a.name))
            .map((a) => ({ appid, apiname: a.name, global_percent: Number(a.percent) }))
        for (const part of chunks(rows, UPSERT_CHUNK)) {
            const { error } = await supabase.from('hubgames_steam_achievement_schema').upsert(part, { onConflict: 'appid,apiname' })
            if (error) throw new SteamSyncError(`No se pudo guardar la rareza de ${appid}: ${error.message}`)
        }
        const { error } = await supabase
            .from('hubgames_steam_achievement_apps')
            .update({ percents_synced_at: new Date().toISOString() })
            .eq('appid', appid)
        if (error) throw new SteamSyncError(error.message)
    }

    async function refreshSchema(appid: number): Promise<AppRow> {
        const { status, body } = await steamGet<{ game?: { availableGameStats?: { achievements?: SchemaAchievement[] } } }>(
            `/ISteamUserStats/GetSchemaForGame/v2/?appid=${appid}&l=spanish`,
        )
        if (status !== 200 && status !== 400) throw new SteamSyncError(`GetSchemaForGame ${appid}: ${status}`)
        // global_percent no se envía: se conserva la que hubiera y la pone refreshPercents.
        const rows = (body?.game?.availableGameStats?.achievements ?? []).map((a) => ({
            appid,
            apiname: a.name,
            display_name: a.displayName ?? null,
            description: a.description ?? null,
            icon: achievementIconUrl(a.icon),
            icongray: achievementIconUrl(a.icongray),
            hidden: a.hidden === 1,
        }))
        for (const part of chunks(rows, UPSERT_CHUNK)) {
            const { error } = await supabase.from('hubgames_steam_achievement_schema').upsert(part, { onConflict: 'appid,apiname' })
            if (error) throw new SteamSyncError(`No se pudo guardar el esquema de ${appid}: ${error.message}`)
        }
        const { data, error } = await supabase
            .from('hubgames_steam_achievement_apps')
            .upsert({ appid, total: rows.length, schema_synced_at: new Date().toISOString() }, { onConflict: 'appid' })
            .select()
            .single()
        if (error) throw new SteamSyncError(error.message)
        if (rows.length > 0 && !data.percents_synced_at) {
            await refreshPercents(appid)
            data.percents_synced_at = new Date().toISOString()
        }
        return data
    }

    const games = await selectAll<{ appid: number; rtime_last_played: string | null; achievements_synced_at: string | null }>(
        (from, to) =>
            supabase
                .from('hubgames_user_steam_games')
                .select('appid, rtime_last_played, achievements_synced_at')
                .eq('user_id', userId)
                .order('appid')
                .range(from, to),
    )
    const due = games.filter(
        (g) =>
            !g.achievements_synced_at ||
            (g.rtime_last_played !== null && Date.parse(g.rtime_last_played) > Date.parse(g.achievements_synced_at)),
    )
    log(`Logros: ${due.length} juegos por revisar de ${games.length}`)

    const apps = new Map<number, AppRow>()
    for (const part of chunks(games.map((g) => g.appid), IN_CHUNK)) {
        const { data, error } = await supabase.from('hubgames_steam_achievement_apps').select('*').in('appid', part)
        if (error) throw new SteamSyncError(error.message)
        for (const row of data) apps.set(row.appid, row)
    }

    let synced = 0
    let failed = 0
    for (const game of due) {
        if (options.deadline && Date.now() >= options.deadline) break
        try {
            let app = apps.get(game.appid)
            if (!app || Date.now() - Date.parse(app.schema_synced_at) > SCHEMA_MAX_AGE_MS) {
                app = await refreshSchema(game.appid)
                apps.set(game.appid, app)
            }

            let total = 0
            let unlocked = 0
            if (app.total > 0) {
                const { status, body } = await steamGet<{ playerstats?: { achievements?: PlayerAchievement[] } }>(
                    `/ISteamUserStats/GetPlayerAchievements/v1/?steamid=${steamid}&appid=${game.appid}&l=spanish`,
                )
                // 400 = sin estadísticas para este juego. 403 u otros: se reintenta en la próxima sincronización.
                if (status !== 200 && status !== 400) throw new SteamSyncError(`GetPlayerAchievements ${game.appid}: ${status}`)
                const list = body?.playerstats?.achievements ?? []
                total = list.length
                unlocked = list.filter((a) => a.achieved === 1).length
                const rows = list.map((a) => ({
                    user_id: userId,
                    appid: game.appid,
                    apiname: a.apiname,
                    achieved: a.achieved === 1,
                    unlocktime: a.unlocktime ? new Date(a.unlocktime * 1000).toISOString() : null,
                }))
                for (const part of chunks(rows, UPSERT_CHUNK)) {
                    const { error } = await supabase
                        .from('hubgames_user_achievements')
                        .upsert(part, { onConflict: 'user_id,appid,apiname' })
                    if (error) throw new SteamSyncError(`No se pudieron guardar los logros de ${game.appid}: ${error.message}`)
                }
            }

            const { error } = await supabase
                .from('hubgames_user_steam_games')
                .update({ achievements_total: total, achievements_unlocked: unlocked, achievements_synced_at: new Date().toISOString() })
                .eq('user_id', userId)
                .eq('appid', game.appid)
            if (error) throw new SteamSyncError(error.message)
            synced++
            if (synced % 25 === 0) log(`Logros: ${synced}/${due.length}`)
        } catch (e) {
            failed++
            log(`Logros de ${game.appid} fallaron: ${e instanceof Error ? e.message : e}`)
        }
    }

    // Rareza caducada de los juegos de la biblioteca, las más antiguas primero y en tandas pequeñas.
    const stale = [...apps.values()]
        .filter((a) => a.total > 0 && (!a.percents_synced_at || Date.now() - Date.parse(a.percents_synced_at) > PERCENTS_MAX_AGE_MS))
        .sort((a, b) => (a.percents_synced_at ?? '').localeCompare(b.percents_synced_at ?? ''))
        .slice(0, PERCENTS_PER_RUN)
    let percentsRefreshed = 0
    for (const app of stale) {
        if (options.deadline && Date.now() >= options.deadline) break
        try {
            await refreshPercents(app.appid)
            percentsRefreshed++
        } catch (e) {
            log(`Rareza de ${app.appid} falló: ${e instanceof Error ? e.message : e}`)
        }
    }

    return { gamesDue: due.length, gamesSynced: synced, gamesFailed: failed, percentsRefreshed, apiCalls }
}

// ─── Estados automáticos (#18) ───────────────────────────────────────────────

export interface TrackerRulesResult {
    toPlaying: number
    suggestions: number
}

/** Aplica las reglas de tracker-rules.ts con los datos recién sincronizados. Solo escribe lo que cambia. */
export async function applyTrackerRules(supabase: Client, userId: string, now: number = Date.now()): Promise<TrackerRulesResult> {
    const games = await selectAll<Database['public']['Tables']['hubgames_library']['Row']>((from, to) =>
        supabase.from('hubgames_library').select('*').eq('user_id', userId).order('appid').range(from, to),
    )

    let toPlaying = 0
    let suggestions = 0
    for (const game of games) {
        if (game.appid === null || !game.status || !game.status_source || !game.status_changed_at) continue
        const out = evaluateGame(
            {
                status: game.status as GameStatus,
                status_source: game.status_source,
                status_changed_at: game.status_changed_at,
                rtime_last_played: game.rtime_last_played,
                playtime_forever: game.playtime_forever ?? 0,
                playtime_2weeks: game.playtime_2weeks ?? 0,
                achievements_total: game.achievements_total,
                achievements_unlocked: game.achievements_unlocked,
                last_unlock_at: game.last_unlock_at,
                suggestion_dismissed_at: game.suggestion_dismissed_at,
                hltb_main_minutes: game.hltb_main,
                goal: game.goal,
                goal_minutes: goalMinutes({
                    goal: game.goal,
                    endless: game.endless ?? false,
                    playtime_forever: game.playtime_forever ?? 0,
                    achievements_total: game.achievements_total,
                    achievements_unlocked: game.achievements_unlocked,
                    hltb_main: game.hltb_main,
                    hltb_main_extra: game.hltb_main_extra,
                    hltb_completionist: game.hltb_completionist,
                    // Como antes: la sugerencia solo con HowLongToBeat, no con la mediana de SteamSpy.
                    steamspy_median_forever: null,
                }),
            },
            now,
        )
        if (out.suggestion) suggestions++
        if (!out.statusChanged && out.suggestion === game.suggestion) continue

        const update: Database['public']['Tables']['hubgames_user_games']['Update'] = { suggestion: out.suggestion }
        if (out.statusChanged) {
            update.status = out.status
            update.status_source = 'auto'
            if (!game.started_at) update.started_at = new Date(now).toISOString()
            toPlaying++
        }
        const { error } = await supabase.from('hubgames_user_games').update(update).eq('user_id', userId).eq('appid', game.appid)
        if (error) throw new SteamSyncError(`No se pudo actualizar el estado de ${game.appid}: ${error.message}`)
    }
    return { toPlaying, suggestions }
}

// ─── Sincronización completa y registro (#14, #15, #35) ─────────────────────

export type SyncSource = 'cron' | 'manual'

export interface FullSyncResult {
    status: 'ok' | 'parcial'
    library: SteamSyncResult
    snapshotRows: number
    /** null si la wishlist falló: el error queda en wishlistError y la sincronización, como parcial. */
    wishlist: WishlistSyncResult | null
    wishlistError: string | null
    achievements: AchievementSyncResult
    tracker: TrackerRulesResult
}

/** Biblioteca, foto diaria de horas, wishlist y precios, logros y estados automáticos, registrado en hubgames_sync_logs. Lanza el error tras registrarlo. */
export async function runSteamSync(
    supabase: Client,
    userId: string,
    source: SyncSource,
    options: SteamSyncOptions = {},
): Promise<FullSyncResult> {
    const { data: logRow, error: logError } = await supabase
        .from('hubgames_sync_logs')
        .insert({ user_id: userId, source })
        .select('id')
        .single()
    if (logError) throw new SteamSyncError(`No se pudo crear el log: ${logError.message}`)

    try {
        const library = await syncSteamLibrary(supabase, userId, options)
        const { data: snapshotRows, error: snapshotError } = await supabase.rpc('hubgames_take_playtime_snapshot', { p_user_id: userId })
        if (snapshotError) throw new SteamSyncError(`No se pudo guardar la foto de horas: ${snapshotError.message}`)
        let wishlist: WishlistSyncResult | null = null
        let wishlistError: string | null = null
        try {
            wishlist = await syncWishlist(supabase, userId, options)
        } catch (e) {
            wishlistError = e instanceof Error ? e.message : String(e)
            options.log?.(`Wishlist falló: ${wishlistError}`)
        }
        const achievements = await syncSteamAchievements(supabase, userId, options)
        const tracker = await applyTrackerRules(supabase, userId)

        const complete =
            library.catalogPending === 0 &&
            wishlist !== null &&
            wishlist.catalogPending === 0 &&
            wishlist.pricesError === null &&
            achievements.gamesFailed === 0 &&
            achievements.gamesSynced === achievements.gamesDue
        const result: FullSyncResult = {
            status: complete ? 'ok' : 'parcial',
            library,
            snapshotRows: snapshotRows ?? 0,
            wishlist,
            wishlistError,
            achievements,
            tracker,
        }
        await supabase
            .from('hubgames_sync_logs')
            .update({
                status: result.status,
                finished_at: new Date().toISOString(),
                stats: { library, snapshotRows: result.snapshotRows, wishlist, wishlistError, achievements, tracker } as unknown as Json,
            })
            .eq('id', logRow.id)
        return result
    } catch (e) {
        await supabase
            .from('hubgames_sync_logs')
            .update({ status: 'error', finished_at: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) })
            .eq('id', logRow.id)
        throw e
    }
}

// ─── Grupo familiar (#86) ────────────────────────────────────────────────────

export interface FamilySyncResult {
    /** Prestados disponibles ahora. */
    total: number
    added: number
    gone: number
    /** Volvieron tras haber salido del grupo. */
    back: number
    newToTray: number
    catalogPending: number
}

export interface FamilyGame {
    appid: number
    owners: string[]
    playtimeMinutes: number
    lastPlayed: number | null
}

/**
 * Guarda la lista de prestados del grupo familiar: altas y horas, los que ya no están (family_gone_at), los nuevos a la
 * Bandeja, fichas hasta el `deadline`, foto de horas y estados automáticos. Los juegos tuyos no se tocan.
 */
export async function syncFamilyLibrary(
    supabase: Client,
    userId: string,
    games: FamilyGame[],
    members: Record<string, string>,
    options: SteamSyncOptions = {},
): Promise<FamilySyncResult> {
    const stored = await selectAll<{ appid: number; source: string; family_gone_at: string | null }>((from, to) =>
        supabase.from('hubgames_user_steam_games').select('appid, source, family_gone_at').eq('user_id', userId).order('appid').range(from, to),
    )
    const byId = new Map(stored.map((r) => [r.appid, r]))
    const borrowed = games.filter((g) => byId.get(g.appid)?.source !== 'own')
    const now = new Date().toISOString()

    for (const part of chunks(borrowed, UPSERT_CHUNK)) {
        const { error } = await supabase.from('hubgames_user_steam_games').upsert(
            part.map((g) => ({
                user_id: userId,
                appid: g.appid,
                source: 'family',
                family_owner_steamids: g.owners,
                family_gone_at: null,
                playtime_forever: g.playtimeMinutes,
                rtime_last_played: g.lastPlayed ? new Date(g.lastPlayed * 1000).toISOString() : null,
            })),
            { onConflict: 'user_id,appid' },
        )
        if (error) throw new SteamSyncError(`No se pudieron guardar los juegos del grupo familiar: ${error.message}`)
    }

    const keep = new Set(borrowed.map((g) => g.appid))
    const gone = stored.filter((r) => r.source === 'family' && !r.family_gone_at && !keep.has(r.appid)).map((r) => r.appid)
    for (const part of chunks(gone, IN_CHUNK)) {
        const { error } = await supabase
            .from('hubgames_user_steam_games')
            .update({ family_gone_at: now })
            .eq('user_id', userId)
            .in('appid', part)
        if (error) throw new SteamSyncError(`No se pudieron marcar los que ya no están: ${error.message}`)
    }

    // Igual que los propios: los nuevos entran en la Bandeja; los que ya tienen estado se quedan como están.
    const { data: existing, error: existingError } = await supabase.from('hubgames_user_games').select('appid').eq('user_id', userId)
    if (existingError) throw new SteamSyncError(`No se pudieron leer tus juegos: ${existingError.message}`)
    const tracked = new Set(existing.map((r) => r.appid))
    const fresh = borrowed.filter((g) => !tracked.has(g.appid))
    for (const part of chunks(fresh, UPSERT_CHUNK)) {
        const { error } = await supabase
            .from('hubgames_user_games')
            .upsert(part.map((g) => ({ user_id: userId, appid: g.appid, status: 'bandeja', status_source: 'auto' })), {
                onConflict: 'user_id,appid',
                ignoreDuplicates: true,
            })
        if (error) throw new SteamSyncError(`No se pudo crear la bandeja: ${error.message}`)
    }

    const { pending } = await fillCatalog(supabase, borrowed.map((g) => ({ appid: g.appid })), options)

    // La primera vez que aparece un juego su foto es la base (no suma minutos); después, lo jugado se reparte por días.
    const { error: snapshotError } = await supabase.rpc('hubgames_take_playtime_snapshot', { p_user_id: userId })
    if (snapshotError) throw new SteamSyncError(`No se pudo guardar la foto de horas: ${snapshotError.message}`)
    await applyTrackerRules(supabase, userId)

    const { error: touchError } = await supabase
        .from('hubgames_user_steam')
        .update({ family_synced_at: now, family_members: members })
        .eq('user_id', userId)
    if (touchError) throw new SteamSyncError(`No se pudo marcar la actualización: ${touchError.message}`)

    return {
        total: borrowed.length,
        added: borrowed.filter((g) => !byId.has(g.appid)).length,
        gone: gone.length,
        back: borrowed.filter((g) => byId.get(g.appid)?.family_gone_at).length,
        newToTray: fresh.length,
        catalogPending: pending,
    }
}
