// Sincronización diaria con Steam de los usuarios vinculados (#14): biblioteca, foto de horas y logros.
// Cada usuario queda registrado en hubgames_sync_logs. Sale con código 1 si alguno falla, para que avise GitHub Actions.
// Uso: npm run steam:sync [-- --user <uuid>] [-- --source manual]
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/supabase/database.types'
import { runSteamSync } from '../src/lib/steam-sync'

function arg(name: string): string | null {
    const i = process.argv.indexOf(name)
    return i > -1 ? (process.argv[i + 1] ?? null) : null
}

async function main() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient<Database>(url, key, { auth: { persistSession: false } })

    const onlyUser = arg('--user')
    const source = arg('--source') === 'manual' ? 'manual' : 'cron'

    let query = supabase.from('hubgames_user_steam').select('user_id')
    if (onlyUser) query = query.eq('user_id', onlyUser)
    const { data: links, error } = await query
    if (error) throw new Error(`No se pudieron leer las vinculaciones: ${error.message}`)
    if (!links.length) {
        console.log('No hay usuarios con Steam vinculado.')
        return
    }

    let failed = 0
    for (const { user_id } of links) {
        console.log(`::group::Usuario ${user_id}`)
        try {
            const result = await runSteamSync(supabase, user_id, source, { log: (m) => console.log(m) })
            console.log('Resultado', JSON.stringify(result))
            if (result.status === 'parcial') console.log(`::warning::Usuario ${user_id}: sincronización parcial`)
        } catch (e) {
            failed++
            console.error(`::error::Usuario ${user_id}: ${e instanceof Error ? e.message : e}`)
        }
        console.log('::endgroup::')
    }
    if (failed) process.exit(1)
}

main().catch((e) => {
    console.error(`::error::${e instanceof Error ? e.message : e}`)
    process.exit(1)
})
