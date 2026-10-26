// Indicadores de la navegación: estado del JUDI de hoy y juegos de la wishlist en mínimo histórico.
// Consultas ligeras desde el navegador (RLS: cada uno ve lo suyo). El contador de la bandeja es `countTray` (tracker.ts).
import { supabase } from '@/lib/supabase/client'
import { judiTodayState, type JudiProgressFlags, type JudiTodayState } from '@/lib/dashboard'
import { judiToday } from '@/lib/dashboard-db'
import { findJudiLocalKey } from '@/lib/judi'
import { isAtHistoricalLow } from '@/lib/wishlist'

/** Progreso de invitado guardado por /judi en localStorage (`judi_progress`, por fecha). */
function localProgress(fecha: string): JudiProgressFlags | undefined {
    try {
        const raw = JSON.parse(localStorage.getItem('judi_progress') || '{}') as Record<string, JudiProgressFlags>
        const key = findJudiLocalKey(raw, fecha)
        return key ? raw[key] : undefined
    } catch {
        return undefined
    }
}

/**
 * Estado del JUDI de hoy. `hubgames_judi_list` devuelve los días publicados del más reciente al más antiguo (id desc) y
 * PostgREST no deja filtrar su resultado por fecha, así que solo se piden las primeras filas y se busca la de hoy.
 * Con sesión trae tu progreso; sin sesión, el progreso sale de localStorage como en /judi.
 */
export async function loadJudiToday(signedIn: boolean): Promise<JudiTodayState> {
    const today = judiToday()
    const { data, error } = await supabase.rpc('hubgames_judi_list').range(0, 6)
    if (error || !data) return 'sin_juego'
    const day = data.find((d) => d.fecha === today)
    return judiTodayState(Boolean(day), signedIn ? day : localProgress(today))
}

/** Juegos de tu wishlist en mínimo histórico de Steam (mismo criterio que el filtro «En mínimo histórico»). */
export async function countWishlistDeals(): Promise<number> {
    const { data, error } = await supabase
        .from('hubgames_wishlist')
        .select('price_final, discount_percent, steam_low, all_low')
        .gt('discount_percent', 0)
        .not('steam_low', 'is', null)
    if (error || !data) return 0
    return data.filter(isAtHistoricalLow).length
}
