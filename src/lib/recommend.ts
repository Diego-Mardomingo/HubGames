// "¿Qué juego hoy?" (#30): puntúa tus juegos en Jugando y Pendientes según el tiempo que tienes y lo que te apetece.
// Puro (con tests en recommend.test.ts): lo que falta según HowLongToBeat, la posición en la cola,
// cuánto hace que no lo juegas y el % de logros.
import { remainingMinutes } from './dashboard'
import { gameDuration } from './library'
import { formatHours } from './format'
import type { LibraryGame } from './tracker'

export type SessionLength = 'corta' | 'media' | 'larga'
export type Mood = 'terminar' | 'nuevo' | 'logros' | 'sorpresa'

export const SESSION_LABELS: Record<SessionLength, string> = {
    corta: 'Menos de 1 h',
    media: '1-3 h',
    larga: 'Sesión larga',
}

export const MOOD_LABELS: Record<Mood, string> = {
    terminar: 'Terminar algo',
    nuevo: 'Empezar algo nuevo',
    logros: 'Cazar logros',
    sorpresa: 'Sorpréndeme',
}

/** Minutos de cada sesión, para saber si un juego "se termina hoy". */
export const SESSION_MINUTES: Record<SessionLength, number> = { corta: 60, media: 180, larga: 360 }

const DAY_MS = 24 * 3600_000
/** Menos de esto jugado = no empezado de verdad. */
const STARTED_MIN = 60

export interface Recommendation {
    game: LibraryGame
    score: number
    /** Motivos, el más importante primero. */
    reasons: string[]
}

interface Signal {
    points: number
    reason?: string
}

function daysAgo(iso: string | null, now: number): number | null {
    return iso ? Math.max(0, Math.floor((now - Date.parse(iso)) / DAY_MS)) : null
}

function agoText(days: number): string {
    if (days === 0) return 'hoy'
    if (days === 1) return 'ayer'
    if (days < 60) return `hace ${days} días`
    return `hace ${Math.round(days / 30)} meses`
}

function achievementInfo(g: LibraryGame): { pct: number; left: number } | null {
    const total = g.achievements_total ?? 0
    if (total === 0) return null
    const unlocked = Math.min(g.achievements_unlocked ?? 0, total)
    return { pct: (unlocked / total) * 100, left: total - unlocked }
}

/** Semilla → número en [0, 1): "Sorpréndeme" cambia con la semilla, pero es reproducible en los tests. */
function noise(appid: number, seed: number): number {
    let x = (appid * 2654435761 + seed * 40503) >>> 0
    x ^= x >>> 16
    x = Math.imul(x, 2246822507) >>> 0
    x ^= x >>> 13
    return (x >>> 0) / 4294967296
}

function signals(g: LibraryGame, session: SessionLength, mood: Mood, now: number, seed: number): Signal[] | null {
    const out: Signal[] = []
    const remaining = remainingMinutes(g)
    const duration = gameDuration(g)
    const started = g.playtime_forever >= STARTED_MIN || g.status === 'jugando'
    const last = daysAgo(g.rtime_last_played, now)
    const ach = achievementInfo(g)
    const sessionMin = SESSION_MINUTES[session]

    // Lo que te apetece decide qué juegos entran y pesa más.
    switch (mood) {
        case 'terminar': {
            if (!started) return null
            if (remaining === null) out.push({ points: 0.5 })
            else if (remaining === 0) out.push({ points: 2, reason: `Ya has pasado la historia (${formatHours(duration.main!)}): ¿lo cierras?` })
            else out.push({ points: 3 * (1 - Math.min(remaining, 40 * 60) / (40 * 60)), reason: `Te faltan unas ${formatHours(remaining)} para terminarlo` })
            break
        }
        case 'nuevo': {
            if (g.status !== 'pendiente' || g.playtime_forever >= STARTED_MIN) return null
            const pos = g.backlog_position
            out.push(
                pos !== null
                    ? { points: 3 / (1 + pos / 3), reason: pos <= 3 ? `Es de los primeros de tu cola (#${pos})` : `Está en tu cola (#${pos})` }
                    : { points: 0.5, reason: 'Está en tus pendientes' },
            )
            break
        }
        case 'logros': {
            if (!ach || ach.left === 0) return null
            out.push({ points: 3 * (ach.pct / 100), reason: `Llevas el ${Math.floor(ach.pct)} % de los logros (te faltan ${ach.left})` })
            break
        }
        case 'sorpresa':
            out.push({ points: 2.5 * noise(g.appid, seed) })
            break
    }

    // El tiempo que tienes.
    if (remaining !== null && remaining > 0 && remaining <= sessionMin && mood !== 'nuevo') {
        out.push({ points: 1.5, reason: 'Te da tiempo a acabarlo hoy' })
    }
    if (session === 'corta') {
        // Algo a medias se retoma rápido; empezar algo largo en menos de una hora, no tanto.
        if (started) out.push({ points: 0.5 })
        if (!started && duration.main !== null && duration.main > 20 * 60) out.push({ points: -1 })
        if (!started && duration.main !== null && duration.main <= 5 * 60) out.push({ points: 0.8, reason: `Es corto (${formatHours(duration.main)})` })
    } else if (session === 'larga' && !started && duration.main !== null && duration.main > 10 * 60) {
        out.push({ points: 0.5, reason: 'Buena sesión para meterte de lleno' })
    }

    // Cuánto hace que no lo juegas: lo reciente tiene inercia; lo muy olvidado cuesta más retomarlo.
    if (started && last !== null) {
        if (last <= 14) out.push({ points: 1 - last / 14, reason: `Lo jugaste ${agoText(last)}` })
        else if (last > 90 && mood === 'terminar') out.push({ points: -0.5 })
    }

    // La cola cuenta un poco aunque no busques algo nuevo.
    if (mood !== 'nuevo' && g.status === 'pendiente' && g.backlog_position !== null) {
        out.push({ points: 0.6 / (1 + g.backlog_position / 3) })
    }
    // Y los logros, si ya vas avanzado.
    if (mood !== 'logros' && ach && ach.left > 0 && ach.pct >= 75) {
        out.push({ points: 0.4, reason: `Vas por el ${Math.floor(ach.pct)} % de los logros` })
    }
    return out
}

/**
 * Juegos en Jugando y Pendientes ordenados de mejor a peor propuesta. La UI enseña los 3 primeros
 * y "Otra" pasa a los siguientes. `seed` cambia el orden de "Sorpréndeme".
 */
export function recommend(games: LibraryGame[], session: SessionLength, mood: Mood, now: number = Date.now(), seed = 0): Recommendation[] {
    const out: Recommendation[] = []
    for (const game of games) {
        if (game.status !== 'jugando' && game.status !== 'pendiente') continue
        const s = signals(game, session, mood, now, seed)
        if (!s) continue
        const reasons = s
            .filter((x): x is Required<Signal> => !!x.reason && x.points > 0)
            .sort((a, b) => b.points - a.points)
            .map((x) => x.reason)
        out.push({ game, score: s.reduce((sum, x) => sum + x.points, 0), reasons })
    }
    return out.sort((a, b) => b.score - a.score || (a.game.name ?? '').localeCompare(b.game.name ?? ''))
}
