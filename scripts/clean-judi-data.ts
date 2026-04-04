import { createServiceRoleClient } from './steam-utils'

async function deleteAll(supabase: ReturnType<typeof createServiceRoleClient>, table: string) {
    const { error, count } = await supabase
        .from(table)
        .delete({ count: 'exact' })
        .gte('id', 0)

    if (error) {
        const { error: error2, count: count2 } = await supabase
            .from(table)
            .delete({ count: 'exact' })
            .neq('steam_appid', -1)

        if (!error2) {
            console.log(`[clean-judi-data] ${table}: ${count2 ?? '?'} filas eliminadas`)
            return count2 ?? 0
        }

        // PK compuesta (id_lista_judi, …) en hubgames_judi_fases_usuario
        const { error: error3, count: count3 } = await supabase
            .from(table)
            .delete({ count: 'exact' })
            .gte('id_lista_judi', 0)

        if (!error3) {
            console.log(`[clean-judi-data] ${table}: ${count3 ?? '?'} filas eliminadas`)
            return count3 ?? 0
        }

        // Relaciones por id_videojuego (capturas, plataforma, género)
        const { error: error4, count: count4 } = await supabase
            .from(table)
            .delete({ count: 'exact' })
            .neq('id_videojuego', -1)

        if (!error4) {
            console.log(`[clean-judi-data] ${table}: ${count4 ?? '?'} filas eliminadas`)
            return count4 ?? 0
        }

        console.error(`[clean-judi-data] ERROR borrando ${table}:`, error4.message)
        return 0
    }

    console.log(`[clean-judi-data] ${table}: ${count ?? '?'} filas eliminadas`)
    return count ?? 0
}

async function main() {
    const supabase = createServiceRoleClient()

    console.log('[clean-judi-data] Iniciando limpieza completa de JUDI...')
    console.log('[clean-judi-data] ADVERTENCIA: Esta operación es irreversible.')

    // Orden respetando dependencias FK (hijos primero, padres al final)
    const tables = [
        'hubgames_judi_intentos',        // intentos/guesses de usuarios
        'hubgames_judi_fases_usuario',   // progreso de usuarios
        'hubgames_lista_videojuegos_judi', // juegos diarios
        'hubgames_capturas',             // capturas de juegos
        'hubgames_videojuego_plataforma', // relación juego-plataforma
        'hubgames_videojuego_genero',    // relación juego-género
        'hubgames_judi_pool',            // pool de candidatos
        'hubgames_juegos_steam',         // catálogo de Steam
        'hubgames_judi_generacion_logs', // logs
    ]

    let totalDeleted = 0
    for (const table of tables) {
        const deleted = await deleteAll(supabase, table)
        totalDeleted += deleted
    }

    console.log(`[clean-judi-data] Limpieza completa. Total de filas eliminadas: ${totalDeleted}`)
}

main().catch((error) => {
    console.error('[clean-judi-data] Error fatal:', error)
    process.exit(1)
})
