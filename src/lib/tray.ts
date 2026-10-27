// Bandeja (#17): destinos, destino sugerido y reparto de lo clasificado. Sin acceso a la base de datos, con tests.
import type { GameStatus, LibraryGame } from './tracker'
import { parseGenres } from './steam-text'

export type TrayDestination = Exclude<GameStatus, 'bandeja'>

/** Los nueve destinos en el orden de GAME_STATUSES: la posición es su tecla (1 Pendiente … 9 Otros). */
export const TRAY_DESTINATIONS: TrayDestination[] = [
    'pendiente',
    'jugando',
    'pausado',
    'rejugable',
    'completado',
    'abandonado',
    'ya_jugado',
    'descartado',
    'otros',
]

/** Grupos como en el raíl: por jugar o en curso, terminados y aparte. */
export const TRAY_GROUPS: { title: string; statuses: TrayDestination[] }[] = [
    { title: 'Por jugar o en curso', statuses: ['pendiente', 'jugando', 'pausado', 'rejugable'] },
    { title: 'Terminados', statuses: ['completado', 'abandonado', 'ya_jugado'] },
    { title: 'Aparte', statuses: ['descartado', 'otros'] },
]

/** Tecla (1–9) de un destino. */
export function destinationKey(status: TrayDestination): number {
    return TRAY_DESTINATIONS.indexOf(status) + 1
}

/** Destino de una tecla, o null si no es 1–9. */
export function destinationForKey(key: string): TrayDestination | null {
    if (!/^[1-9]$/.test(key)) return null
    return TRAY_DESTINATIONS[Number(key) - 1]
}

/** Géneros de Steam (en español) que son programas, no juegos. */
const SOFTWARE_GENRES = new Set([
    'Utilidades',
    'Diseño e ilustración',
    'Animación y modelado',
    'Edición fotográfica',
    'Edición de vídeo',
    'Producción de audio',
    'Software de formación',
    'Desarrollo web',
    'Contabilidad',
])

export function isSoftware(game: Pick<LibraryGame, 'genres'>): boolean {
    return parseGenres(game.genres).some((g) => SOFTWARE_GENRES.has(g))
}

const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000
const LONG_PLAY = 50 * 60

export interface TraySuggestion {
    status: TrayDestination
    reason: string
}

type SuggestColumns = 'genres' | 'playtime_forever' | 'playtime_2weeks' | 'rtime_last_played' | 'hltb_main'

/**
 * Destino sugerido de un juego de la bandeja (solo se marca, nunca clasifica solo). En orden: programas → Otros;
 * sin historia (HowLongToBeat) y más de 50 h → Rejugable; jugado estas dos semanas → Jugando; 0 h → Pendiente;
 * más horas que la historia → Ya jugado. Si no encaja en ninguna, null.
 */
export function suggestDestination(game: Pick<LibraryGame, SuggestColumns>, now: number = Date.now()): TraySuggestion | null {
    const story = game.hltb_main && game.hltb_main > 0 ? game.hltb_main : null
    const played = game.playtime_forever
    if (isSoftware(game)) return { status: 'otros', reason: 'Es un programa, no un juego' }
    if (!story && played > LONG_PLAY) return { status: 'rejugable', reason: 'Sin historia que terminar y más de 50 h' }
    const lastPlayed = game.rtime_last_played ? Date.parse(game.rtime_last_played) : NaN
    if (game.playtime_2weeks > 0 || (played > 0 && now - lastPlayed <= TWO_WEEKS)) {
        return { status: 'jugando', reason: 'Lo has jugado estas dos semanas' }
    }
    if (played === 0) return { status: 'pendiente', reason: 'Sin estrenar' }
    if (story && played >= story) return { status: 'ya_jugado', reason: 'Más horas que su historia' }
    return null
}

/** Lo clasificado en esta visita, por destino. */
export type TraySession = Partial<Record<TrayDestination, number>>

export interface SessionSegment {
    status: TrayDestination
    count: number
    /** Inicio del segmento en % de la barra. */
    x: number
    /** Fracción de la barra (0–1). */
    f: number
}

/** Reparto para la barra apilada: los nueve destinos en su orden (los vacíos con f = 0, para que crezcan al llegar). */
export function sessionSegments(session: TraySession): SessionSegment[] {
    const total = sessionTotal(session)
    let acc = 0
    return TRAY_DESTINATIONS.map((status) => {
        const count = session[status] ?? 0
        const f = total ? count / total : 0
        const x = acc * 100
        acc += f
        return { status, count, x, f }
    })
}

export function sessionTotal(session: TraySession): number {
    return Object.values(session).reduce((a, b) => a + (b ?? 0), 0)
}

/** Suma (o resta, con n < 0) clasificados de un destino; los que se quedan en 0 desaparecen. */
export function addToSession(session: TraySession, status: TrayDestination, n: number): TraySession {
    const next = { ...session }
    const value = (next[status] ?? 0) + n
    if (value > 0) next[status] = value
    else delete next[status]
    return next
}
