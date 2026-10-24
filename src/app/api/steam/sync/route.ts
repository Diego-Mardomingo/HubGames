import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runSteamSync } from '@/lib/steam-sync'

// Vercel Hobby corta las funciones a los 60 s: se deja margen y lo que no dé tiempo se completa en la siguiente.
export const maxDuration = 60
const BUDGET_MS = 45_000
const COOLDOWN_MS = 5 * 60_000

/** "Sincronizar ahora": sincronización incremental del usuario, como mucho una vez cada 5 minutos. */
export async function POST() {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const admin = createAdminClient()
    const { data: last } = await admin
        .from('hubgames_sync_logs')
        .select('started_at')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    const wait = last ? Date.parse(last.started_at) + COOLDOWN_MS - Date.now() : 0
    if (wait > 0) {
        return NextResponse.json(
            { error: 'Espera un poco antes de volver a sincronizar', retryAfter: Math.ceil(wait / 1000) },
            { status: 429, headers: { 'Retry-After': String(Math.ceil(wait / 1000)) } },
        )
    }

    try {
        const result = await runSteamSync(admin, user.id, 'manual', { deadline: Date.now() + BUDGET_MS })
        return NextResponse.json(result)
    } catch (e) {
        console.error('steam/sync', e)
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al sincronizar' }, { status: 500 })
    }
}
