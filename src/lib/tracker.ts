// Tracker (#17): tipos de la vista hubgames_library y cambios de estado desde el navegador (RLS: cada usuario los suyos).
import type { GameGoal } from './game-goal'
import { parseLibraryHome, type LibraryHome } from './library'
import { supabase } from './supabase/client'
import type { Database, Json } from './supabase/database.types'

export const GAME_STATUSES = [
    'bandeja',
    'pendiente',
    'jugando',
    'pausado',
    'rejugable',
    'completado',
    'abandonado',
    'ya_jugado',
    'descartado',
    'otros',
] as const
export type GameStatus = (typeof GAME_STATUSES)[number]

export const STATUS_LABELS: Record<GameStatus, string> = {
    bandeja: 'Bandeja',
    pendiente: 'Pendiente',
    jugando: 'Jugando',
    pausado: 'Pausado',
    rejugable: 'Rejugable',
    completado: 'Completado',
    abandonado: 'Abandonado',
    ya_jugado: 'Ya jugado',
    descartado: 'Descartado',
    otros: 'Otros',
}

type LibraryRow = Database['public']['Tables']['hubgames_library']['Row']

/** Fila de hubgames_library. La vista marca todo como nullable; estas columnas nunca lo son. */
export type LibraryGame = Omit<
    LibraryRow,
    'user_id' | 'appid' | 'status' | 'playtime_forever' | 'playtime_2weeks' | 'favorite' | 'endless' | 'owned'
> & {
    user_id: string
    appid: number
    status: GameStatus
    playtime_forever: number
    playtime_2weeks: number
    /** Marcas que se suman al estado. */
    favorite: boolean
    /** Sin final: se juega por jugar (multijugador, sandbox, roguelike...). */
    endless: boolean
    /** false = pendiente sin comprar (no está en tu biblioteca de Steam). */
    owned: boolean
}

export type GameMark = 'favorite' | 'endless'

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

export { formatHours } from './format'

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

/** Objetivo del juego (#24): historia, historia + extras o 100 %. */
export async function setGameGoal(appid: number, goal: GameGoal): Promise<void> {
    const { error } = await supabase.from('hubgames_user_games').update({ goal }).eq('appid', appid)
    if (error) throw new Error(error.message)
    notifyChanged()
}

/** Marca o desmarca un juego como favorito o sin final. Son independientes del estado. */
export async function setGameMark(appid: number, mark: GameMark, value: boolean): Promise<void> {
    const { error } = await supabase
        .from('hubgames_user_games')
        .update(mark === 'favorite' ? { favorite: value } : { endless: value })
        .eq('appid', appid)
    if (error) throw new Error(error.message)
    notifyChanged()
}

/** Añade a Pendientes un juego que no tienes (trae su ficha, su precio y su mínimo). */
export async function addToPending(appid: number): Promise<void> {
    const res = await fetch('/api/pendientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appid }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'No se pudo añadir a Pendientes')
    notifyChanged()
}

/** Quita de Pendientes un juego que no tienes. Los que tienes en Steam cambian de estado, no se quitan. */
export async function removeFromPending(appid: number): Promise<void> {
    const res = await fetch(`/api/pendientes?appid=${appid}`, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'No se pudo quitar de Pendientes')
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

/** Guarda el orden de los pendientes (#21) tras arrastrar: `appids` es la lista completa en el nuevo orden. */
export async function reorderBacklog(appids: number[]): Promise<void> {
    const { error } = await supabase.rpc('hubgames_reorder_backlog', { p_appids: appids })
    if (error) throw new Error(error.message)
}

export const DEFAULT_PLAYING_LIMIT = 3

/** Límite de juegos en "Jugando" (#21): solo sirve para avisar, nunca bloquea. */
export async function getPlayingLimit(userId: string): Promise<number> {
    const { data } = await supabase.from('hubgames_usuarios').select('playing_limit').eq('id', userId).maybeSingle()
    return data?.playing_limit ?? DEFAULT_PLAYING_LIMIT
}

export async function setPlayingLimit(userId: string, limit: number): Promise<void> {
    const { error } = await supabase.from('hubgames_usuarios').update({ playing_limit: limit }).eq('id', userId)
    if (error) throw new Error(error.message)
}

/** Lista de inicio de /biblioteca (📌), o null si no ha fijado ninguna. */
export async function getLibraryHome(userId: string): Promise<LibraryHome | null> {
    const { data } = await supabase.from('hubgames_usuarios').select('library_home').eq('id', userId).maybeSingle()
    return parseLibraryHome(data?.library_home)
}

export async function setLibraryHome(userId: string, home: LibraryHome): Promise<void> {
    const { error } = await supabase
        .from('hubgames_usuarios')
        .update({ library_home: home as unknown as Json })
        .eq('id', userId)
    if (error) throw new Error(error.message)
}

/** Juegos en "Jugando" y el límite del usuario, para avisar al pasar uno más a "Jugando". */
export async function playingLoad(userId: string): Promise<{ count: number; limit: number }> {
    const [{ count }, limit] = await Promise.all([
        supabase.from('hubgames_user_games').select('appid', { count: 'exact', head: true }).eq('status', 'jugando'),
        getPlayingLimit(userId),
    ])
    return { count: count ?? 0, limit }
}

/** Biblioteca completa del usuario con sesión (de 1000 en 1000, el máximo de PostgREST). */
export async function loadLibrary(): Promise<LibraryGame[]> {
    const out: LibraryGame[] = []
    for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
            .from('hubgames_library')
            .select('*')
            .order('appid')
            .range(from, from + 999)
        if (error) throw new Error(error.message)
        out.push(...(data as LibraryGame[]))
        if (data.length < 1000) return out
    }
}
