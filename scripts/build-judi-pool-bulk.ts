/**
 * build-judi-pool-bulk.ts
 *
 * Versión extendida de build-judi-pool.ts pensada para poblar el pool con ~3000 juegos elegibles.
 * Fuentes de IDs:
 *   - SteamSpy top100in2weeks, top100owned, top100forever
 *   - SteamSpy all?page=0..9 (hasta 10,000 IDs adicionales)
 *   - Steam featured categories
 *
 * El script termina cuando eligible >= TARGET_ELIGIBLE o se agotan los candidatos.
 * Usa upsert, por lo que puede interrumpirse y retomarse de forma segura.
 *
 * Tiempo estimado: 2-3 horas para procesar 5,000-6,000 candidatos.
 */

import {
    createServiceRoleClient,
    dateToIso,
    getAppIdsFromSteamFeaturedCategories,
    getSteamSpyDetails,
    getSteamStoreDetails,
    getCurrentPlayers,
    getTopAppIdsFromSteamSpy,
    ownersMidpoint,
    parseSteamDate,
    sleep,
    startOfWeekSunday,
    fetchJson,
} from './steam-utils'

const STEAMSPY_BASE_URL = 'https://steamspy.com/api.php'
const TARGET_ELIGIBLE = 200

type PoolCandidate = {
    appid: number
    name: string
    relevanceScore: number
    isEligible: boolean
    reviewsPass: boolean
    screenshotsPass: boolean
    scorePass: boolean
    metadataPass: boolean
    reasons: string[]
}

function computeEligibility(input: {
    appid: number
    name: string
    screenshots: number
    reviewCount: number
    positiveScore: number
    metadataComplete: boolean
    ccu: number
    ownersMid: number
    metacritic: number
}): PoolCandidate {
    const reasons: string[] = []
    const reviewsPass = input.reviewCount >= 300
    const screenshotsPass = input.screenshots >= 6
    const scorePass = input.positiveScore >= 65
    const metadataPass = input.metadataComplete

    if (!reviewsPass) reasons.push('reviews_below_300')
    if (!screenshotsPass) reasons.push('screenshots_below_6')
    if (!scorePass) reasons.push('positive_score_below_65')
    if (!metadataPass) reasons.push('metadata_incomplete')

    const relevanceScore =
        (input.ownersMid / 1_000_000) * 20 +
        input.ccu * 0.1 +
        input.positiveScore * 2 +
        input.metacritic * 1.5

    return {
        appid: input.appid,
        name: input.name,
        relevanceScore: Number(relevanceScore.toFixed(2)),
        isEligible: reviewsPass && screenshotsPass && scorePass && metadataPass,
        reviewsPass,
        screenshotsPass,
        scorePass,
        metadataPass,
        reasons,
    }
}

async function getSteamSpyAllPage(page: number): Promise<number[]> {
    try {
        const data = await fetchJson<Record<string, { appid?: number }>>(
            `${STEAMSPY_BASE_URL}?request=all&page=${page}`
        )
        return Object.values(data || {})
            .map((row) => row?.appid)
            .filter((id): id is number => typeof id === 'number' && id > 0)
    } catch (error) {
        console.warn(`[build-judi-pool-bulk] SteamSpy all page=${page} falló:`, error)
        return []
    }
}

async function collectAllCandidateIds(): Promise<number[]> {
    console.log('[build-judi-pool-bulk] Recolectando IDs de candidatos...')

    const [topListIds, featuredIds] = await Promise.all([
        getTopAppIdsFromSteamSpy(),
        getAppIdsFromSteamFeaturedCategories(),
    ])
    console.log(`[build-judi-pool-bulk]   top lists: ${topListIds.length} IDs`)
    console.log(`[build-judi-pool-bulk]   featured:  ${featuredIds.length} IDs`)

    const merged = new Set<number>([...topListIds, ...featuredIds])

    // SteamSpy all: páginas 0-9 (hasta 10,000 IDs adicionales)
    for (let page = 0; page <= 9; page++) {
        const pageIds = await getSteamSpyAllPage(page)
        for (const id of pageIds) merged.add(id)
        console.log(`[build-judi-pool-bulk]   all page=${page}: ${pageIds.length} IDs (total único: ${merged.size})`)
        // Pequeña pausa entre páginas para no saturar SteamSpy
        await sleep(500)
    }

    const result = Array.from(merged)
    console.log(`[build-judi-pool-bulk] Total de candidatos únicos: ${result.length}`)
    return result
}

async function main() {
    const supabase = createServiceRoleClient()
    const now = new Date()
    const weekStart = startOfWeekSunday(now)
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
    const weekStartIso = dateToIso(weekStart)
    const weekEndIso = dateToIso(weekEnd)

    console.log(`[build-judi-pool-bulk] Semana: ${weekStartIso} → ${weekEndIso}`)
    console.log(`[build-judi-pool-bulk] Objetivo: ${TARGET_ELIGIBLE} juegos elegibles`)

    const allIds = await collectAllCandidateIds()

    let processed = 0
    let eligible = 0
    let failed = 0
    let skipped = 0

    for (const appid of allIds) {
        if (eligible >= TARGET_ELIGIBLE) {
            console.log(`[build-judi-pool-bulk] Objetivo alcanzado: ${eligible} elegibles. Terminando.`)
            break
        }

        try {
            const [store, steamSpy, currentPlayers] = await Promise.all([
                getSteamStoreDetails(appid),
                getSteamSpyDetails(appid),
                getCurrentPlayers(appid),
            ])

            // SteamSpy recomienda 1 req/seg
            await sleep(1100)

            if (!store || !steamSpy || !store.name) {
                skipped++
                continue
            }

            const screenshots = (store.screenshots || []).length
            const positive = steamSpy.positive || 0
            const negative = steamSpy.negative || 0
            const reviewCount = positive + negative
            const positiveScore =
                steamSpy.userscore ||
                (reviewCount > 0 ? Math.round((positive / reviewCount) * 100) : 0)
            const ownersMid = ownersMidpoint(steamSpy.owners)
            const metacritic = store.metacritic?.score || 0
            const metadataComplete =
                Boolean(store.header_image) &&
                Boolean(store.release_date?.date) &&
                Boolean(store.developers?.length) &&
                Boolean(store.publishers?.length) &&
                Boolean(store.genres?.length)

            const candidate = computeEligibility({
                appid,
                name: store.name,
                screenshots,
                reviewCount,
                positiveScore,
                metadataComplete,
                ccu: currentPlayers ?? steamSpy.ccu ?? 0,
                ownersMid,
                metacritic,
            })

            const releaseDate = parseSteamDate(store.release_date?.date || '')

            const { error: catalogError } = await supabase
                .from('hubgames_juegos_steam')
                .upsert(
                    {
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
                        release_date: releaseDate,
                        coming_soon: store.release_date?.coming_soon ?? null,
                        metacritic_score: store.metacritic?.score ?? null,
                        metacritic_url: store.metacritic?.url ?? null,
                        categories: store.categories || [],
                        genres: store.genres || [],
                        screenshots: store.screenshots || [],
                        movies: store.movies || [],
                        price_overview: store.price_overview || null,
                        packages: store.packages || null,
                        platforms: store.platforms || {},
                        recommendations_total: store.recommendations?.total ?? null,
                        achievements_total: store.achievements?.total ?? null,
                        steamspy_score_rank: steamSpy.score_rank
                            ? Number(steamSpy.score_rank) || null
                            : null,
                        steamspy_positive: positive,
                        steamspy_negative: negative,
                        steamspy_userscore: positiveScore,
                        steamspy_owners: steamSpy.owners || null,
                        steamspy_average_forever: steamSpy.average_forever ?? null,
                        steamspy_average_2weeks: steamSpy.average_2weeks ?? null,
                        steamspy_median_forever: steamSpy.median_forever ?? null,
                        steamspy_median_2weeks: steamSpy.median_2weeks ?? null,
                        steamspy_ccu: currentPlayers ?? steamSpy.ccu ?? null,
                        steamspy_tags: steamSpy.tags || {},
                        steamspy_raw: steamSpy,
                        steam_web_raw: currentPlayers
                            ? { player_count: currentPlayers }
                            : null,
                        steam_store_raw: store,
                        source_priority: candidate.isEligible ? 1 : 0,
                        last_synced_at: new Date().toISOString(),
                    },
                    { onConflict: 'steam_appid' }
                )

            if (catalogError) {
                console.error(`[build-judi-pool-bulk] catalog upsert error appid=${appid}:`, catalogError.message)
                failed++
                continue
            }

            const { error: poolError } = await supabase
                .from('hubgames_judi_pool')
                .upsert(
                    {
                        week_start_date: weekStartIso,
                        week_end_date: weekEndIso,
                        steam_appid: appid,
                        game_name: store.name,
                        relevance_score: candidate.relevanceScore,
                        is_eligible: candidate.isEligible,
                        eligibility_reasons: candidate.reasons,
                        filter_reviews_min_pass: candidate.reviewsPass,
                        filter_screenshots_pass: candidate.screenshotsPass,
                        filter_positive_score_pass: candidate.scorePass,
                        filter_metadata_complete_pass: candidate.metadataPass,
                        discarded: false,
                        discarded_reason: null,
                        source_tag: 'steam_bulk',
                    },
                    { onConflict: 'week_start_date,steam_appid' }
                )

            if (poolError) {
                console.error(`[build-judi-pool-bulk] pool upsert error appid=${appid}:`, poolError.message)
                failed++
                continue
            }

            processed++
            if (candidate.isEligible) eligible++

            if (processed % 100 === 0) {
                console.log(
                    `[build-judi-pool-bulk] progreso: procesados=${processed} elegibles=${eligible}/${TARGET_ELIGIBLE} fallidos=${failed} saltados=${skipped}`
                )
            }
        } catch (error) {
            failed++
            console.error('[build-judi-pool-bulk] candidato falló', { appid, error })
        }
    }

    await supabase.from('hubgames_judi_generacion_logs').insert({
        exito: failed === 0,
        error_mensaje: failed > 0 ? `${failed} candidatos fallaron` : null,
        nombre_juego: `Bulk pool built: eligible=${eligible}/${processed}`,
        fecha_judi: weekStartIso,
        fuente: 'steam_bulk_pool',
    })

    console.log('[build-judi-pool-bulk] Completado', {
        weekStartIso,
        weekEndIso,
        processed,
        eligible,
        failed,
        skipped,
        targetReached: eligible >= TARGET_ELIGIBLE,
    })
}

main().catch((error) => {
    console.error('[build-judi-pool-bulk] Error fatal:', error)
    process.exit(1)
})
