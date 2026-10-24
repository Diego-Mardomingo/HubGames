// Sincroniza la biblioteca de Steam de los usuarios vinculados (#12).
// Uso: npm run steam:sync-library [-- --user <uuid>]
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/supabase/database.types'
import { syncSteamLibrary } from '../src/lib/steam-sync'

async function main() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient<Database>(url, key, { auth: { persistSession: false } })

    const userArg = process.argv.indexOf('--user')
    const onlyUser = userArg > -1 ? process.argv[userArg + 1] : null

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
            const result = await syncSteamLibrary(supabase, user_id, { log: (m) => console.log(m) })
            console.log('Resultado', JSON.stringify(result))
            if (result.catalogPending > 0) console.log(`::warning::Quedan ${result.catalogPending} fichas por traer`)
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
