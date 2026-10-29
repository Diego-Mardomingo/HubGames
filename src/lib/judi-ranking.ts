export type JudiProgressRecord = {
    id_usuario?: string
    completado?: boolean | null
    fase1?: boolean | null
    fase2?: boolean | null
    fase3?: boolean | null
    fase4?: boolean | null
    fase5?: boolean | null
    fase6?: boolean | null
    username?: string | null
    /** Con la migración 20261029180000_hubgames_judi_ranking_dia: de qué JUDI es la partida y su día (AAAA-MM-DD). */
    id_lista_judi?: number | null
    dia?: string | null
    hubgames_usuarios?: { username?: string | null } | Array<{ username?: string | null }>
}

const phaseFields: Array<keyof JudiProgressRecord> = ['fase1', 'fase2', 'fase3', 'fase4', 'fase5', 'fase6']

function getUsername(record: JudiProgressRecord, fallbackUserId: string) {
    const raw = record.username ?? (Array.isArray(record.hubgames_usuarios)
        ? record.hubgames_usuarios[0]?.username
        : record.hubgames_usuarios?.username)
    return raw?.trim() || `Jugador #${fallbackUserId.slice(0, 4)}`
}

export function isFinishedGame(record: JudiProgressRecord) {
    return Boolean(record.completado || record.fase6)
}

export function getFailedAttempts(record: JudiProgressRecord) {
    return phaseFields.reduce((acc, phaseField) => acc + (record[phaseField] ? 1 : 0), 0)
}

export function getPointsForRecord(record: JudiProgressRecord) {
    if (!isFinishedGame(record)) return null
    if (!record.completado) return 0
    const failedAttempts = getFailedAttempts(record)
    return Math.max(6 - failedAttempts, 1)
}

export type RankingEntry = {
    userId: string
    username: string
    points: number
    wins: number
    losses: number
    finishedGames: number
    /** % de partidas terminadas que acertó (redondeado). */
    accuracy: number
    /** Media de intentos al acertar (fallos + 1), con un decimal; null si no ha acertado ninguna. */
    avgAttempts: number | null
    /** Puesto. Empate total (puntos, aciertos y precisión) = mismo puesto: 1, 2, 2, 4. */
    rank: number
    /** Comparte puesto con otro jugador. */
    sharedRank: boolean
    /** Empata a puntos con un vecino, pero los aciertos o la precisión deciden el orden. */
    pointsTie: boolean
}

type Standing = { points: number; wins: number; accuracy: number }
const sameStanding = (a: Standing, b: Standing) => a.points === b.points && a.wins === b.wins && a.accuracy === b.accuracy

export function buildRanking(records: JudiProgressRecord[]): RankingEntry[] {
    const aggregates: Record<string, {
        userId: string
        username: string
        points: number
        wins: number
        losses: number
        finishedGames: number
        attemptsOnWins: number
    }> = {}

    records.forEach((record) => {
        const userId = record.id_usuario
        if (!userId) return
        if (!isFinishedGame(record)) return
        const points = getPointsForRecord(record) ?? 0

        if (!aggregates[userId]) {
            aggregates[userId] = {
                userId,
                username: getUsername(record, userId),
                points: 0,
                wins: 0,
                losses: 0,
                finishedGames: 0,
                attemptsOnWins: 0,
            }
        }

        const agg = aggregates[userId]
        agg.points += points
        agg.finishedGames += 1
        if (record.completado) {
            agg.wins += 1
            agg.attemptsOnWins += getFailedAttempts(record) + 1
        } else {
            agg.losses += 1
        }
    })

    const sorted = Object.values(aggregates)
        .map(({ attemptsOnWins, ...entry }) => ({
            ...entry,
            accuracy: entry.finishedGames > 0 ? Math.round((entry.wins / entry.finishedGames) * 100) : 0,
            avgAttempts: entry.wins > 0 ? Math.round((attemptsOnWins / entry.wins) * 10) / 10 : null,
        }))
        .sort((a, b) =>
            b.points - a.points ||
            b.wins - a.wins ||
            b.accuracy - a.accuracy ||
            a.username.localeCompare(b.username, 'es')
        )

    const ranks: number[] = []
    sorted.forEach((entry, i) => {
        ranks.push(i > 0 && sameStanding(sorted[i - 1], entry) ? ranks[i - 1] : i + 1)
    })
    return sorted.map((entry, i) => {
        const prev = sorted[i - 1]
        const next = sorted[i + 1]
        const sharedRank = (prev !== undefined && ranks[i - 1] === ranks[i]) || (next !== undefined && ranks[i + 1] === ranks[i])
        const pointsTie = !sharedRank && (prev?.points === entry.points || next?.points === entry.points)
        return { ...entry, rank: ranks[i], sharedRank, pointsTie }
    })
}

/** Tu puesto y el total de jugadores, con la misma cuenta que /ranking (empates compartidos). */
export function rankOf(ranking: readonly RankingEntry[], userId: string | null | undefined): { position: number; total: number } | null {
    const entry = userId ? ranking.find((e) => e.userId === userId) : undefined
    return entry ? { position: entry.rank, total: ranking.length } : null
}

// ── Tendencia ──

export const TREND_DAYS = 30

export type RankingTrend = {
    /** up/down: puestos que ha subido o bajado; new: no tenía partidas terminadas antes de la ventana. */
    kind: 'up' | 'down' | 'same' | 'new'
    delta: number
    /** Puntos de las partidas de los JUDI de la ventana. */
    gain: number
    /** Puesto antes de la ventana (null si es nuevo). */
    previousRank: number | null
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** Todas las filas traen su día (la RPC con la migración aplicada). Sin él, no hay tendencia. */
export function hasRankingDays(records: readonly JudiProgressRecord[]): boolean {
    return records.length > 0 && records.every((r) => typeof r.dia === 'string' && ISO_DAY.test(r.dia))
}

/** Día (AAAA-MM-DD) que queda `days` días antes de `today`. */
export function daysBefore(today: string, days: number): string {
    const ms = Date.parse(`${today}T00:00:00Z`) - days * 86400_000
    return new Date(ms).toISOString().slice(0, 10)
}

/**
 * Puesto de hoy frente al de antes de los últimos `days` días de JUDI (por el día del JUDI, no por cuándo se jugó:
 * recuperar un día antiguo cuenta como de ese día). null si las filas no traen su día.
 */
export function rankingTrend(records: JudiProgressRecord[], today: string, days = TREND_DAYS): Map<string, RankingTrend> | null {
    if (!hasRankingDays(records)) return null
    const cutoff = daysBefore(today, days)
    const inWindow = (r: JudiProgressRecord) => (r.dia as string) > cutoff
    const prev = new Map(buildRanking(records.filter((r) => !inWindow(r))).map((e) => [e.userId, e.rank]))
    const gain = new Map<string, number>()
    records.forEach((r) => {
        if (!r.id_usuario || !inWindow(r)) return
        gain.set(r.id_usuario, (gain.get(r.id_usuario) ?? 0) + (getPointsForRecord(r) ?? 0))
    })
    return new Map(buildRanking(records).map((e) => {
        const p = prev.get(e.userId) ?? null
        const kind: RankingTrend['kind'] = p === null ? 'new' : p > e.rank ? 'up' : p < e.rank ? 'down' : 'same'
        return [e.userId, { kind, delta: p === null ? 0 : Math.abs(p - e.rank), gain: gain.get(e.userId) ?? 0, previousRank: p }]
    }))
}

// ── Tu distancia y la ventana de listas largas ──

export type RankingGap =
    | { kind: 'solo' }
    | { kind: 'lead'; points: number; other: RankingEntry }
    | { kind: 'tie'; other: RankingEntry }
    | { kind: 'behind'; points: number; other: RankingEntry }

/**
 * Lo que te separa de tu vecino: si vas primero, la ventaja sobre el siguiente; si no, los puntos que te faltan para
 * pasar al primero que tiene más que tú (uno más que la diferencia), o con quién empatas a puntos por delante.
 */
export function rankingGap(ranking: readonly RankingEntry[], userId: string): RankingGap | null {
    const i = ranking.findIndex((e) => e.userId === userId)
    if (i < 0) return null
    const me = ranking[i]
    if (ranking.length === 1) return { kind: 'solo' }
    if (i === 0) {
        const other = ranking[1]
        return other.points === me.points ? { kind: 'tie', other } : { kind: 'lead', points: me.points - other.points, other }
    }
    const ahead = ranking.slice(0, i)
    const tied = ahead.find((e) => e.points === me.points)
    if (tied) return { kind: 'tie', other: tied }
    const other = [...ahead].reverse().find((e) => e.points > me.points) as RankingEntry
    return { kind: 'behind', points: other.points - me.points + 1, other }
}

export type RankingWindowItem<T> = { kind: 'entry'; entry: T; index: number } | { kind: 'gap'; key: string }

/**
 * Lista larga (desde `min` jugadores): los `top` primeros, «···», tu zona (`around` por encima y por debajo) y «···» si
 * quedan más. Con menos jugadores o con `all`, la lista entera; sin ti, solo el top.
 */
export function rankingWindow<T extends { userId: string }>(
    ranking: readonly T[],
    userId: string | null,
    { min = 15, top = 10, around = 2, all = false }: { min?: number; top?: number; around?: number; all?: boolean } = {},
): { items: RankingWindowItem<T>[]; truncated: boolean } {
    const every = ranking.map((entry, index) => ({ kind: 'entry' as const, entry, index }))
    if (all || ranking.length < min) return { items: every, truncated: false }
    const self = userId ? ranking.findIndex((e) => e.userId === userId) : -1
    const keep = (i: number) => i < top || (self >= 0 && Math.abs(i - self) <= around)
    const items: RankingWindowItem<T>[] = []
    let skipped = false
    every.forEach((item) => {
        if (!keep(item.index)) {
            skipped = true
            return
        }
        if (skipped) items.push({ kind: 'gap', key: `gap-${item.index}` })
        skipped = false
        items.push(item)
    })
    if (skipped) items.push({ kind: 'gap', key: 'gap-end' })
    return { items, truncated: true }
}
