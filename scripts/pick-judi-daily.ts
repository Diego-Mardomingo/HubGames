import { createServiceRoleClient, dateToLegacyJudi, dateToIsoMadrid } from './steam-utils'

type PickResult = {
    status: 'inserted' | 'exists'
    id: number
    nombre: string
    steam_appid: number | null
    fecha: string
    capturas?: number
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

async function recordFailureLog(
    supabase: ReturnType<typeof createServiceRoleClient>,
    fechaJudi: string,
    errorMessage: string
) {
    const { error } = await supabase.from('hubgames_judi_generacion_logs').insert({
        exito: false,
        nombre_juego: 'Fallo en la elección del juego del día',
        fecha_judi: fechaJudi,
        fuente: 'steam_pool_daily_pick',
        error_mensaje: errorMessage,
    })
    if (error) {
        log('error', 'No se pudo escribir hubgames_judi_generacion_logs', { message: error.message })
    }
}

async function main() {
    console.log('::group::pick-judi-daily — inicio')
    log('info', 'Script iniciado', { utc: new Date().toISOString() })

    const supabase = createServiceRoleClient()

    // El juego se genera a las 11:00 hora española para el día SIGUIENTE (00:00 Madrid)
    const tomorrow = new Date(Date.now() + 86400000)
    const judiDate = dateToLegacyJudi(tomorrow)
    const isoDate = dateToIsoMadrid(tomorrow)
    log('info', 'Fecha objetivo (mañana Madrid)', { judiDate, isoDate })

    // Una sola transacción en la base de datos: juego, plataformas, géneros, capturas, pool y log.
    // Si algo falla no queda nada a medias, y repetir la ejecución es seguro.
    const { data, error } = await supabase.rpc('hubgames_judi_pick_daily', { p_fecha: isoDate })

    if (error) {
        log('error', `hubgames_judi_pick_daily falló: ${error.message}`, { code: error.code })
        await recordFailureLog(supabase, judiDate, error.message)
        console.log('::endgroup::')
        throw new Error(error.message)
    }

    const result = data as PickResult | null
    if (!result) {
        const msg = 'hubgames_judi_pick_daily no devolvió resultado'
        log('error', msg)
        await recordFailureLog(supabase, judiDate, msg)
        console.log('::endgroup::')
        throw new Error(msg)
    }

    if (result.status === 'exists') {
        log('ok', 'Ya existe juego para esta fecha, nada que hacer', result)
    } else {
        log('ok', 'Juego del día insertado con éxito', result)
    }
    console.log('::endgroup::')
}

main().catch((error) => {
    console.error('[pick-judi-daily] fatal error', error)
    console.log('::endgroup::')
    process.exit(1)
})
