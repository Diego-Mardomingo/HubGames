// Carga de datos de las estadísticas (#32, #33) en el servidor, con la sesión del usuario (RLS: solo lo suyo).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { LibraryGame } from '@/lib/tracker'
import type { StatsInput, StatsUnlock } from '@/lib/stats'

type Client = SupabaseClient<Database>

async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
    const out: T[] = []
    for (let from = 0; ; from += 1000) {
        const { data, error } = await page(from, from + 999)
        if (error) throw new Error(error.message)
        out.push(...(data ?? []))
        if (!data || data.length < 1000) return out
    }
}

export async function loadStatsInput(supabase: Client, userId: string): Promise<StatsInput> {
    const [games, unlocks, daily, first] = await Promise.all([
        all((from, to) => supabase.from('hubgames_library').select('*').eq('user_id', userId).eq('owned', true).order('appid').range(from, to)),
        all((from, to) =>
            supabase
                .from('hubgames_achievements')
                .select('appid, apiname, unlocktime, global_percent, display_name, icon')
                .eq('user_id', userId)
                .eq('achieved', true)
                .not('unlocktime', 'is', null)
                .order('unlocktime')
                .order('appid')
                .order('apiname')
                .range(from, to),
        ),
        all((from, to) =>
            supabase.from('hubgames_playtime_daily').select('appid, date, minutes').eq('user_id', userId).order('date').order('appid').range(from, to),
        ),
        supabase.from('hubgames_playtime_snapshots').select('date').eq('user_id', userId).order('date').limit(1).maybeSingle(),
    ])

    return {
        games: games as LibraryGame[],
        unlocks: unlocks
            .filter((u) => u.appid !== null && u.unlocktime !== null)
            .map((u) => ({
                appid: u.appid!,
                unlocktime: u.unlocktime!,
                global_percent: u.global_percent === null ? null : Number(u.global_percent),
                display_name: u.display_name,
                icon: u.icon,
            })) satisfies StatsUnlock[],
        daily: daily.flatMap((d) => (d.appid !== null && d.date && d.minutes !== null ? [{ appid: d.appid, date: d.date, minutes: d.minutes }] : [])),
        historyStart: first.data?.date ?? null,
    }
}
