/**
 * backfill-judi-dates.ts
 *
 * Genera el juego diario de JUDI para fechas específicas pasadas como argumentos.
 * Útil para rellenar días que no tuvieron juego asignado.
 *
 * Uso:
 *   tsx scripts/backfill-judi-dates.ts 2026-04-01 2026-04-02 2026-04-03 2026-04-04
 *
 * Las fechas deben estar en formato ISO (YYYY-MM-DD).
 */

import { createServiceRoleClient } from './steam-utils'

type PoolRow = {
    id: number
    steam_appid: number
    game_name: string
}

function isoToLegacyDate(isoDate: string): string {
    // Convierte YYYY-MM-DD → DD-MM-YYYY (formato legacy de la columna `fecha`)
    const [year, month, day] = isoDate.split('-')
    return `${day}-${month}-${year}`
}

function mapPlatforms(platforms: Record<string, boolean> | null | undefined): string[] {
    if (!platforms) return []
    const output: string[] = []
    if (platforms.windows) output.push('PC (Windows)')
    if (platforms.mac) output.push('Mac')
    if (platforms.linux) output.push('Linux')
    return output
}

function mapGenres(genres: Array<{ description?: string }> | null | undefined): string[] {
    return (genres || [])
        .map((genre) => genre?.description?.trim())
        .filter((genre): genre is string => Boolean(genre))
}

async function insertDailyGameForDate(isoDate: string) {
    const supabase = createServiceRoleClient()
    const legacyDate = isoToLegacyDate(isoDate)

    const { data: existingDaily } = await supabase
        .from('hubgames_lista_videojuegos_judi')
        .select('id, nombre')
        .eq('fecha', legacyDate)
        .maybeSingle()

    if (existingDaily) {
        console.log(`[backfill] ${isoDate} (${legacyDate}): ya existe → "${existingDaily.nombre}"`)
        return
    }

    const { data: candidates, error } = await supabase
        .from('hubgames_judi_pool')
        .select('id, steam_appid, game_name')
        .eq('is_eligible', true)
        .eq('selected_for_daily', false)
        .eq('discarded', false)
        .order('relevance_score', { ascending: false })
        .limit(50)

    if (error || !candidates || candidates.length === 0) {
        throw new Error(`[backfill] ${isoDate}: No hay juegos elegibles en el pool`)
    }

    for (const candidate of candidates as PoolRow[]) {
        const { data: steamGame, error: steamGameError } = await supabase
            .from('hubgames_juegos_steam')
            .select('*')
            .eq('steam_appid', candidate.steam_appid)
            .maybeSingle()

        if (steamGameError || !steamGame) {
            console.warn(`[backfill] ${isoDate}: sin entrada Steam para appid=${candidate.steam_appid}, saltando`)
            continue
        }

        const popularity = steamGame.steamspy_userscore
            ? (Number(steamGame.steamspy_userscore) / 20).toFixed(1)
            : '0'

        const { data: insertedGame, error: insertError } = await supabase
            .from('hubgames_lista_videojuegos_judi')
            .insert({
                id_videojuego: candidate.steam_appid,
                steam_appid: candidate.steam_appid,
                data_source: 'steam_pool',
                nombre: steamGame.name,
                fecha: legacyDate,
                calificacion: steamGame.metacritic_score || 0,
                desarrollador: popularity,
                released: steamGame.release_date || steamGame.release_date_text || '',
            })
            .select('id')
            .single()

        if (insertError) {
            if (
                insertError.message?.includes('duplicate key value') ||
                insertError.message?.includes('unique')
            ) {
                await supabase
                    .from('hubgames_judi_pool')
                    .update({ discarded: true, discarded_reason: 'already_used_in_daily_history' })
                    .eq('id', candidate.id)
                continue
            }
            throw new Error(`[backfill] ${isoDate}: insert error → ${insertError.message}`)
        }

        const platforms = mapPlatforms(steamGame.platforms)
        for (const platform of platforms) {
            await supabase.from('hubgames_plataformas').upsert({ plataforma: platform })
            await supabase.from('hubgames_videojuego_plataforma').upsert({
                id_videojuego: candidate.steam_appid,
                plataforma: platform,
            })
        }

        const genres = mapGenres(steamGame.genres)
        for (const genre of genres) {
            await supabase.from('hubgames_generos').upsert({ genero: genre })
            await supabase.from('hubgames_videojuego_genero').upsert({
                id_videojuego: candidate.steam_appid,
                genero: genre,
            })
        }

        const screenshots = (steamGame.screenshots || [])
            .slice(0, 7)
            .map((shot: { path_full?: string }) => shot.path_full)
            .filter((path: string | undefined): path is string => Boolean(path))
            .map((path: string) => ({
                id_videojuego: candidate.steam_appid,
                captura: path,
            }))

        if (screenshots.length > 0) {
            await supabase.from('hubgames_capturas').upsert(screenshots)
        }

        await supabase
            .from('hubgames_judi_pool')
            .update({
                selected_for_daily: true,
                selected_daily_date: isoDate,
                selected_daily_list_id: insertedGame.id,
            })
            .eq('id', candidate.id)

        await supabase.from('hubgames_judi_generacion_logs').insert({
            exito: true,
            id_juego_steam: candidate.steam_appid,
            nombre_juego: candidate.game_name,
            fecha_judi: legacyDate,
            fuente: 'steam_pool_backfill',
        })

        console.log(
            `[backfill] ${isoDate} (${legacyDate}): insertado → "${candidate.game_name}" (appid=${candidate.steam_appid})`
        )
        return
    }

    throw new Error(`[backfill] ${isoDate}: ningún candidato pudo insertarse`)
}

async function main() {
    const dates = process.argv.slice(2)

    if (dates.length === 0) {
        console.error('[backfill] Uso: tsx scripts/backfill-judi-dates.ts YYYY-MM-DD [YYYY-MM-DD ...]')
        console.error('[backfill] Ejemplo: tsx scripts/backfill-judi-dates.ts 2026-04-01 2026-04-02 2026-04-03 2026-04-04')
        process.exit(1)
    }

    // Validar formato de fechas
    const isoPattern = /^\d{4}-\d{2}-\d{2}$/
    for (const date of dates) {
        if (!isoPattern.test(date)) {
            console.error(`[backfill] Fecha inválida: "${date}". Usa formato YYYY-MM-DD`)
            process.exit(1)
        }
    }

    console.log(`[backfill] Procesando ${dates.length} fecha(s): ${dates.join(', ')}`)

    for (const date of dates) {
        await insertDailyGameForDate(date)
    }

    console.log('[backfill] Completado.')
}

main().catch((error) => {
    console.error('[backfill] Error fatal:', error)
    process.exit(1)
})
