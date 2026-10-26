// Indicadores de la navegación: estado del JUDI de hoy y juegos de la wishlist en mínimo histórico.
// Consultas ligeras desde el navegador (RLS: cada uno ve lo suyo). El contador de la bandeja es `countTray` (tracker.ts).
import { supabase } from '@/lib/supabase/client'
import { isMissingRpc, judiTodayState, type JudiProgressFlags, type JudiTodayState } from '@/lib/dashboard'
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
 * Estado del JUDI de hoy. `hubgames_judi_today` devuelve solo la fila de hoy (Madrid) con tu progreso; sin fila, hoy no
 * hay JUDI. Si la función aún no existe (migración sin aplicar), se busca la de hoy entre las primeras filas de
 * `hubgames_judi_list` (id desc), como antes. Sin sesión, el progreso sale de localStorage como en /judi.
 */
export async function loadJudiToday(signedIn: boolean): Promise<JudiTodayState> {
    const today = judiToday()
    const { data, error } = await supabase.rpc('hubgames_judi_today')
    let day: JudiProgressFlags & { fecha: string } | undefined
    if (!error) {
        day = (data ?? []).find((d) => d.fecha === today)
    } else if (isMissingRpc(error)) {
        const fallback = await supabase.rpc('hubgames_judi_list').range(0, 6)
        if (fallback.error || !fallback.data) return 'sin_juego'
        day = fallback.data.find((d) => d.fecha === today)
    } else {
        return 'sin_juego'
    }
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
