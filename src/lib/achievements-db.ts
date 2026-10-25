// Logros (#26): lecturas de hubgames_achievements desde el navegador (RLS: cada usuario los suyos).
import { supabase } from './supabase/client'
import { ACHIEVEMENT_COLUMNS, type Achievement } from './achievements'

/** Todos tus logros desbloqueados, del más antiguo al más reciente (de 1000 en 1000, el máximo de PostgREST). */
export async function loadUnlockedAchievements(): Promise<Achievement[]> {
    const out: Achievement[] = []
    for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
            .from('hubgames_achievements')
            .select(ACHIEVEMENT_COLUMNS)
            .eq('achieved', true)
            .order('unlocktime', { ascending: true, nullsFirst: true })
            .order('appid')
            .order('apiname')
            .range(from, from + 999)
        if (error) throw new Error(error.message)
        out.push(...(data as Achievement[]))
        if (data.length < 1000) return out
    }
}

/** Logros que tiene más del `minPercent` % de los jugadores y tú no, de más a menos común. */
export async function loadEasyMissing(minPercent: number, limit: number): Promise<Achievement[]> {
    const { data, error } = await supabase
        .from('hubgames_achievements')
        .select(ACHIEVEMENT_COLUMNS)
        .eq('achieved', false)
        .gt('global_percent', minPercent)
        .order('global_percent', { ascending: false })
        .order('appid')
        .limit(limit)
    if (error) throw new Error(error.message)
    return data as Achievement[]
}
