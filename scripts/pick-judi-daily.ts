import { createServiceRoleClient, dateToLegacyJudi, dateToIsoMadrid } from './steam-utils'

type PoolRow = {
    id: number
    steam_appid: number
    game_name: string
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

function shuffleArrayInPlace<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[items[i], items[j]] = [items[j], items[i]]
    }
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

async function recordGeneracionLog(
    supabase: ReturnType<typeof createServiceRoleClient>,
    row: {
        exito: boolean
        nombre_juego: string
        fecha_judi: string
        id_juego_steam?: number | null
        error_mensaje?: string | null
    }
) {
    const { error } = await supabase.from('hubgames_judi_generacion_logs').insert({
        exito: row.exito,
        nombre_juego: row.nombre_juego,
        fecha_judi: row.fecha_judi,
        fuente: 'steam_pool_daily_pick',
        id_juego_steam: row.id_juego_steam ?? null,
        error_mensaje: row.error_mensaje ?? null,
    })
    if (error) {
        log('warn', 'No se pudo escribir hubgames_judi_generacion_logs', { message: error.message })
    }
}

async function insertDailyGameFromPool(poolRow: PoolRow, targetDate: Date) {
    const supabase = createServiceRoleClient()

    log('info', 'Buscando entrada en catálogo Steam', { steam_appid: poolRow.steam_appid })
    const { data: steamGame, error: steamGameError } = await supabase
        .from('hubgames_juegos_steam')
        .select('*')
        .eq('steam_appid', poolRow.steam_appid)
        .maybeSingle()

    if (steamGameError || !steamGame) {
        throw new Error(`Missing steam catalog entry for ${poolRow.steam_appid}: ${steamGameError?.message ?? 'not found'}`)
    }

    const judiDate = dateToLegacyJudi(targetDate)
    const isoDate = dateToIsoMadrid(targetDate)
    const popularity = steamGame.steamspy_userscore ? (Number(steamGame.steamspy_userscore) / 20).toFixed(1) : '0'

    log('info', 'Insertando juego en lista JUDI', { judiDate, isoDate, nombre: steamGame.name })

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

    log('info', 'Insertando plataformas')
    const platforms = mapPlatforms(steamGame.platforms)
    for (const platform of platforms) {
        await supabase.from('hubgames_plataformas').upsert({ plataforma: platform })
        await supabase.from('hubgames_videojuego_plataforma').upsert({
            id_videojuego: poolRow.steam_appid,
            plataforma: platform,
        })
    }
    log('ok', 'Plataformas insertadas', { platforms })

    log('info', 'Insertando géneros')
    const genres = mapGenres(steamGame.genres)
    for (const genre of genres) {
        await supabase.from('hubgames_generos').upsert({ genero: genre })
        await supabase.from('hubgames_videojuego_genero').upsert({
            id_videojuego: poolRow.steam_appid,
            genero: genre,
        })
    }
    log('ok', 'Géneros insertados', { genres })

    log('info', 'Insertando capturas')
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
    log('ok', 'Capturas insertadas', { count: screenshots.length })

    log('info', 'Actualizando pool: marcando como seleccionado')
    await supabase
        .from('hubgames_judi_pool')
        .update({
            selected_for_daily: true,
            selected_daily_date: isoDate,
            selected_daily_list_id: insertedGame.id,
        })
        .eq('id', poolRow.id)

    log('info', 'Registrando log de éxito en BD')
    await recordGeneracionLog(supabase, {
        exito: true,
        id_juego_steam: poolRow.steam_appid,
        nombre_juego: `Juego del día asignado: ${poolRow.game_name} (Steam ${poolRow.steam_appid})`,
        fecha_judi: judiDate,
    })

    return insertedGame.id
}

async function main() {
    console.log('::group::pick-judi-daily — inicio')
    log('info', 'Script iniciado', { utc: new Date().toISOString() })

    const supabase = createServiceRoleClient()

    // El juego se genera a las 11:00 hora española para el día SIGUIENTE (00:00 Madrid)
    const tomorrow = new Date(Date.now() + 86400000)
    const judiDate = dateToLegacyJudi(tomorrow)

    log('info', 'Fecha objetivo (mañana Madrid)', { judiDate, tomorrow: tomorrow.toISOString() })

    log('info', 'Verificando si ya existe juego para esa fecha')
    const { data: existingDaily } = await supabase
        .from('hubgames_lista_videojuegos_judi')
        .select('id, nombre, steam_appid')
        .eq('fecha', judiDate)
        .maybeSingle()

    if (existingDaily) {
        log('ok', 'Ya existe juego para esta fecha, nada que hacer', existingDaily)
        await recordGeneracionLog(supabase, {
            exito: true,
            nombre_juego: `Sin cambios: ya había juego para ${judiDate} — ${existingDaily.nombre}`,
            fecha_judi: judiDate,
            id_juego_steam:
                typeof existingDaily.steam_appid === 'number' ? existingDaily.steam_appid : null,
        })
        console.log('::endgroup::')
        return
    }

    log('info', 'No existe juego para mañana — buscando candidatos elegibles en el pool')

    const { data: candidates, error } = await supabase
        .from('hubgames_judi_pool')
        .select('id, steam_appid, game_name')
        .eq('is_eligible', true)
        .eq('selected_for_daily', false)
        .eq('discarded', false)
        .order('relevance_score', { ascending: false })
        .limit(25)

    if (error || !candidates || candidates.length === 0) {
        const msg = 'No eligible games found in hubgames_judi_pool'
        log('error', msg, { error })
        await recordGeneracionLog(supabase, {
            exito: false,
            nombre_juego: 'Sin candidatos elegibles en el pool',
            fecha_judi: judiDate,
            error_mensaje: msg,
        })
        console.log('::endgroup::')
        throw new Error(msg)
    }

    const pool = [...candidates] as PoolRow[]
    shuffleArrayInPlace(pool)
    log('info', 'Candidatos encontrados', {
        count: pool.length,
        orden: 'aleatorio_entre_top_25',
        primerIntento: pool[0]?.game_name,
        primerSteamAppid: pool[0]?.steam_appid,
    })

    for (const candidate of pool) {
        log('info', 'Intentando candidato', { steam_appid: candidate.steam_appid, game_name: candidate.game_name })
        try {
            const insertedId = await insertDailyGameFromPool(candidate, tomorrow)
            log('ok', 'Juego del día insertado con éxito', {
                steam_appid: candidate.steam_appid,
                game_name: candidate.game_name,
                insertedId,
                fechaJudi: judiDate,
            })
            console.log('::endgroup::')
            return
        } catch (insertError: any) {
            const message = insertError?.message || 'unknown_insert_error'

            if (message.includes('duplicate key value') || message.includes('unique')) {
                log('warn', 'Candidato descartado: ya usado anteriormente en JUDI', {
                    steam_appid: candidate.steam_appid,
                    game_name: candidate.game_name,
                })
                await supabase
                    .from('hubgames_judi_pool')
                    .update({
                        discarded: true,
                        discarded_reason: 'already_used_in_daily_history',
                    })
                    .eq('id', candidate.id)
                continue
            }

            log('error', `Candidato falló con error inesperado: ${message}`, {
                steam_appid: candidate.steam_appid,
            })
            await recordGeneracionLog(supabase, {
                exito: false,
                nombre_juego: `Fallo con candidato: ${candidate.game_name}`,
                fecha_judi: judiDate,
                id_juego_steam: candidate.steam_appid,
                error_mensaje: message,
            })
            throw insertError
        }
    }

    const exhaustedMsg = 'Could not insert a new daily game from pool after checking all candidates'
    log('error', exhaustedMsg)
    await recordGeneracionLog(supabase, {
        exito: false,
        nombre_juego: 'Agotados todos los candidatos del pool sin insertar',
        fecha_judi: judiDate,
        error_mensaje: exhaustedMsg,
    })
    console.log('::endgroup::')
    throw new Error(exhaustedMsg)
}

main().catch((error) => {
    console.error('[pick-judi-daily] fatal error', error)
    console.log('::endgroup::')
    process.exit(1)
})
