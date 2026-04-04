/**
 * Elimina entradas diarias de JUDI por fechas legacy (DD-MM-YYYY).
 * Borra intentos, fases usuario, restaura filas del pool y elimina logs asociados.
 *
 * Uso:
 *   tsx --env-file=.env.local scripts/delete-judi-daily-by-fechas.ts 06-12-2025 13-12-2025
 */

import { createServiceRoleClient } from './steam-utils'

async function main() {
    const fechas = process.argv.slice(2).map((f) => f.trim())
    if (fechas.length === 0) {
        console.error('[delete-judi] Uso: tsx scripts/delete-judi-daily-by-fechas.ts DD-MM-YYYY [...]')
        process.exit(1)
    }

    const supabase = createServiceRoleClient()

    const { data: rows, error: selErr } = await supabase
        .from('hubgames_lista_videojuegos_judi')
        .select('id, id_videojuego, fecha, nombre')
        .in('fecha', fechas)

    if (selErr) throw selErr
    if (!rows?.length) {
        console.log('[delete-judi] No hay filas para las fechas indicadas.')
        return
    }

    const ids = rows.map((r) => r.id)
    console.log('[delete-judi] Eliminando', rows.length, 'partida(s):')
    for (const r of rows) {
        console.log(`  id=${r.id} fecha=${r.fecha} "${r.nombre}"`)
    }

    const { error: e1 } = await supabase.from('hubgames_judi_intentos').delete().in('id_lista_judi', ids)
    if (e1) throw e1

    const { error: e2 } = await supabase.from('hubgames_judi_fases_usuario').delete().in('id_lista_judi', ids)
    if (e2) throw e2

    const { error: e3 } = await supabase
        .from('hubgames_judi_pool')
        .update({
            selected_for_daily: false,
            selected_daily_date: null,
            selected_daily_list_id: null,
        })
        .in('selected_daily_list_id', ids)
    if (e3) throw e3

    const { error: e4 } = await supabase.from('hubgames_judi_generacion_logs').delete().in('fecha_judi', fechas)
    if (e4) throw e4

    const { error: e5 } = await supabase.from('hubgames_lista_videojuegos_judi').delete().in('id', ids)
    if (e5) throw e5

    console.log('[delete-judi] Completado.')
}

main().catch((err) => {
    console.error('[delete-judi] Error:', err)
    process.exit(1)
})
