import { createServiceRoleClient, dateToLegacyJudi, dateToIso } from './steam-utils'

type PoolRow = {
    id: number
    steam_appid: number
    game_name: string
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

async function insertDailyGameFromPool(poolRow: PoolRow) {
    const supabase = createServiceRoleClient()

    const { data: steamGame, error: steamGameError } = await supabase
        .from('hubgames_juegos_steam')
        .select('*')
        .eq('steam_appid', poolRow.steam_appid)
        .maybeSingle()

    if (steamGameError || !steamGame) {
        throw new Error(`Missing steam catalog entry for ${poolRow.steam_appid}`)
    }

    const today = new Date()
    const judiDate = dateToLegacyJudi(today)
    const isoDate = dateToIso(today)
    const popularity = steamGame.steamspy_userscore ? (Number(steamGame.steamspy_userscore) / 20).toFixed(1) : '0'

    const { data: insertedGame, error: insertError } = await supabase
        .from('hubgames_lista_videojuegos_judi')
        .insert({
            id_videojuego: poolRow.steam_appid,
            steam_appid: poolRow.steam_appid,
            data_source: 'steam_pool',
            nombre: steamGame.name,
            fecha: judiDate,
            calificacion: steamGame.metacritic_score || 0,
            desarrollador: popularity,
            released: steamGame.release_date || steamGame.release_date_text || '',
        })
        .select('id')
        .single()

    if (insertError) {
        throw new Error(insertError.message)
    }

    const platforms = mapPlatforms(steamGame.platforms)
    for (const platform of platforms) {
        await supabase.from('hubgames_plataformas').upsert({ plataforma: platform })
        await supabase.from('hubgames_videojuego_plataforma').upsert({
            id_videojuego: poolRow.steam_appid,
            plataforma: platform,
        })
    }

    const genres = mapGenres(steamGame.genres)
    for (const genre of genres) {
        await supabase.from('hubgames_generos').upsert({ genero: genre })
        await supabase.from('hubgames_videojuego_genero').upsert({
            id_videojuego: poolRow.steam_appid,
            genero: genre,
        })
    }

    const screenshots = (steamGame.screenshots || [])
        .slice(0, 7)
        .map((shot: { path_full?: string }) => shot.path_full)
        .filter((path: string | undefined): path is string => Boolean(path))
        .map((path: string) => ({
            id_videojuego: poolRow.steam_appid,
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
        .eq('id', poolRow.id)

    await supabase.from('hubgames_judi_generacion_logs').insert({
        exito: true,
        id_juego_steam: poolRow.steam_appid,
        nombre_juego: poolRow.game_name,
        fecha_judi: judiDate,
        fuente: 'steam_pool_daily_pick',
    })

    return insertedGame.id
}

async function main() {
    const supabase = createServiceRoleClient()
    const today = new Date()
    const judiDate = dateToLegacyJudi(today)

    const { data: existingDaily } = await supabase
        .from('hubgames_lista_videojuegos_judi')
        .select('id, nombre')
        .eq('fecha', judiDate)
        .maybeSingle()

    if (existingDaily) {
        console.log('[pick-judi-daily] already exists', existingDaily)
        return
    }

    const { data: candidates, error } = await supabase
        .from('hubgames_judi_pool')
        .select('id, steam_appid, game_name')
        .eq('is_eligible', true)
        .eq('selected_for_daily', false)
        .eq('discarded', false)
        .order('relevance_score', { ascending: false })
        .limit(25)

    if (error || !candidates || candidates.length === 0) {
        throw new Error('No eligible games found in hubgames_judi_pool')
    }

    for (const candidate of candidates as PoolRow[]) {
        try {
            const insertedId = await insertDailyGameFromPool(candidate)
            console.log('[pick-judi-daily] inserted', { candidate: candidate.steam_appid, insertedId })
            return
        } catch (insertError: any) {
            const message = insertError?.message || 'unknown_insert_error'

            // Si el appid ya fue usado antes en JUDI, se descarta del pool.
            if (message.includes('duplicate key value') || message.includes('unique')) {
                await supabase
                    .from('hubgames_judi_pool')
                    .update({
                        discarded: true,
                        discarded_reason: 'already_used_in_daily_history',
                    })
                    .eq('id', candidate.id)
                continue
            }

            throw insertError
        }
    }

    throw new Error('Could not insert a new daily game from pool after checking candidates')
}

main().catch((error) => {
    console.error('[pick-judi-daily] fatal error', error)
    process.exit(1)
})
