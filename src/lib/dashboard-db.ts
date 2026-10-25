// Datos del dashboard (#29), leídos en el servidor con la sesión del usuario (RLS: cada uno ve lo suyo).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './supabase/database.types'
import type { JudiDay, JudiTodayState, RecentUnlock } from './dashboard'
import { AVERAGE_MONTHS, monthKey, previousMonths, type GoalKind } from './goals'
import type { LibraryGame } from './tracker'

type Client = SupabaseClient<Database>

export interface DashboardData {
    userId: string
    username: string | null
    steam: { linked: boolean; lastSyncAt: string | null; visibility: string | null }
    games: LibraryGame[]
    recentUnlocks: RecentUnlock[]
    unlocksThisYear: number
    minutesThisYear: number
    judi: { today: string; todayId: number | null; days: JudiDay[]; state: JudiTodayState }
    /** Metas del mes (#31): las guardadas y las fechas de tus logros del mes y los anteriores, para el progreso y la media. */
    goals: { month: string; targets: Partial<Record<GoalKind, number>>; unlockTimes: string[] }
}

/** Hoy en Madrid como DD-MM-YYYY, el formato de hubgames_lista_videojuegos_judi.fecha. */
export function judiToday(now: Date = new Date()): string {
    const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
        .format(now)
        .split('-')
    return `${d}-${m}-${y}`
}

async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
    const out: T[] = []
    for (let from = 0; ; from += 1000) {
        const { data, error } = await page(from, from + 999)
        if (error) throw new Error(error.message)
        out.push(...(data ?? []))
        if (!data || data.length < 1000) return out
    }
}

function legacyToMs(fecha: string): number {
    const [d, m, y] = fecha.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
}

export async function loadDashboard(supabase: Client, userId: string, now: Date = new Date()): Promise<DashboardData> {
    const yearStart = `${now.getFullYear()}-01-01`
    const today = judiToday(now)
    const month = monthKey(now)
    const since = previousMonths(month, AVERAGE_MONTHS).at(-1)!

    const [profile, steam, games, recent, yearUnlocks, playtime, judiList, judiProgress, goals, unlockTimes] = await Promise.all([
        supabase.from('hubgames_usuarios').select('username').eq('id', userId).maybeSingle(),
        supabase.from('hubgames_user_steam').select('last_sync_at, visibility').eq('user_id', userId).maybeSingle(),
        all((from, to) => supabase.from('hubgames_library').select('*').eq('user_id', userId).order('appid').range(from, to)),
        supabase
            .from('hubgames_achievements')
            .select('appid, display_name, icon, global_percent, unlocktime')
            .eq('user_id', userId)
            .eq('achieved', true)
            .not('unlocktime', 'is', null)
            .order('unlocktime', { ascending: false })
            .limit(8),
        supabase
            .from('hubgames_user_achievements')
            .select('appid', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('achieved', true)
            .gte('unlocktime', `${yearStart}T00:00:00Z`),
        all((from, to) =>
            supabase.from('hubgames_playtime_daily').select('minutes').eq('user_id', userId).gte('date', yearStart).range(from, to),
        ),
        all((from, to) => supabase.from('hubgames_lista_videojuegos_judi').select('id, fecha').order('id').range(from, to)),
        all((from, to) =>
            supabase
                .from('hubgames_judi_fases_usuario')
                .select('id_lista_judi, completado, fase6')
                .eq('id_usuario', userId)
                .range(from, to),
        ),
        supabase.from('hubgames_monthly_goals').select('kind, target').eq('user_id', userId).eq('month', month),
        // Desde el día 1 del mes más antiguo de la media; con margen de un día por la zona horaria.
        all((from, to) =>
            supabase
                .from('hubgames_user_achievements')
                .select('unlocktime')
                .eq('user_id', userId)
                .eq('achieved', true)
                .gte('unlocktime', new Date(Date.parse(`${since}T00:00:00Z`) - 86400_000).toISOString())
                .order('unlocktime')
                .range(from, to),
        ),
    ])

    // Los JUDI de mañana ya están en la tabla desde las 11:00, pero no cuentan hasta las 00:00.
    const todayMs = legacyToMs(today)
    const progress = new Map(judiProgress.map((p) => [p.id_lista_judi, p]))
    const published = judiList.filter((j) => legacyToMs(j.fecha) <= todayMs)
    const todayId = published.find((j) => j.fecha === today)?.id ?? null
    const mine = todayId !== null ? progress.get(todayId) : undefined
    const state: JudiTodayState =
        todayId === null ? 'sin_juego' : !mine ? 'pendiente' : mine.completado ? 'acertado' : mine.fase6 ? 'fallado' : 'en_curso'

    return {
        userId,
        username: profile.data?.username ?? null,
        steam: { linked: !!steam.data, lastSyncAt: steam.data?.last_sync_at ?? null, visibility: steam.data?.visibility ?? null },
        games: games as LibraryGame[],
        recentUnlocks: (recent.data ?? []).filter((u): u is RecentUnlock => u.appid !== null),
        unlocksThisYear: yearUnlocks.count ?? 0,
        minutesThisYear: playtime.reduce((sum, r) => sum + (r.minutes ?? 0), 0),
        judi: {
            today,
            todayId,
            state,
            days: published.map((j) => ({
                fecha: j.fecha,
                completado: !!progress.get(j.id)?.completado,
                perdido: !!progress.get(j.id)?.fase6,
            })),
        },
        goals: {
            month,
            targets: Object.fromEntries((goals.data ?? []).map((g) => [g.kind, g.target])),
            unlockTimes: unlockTimes.flatMap((u) => (u.unlocktime ? [u.unlocktime] : [])),
        },
    }
}
