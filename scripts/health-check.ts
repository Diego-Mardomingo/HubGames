// Health check diario (#10): comprueba que los procesos automáticos siguen funcionando.
// - Existe el JUDI de mañana (lo elige judi-daily-pick a las 10:00 UTC).
// - La última sincronización con Steam que terminó bien tiene menos de 36 h.
// Sale con código 1 si algo falla, y el workflow abre un issue.
// Uso: npx tsx scripts/health-check.ts [--simular-fallo]
import { createServiceRoleClient, dateToLegacyJudi } from './steam-utils'

const MAX_SYNC_AGE_H = 36

type Check = { name: string; ok: boolean; detail: string }

async function main() {
    const supabase = createServiceRoleClient()
    const checks: Check[] = []

    const tomorrow = dateToLegacyJudi(new Date(Date.now() + 86400000))
    const { data: judi, error: judiError } = await supabase
        .from('hubgames_lista_videojuegos_judi')
        .select('id, nombre')
        .eq('fecha', tomorrow)
        .maybeSingle()
    checks.push(
        judiError
            ? { name: 'JUDI de mañana', ok: false, detail: `Error leyendo la tabla: ${judiError.message}` }
            : judi
                ? { name: 'JUDI de mañana', ok: true, detail: `${tomorrow}: #${judi.id}` }
                : { name: 'JUDI de mañana', ok: false, detail: `No existe el JUDI del ${tomorrow}` },
    )

    const { count: linked, error: linkedError } = await supabase
        .from('hubgames_user_steam')
        .select('user_id', { count: 'exact', head: true })
    const { data: lastSync, error: syncError } = await supabase
        .from('hubgames_sync_logs')
        .select('finished_at, status')
        .in('status', ['ok', 'parcial'])
        .not('finished_at', 'is', null)
        .order('finished_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    if (linkedError || syncError) {
        checks.push({ name: 'Sincronización con Steam', ok: false, detail: `Error leyendo: ${(linkedError ?? syncError)!.message}` })
    } else if (!linked) {
        checks.push({ name: 'Sincronización con Steam', ok: true, detail: 'No hay usuarios con Steam vinculado' })
    } else if (!lastSync?.finished_at) {
        checks.push({ name: 'Sincronización con Steam', ok: false, detail: 'Nunca ha terminado bien' })
    } else {
        const ageH = (Date.now() - new Date(lastSync.finished_at).getTime()) / 3600000
        checks.push({
            name: 'Sincronización con Steam',
            ok: ageH < MAX_SYNC_AGE_H,
            detail: `Última correcta hace ${ageH.toFixed(1)} h (${lastSync.status}); máximo ${MAX_SYNC_AGE_H} h`,
        })
    }

    if (process.argv.includes('--simular-fallo')) {
        checks.push({ name: 'Fallo simulado', ok: false, detail: 'Ejecutado con --simular-fallo para probar los avisos' })
    }

    for (const c of checks) {
        console.log(`${c.ok ? '✅' : '❌'} ${c.name}: ${c.detail}`)
        if (!c.ok) console.log(`::error::${c.name}: ${c.detail}`)
    }
    if (checks.some((c) => !c.ok)) process.exit(1)
}

main().catch((e) => {
    console.error(`::error::${e instanceof Error ? e.message : e}`)
    process.exit(1)
})
