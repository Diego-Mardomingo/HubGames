// Datos del dashboard (#29), leídos en el servidor con la sesión del usuario (RLS: cada uno ve lo suyo).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './supabase/database.types'
import { judiTodayState, playingNow, type JudiDay, type JudiTodayState, type RecentUnlock } from './dashboard'
import { heatmapStart, madridDate } from './activity-heatmap'
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
    /** Mapa de actividad: minutos por día (hubgames_playtime_daily) y logros desde el inicio del mapa (último año). */
    activity: { today: string; playtime: { date: string; minutes: number }[]; unlockTimes: string[] }
    /** % global del logro más raro conseguido en cada juego en curso (franja de color de su fila). */
    rarestPercent: Record<number, number>
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
    // Mapa de actividad: desde el lunes de hace 52 semanas (siempre antes del 1 de enero y del inicio de la media).
    const activityToday = madridDate(now)
    const activityFrom = heatmapStart(activityToday)
    // Con margen de un día por la zona horaria (los logros se agrupan por día de Madrid).
    const goalsFromMs = Date.parse(`${since}T00:00:00Z`) - 86400_000
    const unlocksFromMs = Math.min(goalsFromMs, Date.parse(`${activityFrom}T00:00:00Z`) - 86400_000)

    const [profile, steam, games, recent, yearUnlocks, playtime, judiDays, goals, unlockTimes] = await Promise.all([
        supabase.from('hubgames_usuarios').select('username').eq('id', userId).maybeSingle(),
        supabase.from('hubgames_user_steam').select('last_sync_at, visibility').eq('user_id', userId).maybeSingle(),
        all((from, to) => supabase.from('hubgames_library').select('*').eq('user_id', userId).eq('owned', true).order('appid').range(from, to)),
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
            supabase
                .from('hubgames_playtime_daily')
                .select('date, minutes')
                .eq('user_id', userId)
                .gte('date', activityFrom < yearStart ? activityFrom : yearStart)
                .order('date')
                .range(from, to),
        ),
        // Días publicados con tu progreso (#39: la lista ya no se lee directamente).
        all((from, to) => supabase.rpc('hubgames_judi_list').range(from, to)),
        supabase.from('hubgames_monthly_goals').select('kind, target').eq('user_id', userId).eq('month', month),
        // Para las metas (desde el día 1 del mes más antiguo de la media) y el mapa de actividad (último año).
        all((from, to) =>
            supabase
                .from('hubgames_user_achievements')
                .select('unlocktime')
                .eq('user_id', userId)
                .eq('achieved', true)
                .gte('unlocktime', new Date(unlocksFromMs).toISOString())
                .order('unlocktime')
                .range(from, to),
        ),
    ])

    // hubgames_judi_list ya solo devuelve hasta hoy en Madrid; el filtro cubre el margen entre relojes.
    const todayMs = legacyToMs(today)
    const published = judiDays.filter((j) => legacyToMs(j.fecha) <= todayMs).sort((a, b) => a.id - b.id)
    const mine = published.find((j) => j.fecha === today)
    const todayId = mine?.id ?? null
    const state: JudiTodayState = judiTodayState(Boolean(mine), mine)

    // Logro más raro de cada juego en curso: solo de los juegos de la lista, para no leer todos tus logros.
    const playingIds = playingNow(games as LibraryGame[]).map((g) => g.appid)
    const rarest = playingIds.length
        ? await all((from, to) =>
              supabase
                  .from('hubgames_achievements')
                  .select('appid, global_percent')
                  .eq('user_id', userId)
                  .eq('achieved', true)
                  .in('appid', playingIds)
                  .not('global_percent', 'is', null)
                  .order('appid')
                  .order('apiname')
                  .range(from, to),
          )
        : []
    const rarestPercent: Record<number, number> = {}
    for (const r of rarest) {
        if (r.appid === null || r.global_percent === null) continue
        rarestPercent[r.appid] = Math.min(rarestPercent[r.appid] ?? Infinity, Number(r.global_percent))
    }

    const unlockTimeList = unlockTimes.flatMap((u) => (u.unlocktime ? [u.unlocktime] : []))

    return {
        userId,
        username: profile.data?.username ?? null,
        steam: { linked: !!steam.data, lastSyncAt: steam.data?.last_sync_at ?? null, visibility: steam.data?.visibility ?? null },
        games: games as LibraryGame[],
        recentUnlocks: (recent.data ?? []).filter((u): u is RecentUnlock => u.appid !== null),
        unlocksThisYear: yearUnlocks.count ?? 0,
        minutesThisYear: playtime.reduce((sum, r) => sum + (r.date && r.date >= yearStart ? (r.minutes ?? 0) : 0), 0),
        judi: {
            today,
            todayId,
            state,
            days: published.map((j) => ({
                fecha: j.fecha,
                completado: j.completado,
                perdido: j.fase6,
            })),
        },
        goals: {
            month,
            targets: Object.fromEntries((goals.data ?? []).map((g) => [g.kind, g.target])),
            unlockTimes: unlockTimeList.filter((t) => Date.parse(t) >= goalsFromMs),
        },
        activity: {
            today: activityToday,
            playtime: playtime.flatMap((r) => (r.date && r.minutes ? [{ date: r.date, minutes: r.minutes }] : [])),
            unlockTimes: unlockTimeList.filter((t) => Date.parse(t) >= Date.parse(`${activityFrom}T00:00:00Z`) - 86400_000),
        },
        rarestPercent,
    }
}
