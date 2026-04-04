import {
    createServiceRoleClient,
    dateToIso,
    getCurrentPlayers,
    getAppIdsFromSteamFeaturedCategories,
    getSteamSpyDetails,
    getSteamStoreDetails,
    getTopAppIdsFromSteamSpy,
    ownersMidpoint,
    parseSteamDate,
    sleep,
    startOfWeekSunday,
} from './steam-utils'

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

function log(level: 'info' | 'ok' | 'warn' | 'error', msg: string, data?: unknown) {
    const ts = new Date().toISOString()
    const prefix = { info: '[STEP]', ok: '[OK]', warn: '[WARN]', error: '[ERROR]' }[level]
    const line = data !== undefined ? `${prefix} ${msg} ${JSON.stringify(data)}` : `${prefix} ${msg}`
    console.log(`${ts}  ${line}`)
    if (level === 'error') {
        console.error(`::error::${msg}`)
    }
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
        (input.ownersMid / 1000000) * 20 +
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

async function main() {
    console.log('::group::build-judi-pool — inicio')
    log('info', 'Script iniciado', { utc: new Date().toISOString() })

    const supabase = createServiceRoleClient()
    const now = new Date()
    const weekStart = startOfWeekSunday(now)
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
    const weekStartIso = dateToIso(weekStart)
    const weekEndIso = dateToIso(weekEnd)

    log('info', 'Semana objetivo', { weekStartIso, weekEndIso })

    console.log('::group::Obteniendo IDs de Steam')
    const [steamStoreIds, steamSpyIds] = await Promise.all([
        getAppIdsFromSteamFeaturedCategories(),
        getTopAppIdsFromSteamSpy(),
    ])
    const mergedIds = [...new Set([...steamStoreIds, ...steamSpyIds])]
    const limitedIds = mergedIds.slice(0, 160)
    log('info', 'App IDs obtenidos', {
        steamStoreFeatured: steamStoreIds.length,
        steamSpyTops: steamSpyIds.length,
        mergedUnique: mergedIds.length,
        willProcess: limitedIds.length,
    })
    console.log('::endgroup::')

    let processed = 0
    let eligible = 0
    let ineligible = 0
    let failed = 0

    console.log('::group::Procesando candidatos')
    for (const appid of limitedIds) {
        const idx = limitedIds.indexOf(appid) + 1
        try {
            log('info', `[${idx}/${limitedIds.length}] Procesando appid`, { appid })

            const [store, steamSpy, currentPlayers] = await Promise.all([
                getSteamStoreDetails(appid),
                getSteamSpyDetails(appid),
                getCurrentPlayers(appid),
            ])

            // SteamSpy recomienda no abusar: 1 req/seg para la mayoría de requests.
            await sleep(1100)

            if (!store || !steamSpy || !store.name) {
                failed++
                log('warn', `[${idx}/${limitedIds.length}] Sin datos suficientes, omitiendo`, { appid })
                continue
            }

            const screenshots = (store.screenshots || []).length
            const positive = steamSpy.positive || 0
            const negative = steamSpy.negative || 0
            const reviewCount = positive + negative
            const positiveScore = steamSpy.userscore || (reviewCount > 0 ? Math.round((positive / reviewCount) * 100) : 0)
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

            log(
                candidate.isEligible ? 'ok' : 'warn',
                `[${idx}/${limitedIds.length}] ${store.name}`,
                {
                    appid,
                    eligible: candidate.isEligible,
                    relevanceScore: candidate.relevanceScore,
                    reviewCount,
                    positiveScore,
                    screenshots,
                    metacritic,
                    reasons: candidate.reasons.length > 0 ? candidate.reasons : undefined,
                }
            )

            const releaseDate = parseSteamDate(store.release_date?.date || '')

            const { error: catalogError } = await supabase
                .from('hubgames_juegos_steam')
                .upsert({
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
                    steamspy_score_rank: steamSpy.score_rank ? Number(steamSpy.score_rank) || null : null,
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
                    steam_web_raw: currentPlayers ? { player_count: currentPlayers } : null,
                    steam_store_raw: store,
                    source_priority: candidate.isEligible ? 1 : 0,
                    last_synced_at: new Date().toISOString(),
                }, {
                    onConflict: 'steam_appid',
                })

            if (catalogError) {
                failed++
                log('error', `[${idx}/${limitedIds.length}] Error al insertar en catálogo`, { appid, error: catalogError.message })
                continue
            }

            const { error: poolError } = await supabase
                .from('hubgames_judi_pool')
                .upsert({
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
                    source_tag: 'steam_store_and_steamspy',
                }, {
                    onConflict: 'week_start_date,steam_appid',
                })

            if (poolError) {
                failed++
                log('error', `[${idx}/${limitedIds.length}] Error al insertar en pool`, { appid, error: poolError.message })
                continue
            }

            processed++
            if (candidate.isEligible) eligible++
            else ineligible++
        } catch (error) {
            failed++
            log('error', `[${idx}/${limitedIds.length}] Excepción procesando candidato`, { appid, error: String(error) })
        }
    }
    console.log('::endgroup::')

    console.log('::group::Resumen final')
    log('ok', 'Pool semanal construida', {
        weekStartIso,
        weekEndIso,
        total: limitedIds.length,
        processed,
        eligible,
        ineligible,
        failed,
    })
    console.log('::endgroup::')

    await supabase.from('hubgames_judi_generacion_logs').insert({
        exito: failed === 0,
        error_mensaje: failed > 0 ? `${failed} candidatos fallaron` : null,
        nombre_juego: `Pool semanal: eligible=${eligible}/${processed} (${failed} fallos)`,
        fecha_judi: weekStartIso,
        fuente: 'steam_weekly_pool',
    })

    console.log('::endgroup::')
}

main().catch((error) => {
    console.error('[build-judi-pool] fatal error', error)
    console.log('::endgroup::')
    process.exit(1)
})
