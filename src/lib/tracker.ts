// Tracker (#17): tipos de la vista hubgames_library y cambios de estado desde el navegador (RLS: cada usuario los suyos).
import { supabase } from './supabase/client'
import type { Database } from './supabase/database.types'

export const GAME_STATUSES = ['bandeja', 'pendiente', 'jugando', 'pausado', 'completado', 'abandonado', 'descartado'] as const
export type GameStatus = (typeof GAME_STATUSES)[number]

export const STATUS_LABELS: Record<GameStatus, string> = {
    bandeja: 'Bandeja',
    pendiente: 'Pendiente',
    jugando: 'Jugando',
    pausado: 'Pausado',
    completado: 'Completado',
    abandonado: 'Abandonado',
    descartado: 'No me interesa',
}

type LibraryRow = Database['public']['Tables']['hubgames_library']['Row']

/** Fila de hubgames_library. La vista marca todo como nullable; estas columnas nunca lo son. */
export type LibraryGame = Omit<LibraryRow, 'user_id' | 'appid' | 'status' | 'playtime_forever' | 'playtime_2weeks'> & {
    user_id: string
    appid: number
    status: GameStatus
    playtime_forever: number
    playtime_2weeks: number
}

/** Lo emite cualquier cambio de estado; la nav lo escucha para refrescar el contador de la bandeja. */
export const TRACKER_CHANGED_EVENT = 'hubgames:tracker-changed'

function notifyChanged() {
    window.dispatchEvent(new Event(TRACKER_CHANGED_EVENT))
}

export interface SuggestedDate {
    date: string
    source: 'logro' | 'partida'
}

/** Fecha sugerida para "Completado": el último logro desbloqueado o la última partida, lo que sea más reciente. */
export function suggestedCompletionDate(game: Pick<LibraryGame, 'last_unlock_at' | 'rtime_last_played'>): SuggestedDate | null {
    const unlock = game.last_unlock_at
    const played = game.rtime_last_played
    if (unlock && (!played || Date.parse(unlock) >= Date.parse(played))) return { date: unlock, source: 'logro' }
    if (played) return { date: played, source: 'partida' }
    return null
}

export function formatHours(minutes: number): string {
    if (minutes === 0) return '0 h'
    if (minutes < 60) return `${minutes} min`
    const hours = minutes / 60
    return `${hours < 10 ? hours.toFixed(1).replace('.', ',') : Math.round(hours)} h`
}

/** Cambia el estado de uno o varios juegos como decisión manual. "Jugando" fija started_at si aún no lo tenía. */
export async function setGamesStatus(appids: number[], status: GameStatus): Promise<void> {
    if (appids.length === 0) return
    const { error } = await supabase
        .from('hubgames_user_games')
        .update({ status, status_source: 'manual' })
        .in('appid', appids)
    if (error) throw new Error(error.message)
    if (status === 'jugando') {
        const { error: startError } = await supabase
            .from('hubgames_user_games')
            .update({ started_at: new Date().toISOString() })
            .in('appid', appids)
            .is('started_at', null)
        if (startError) throw new Error(startError.message)
    }
    notifyChanged()
}

/** Marca juegos como completados en lote, cada uno con su fecha sugerida (o ahora si no hay ninguna). */
export async function completeGames(games: Pick<LibraryGame, 'appid' | 'last_unlock_at' | 'rtime_last_played'>[]): Promise<void> {
    if (games.length === 0) return
    const results = await Promise.all(
        games.map((g) =>
            supabase
                .from('hubgames_user_games')
                .update({
                    status: 'completado',
                    status_source: 'manual',
                    completed_at: suggestedCompletionDate(g)?.date ?? new Date().toISOString(),
                })
                .eq('appid', g.appid),
        ),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) throw new Error(failed.error.message)
    notifyChanged()
}

export interface Completion {
    /** 0 a 10 en pasos de 0,5; null = sin nota. */
    rating: number | null
    /** ISO. */
    completedAt: string
    review: string | null
}

/** Guarda el diálogo de completar (#19). También sirve para editar la nota, la fecha o la reseña después. */
export async function saveCompletion(appid: number, completion: Completion): Promise<void> {
    const { error } = await supabase
        .from('hubgames_user_games')
        .update({
            status: 'completado',
            status_source: 'manual',
            rating: completion.rating,
            completed_at: completion.completedAt,
            review: completion.review,
        })
        .eq('appid', appid)
    if (error) throw new Error(error.message)
    notifyChanged()
}

/** "Todavía no" a una sugerencia (#18): no se repite por el mismo motivo (ver tracker-rules.ts). */
export async function dismissSuggestion(appid: number): Promise<void> {
    const { error } = await supabase
        .from('hubgames_user_games')
        .update({ suggestion: null, suggestion_dismissed_at: new Date().toISOString() })
        .eq('appid', appid)
    if (error) throw new Error(error.message)
    notifyChanged()
}

/** Juegos en la bandeja del usuario con sesión. */
export async function countTray(): Promise<number> {
    const { count } = await supabase
        .from('hubgames_user_games')
        .select('appid', { count: 'exact', head: true })
        .eq('status', 'bandeja')
    return count ?? 0
}
