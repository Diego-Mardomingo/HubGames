export type JudiProgressRecord = {
    id_usuario?: string
    completado?: boolean | null
    fase1?: boolean | null
    fase2?: boolean | null
    fase3?: boolean | null
    fase4?: boolean | null
    fase5?: boolean | null
    fase6?: boolean | null
    hubgames_usuarios?: { username?: string | null } | Array<{ username?: string | null }>
}

const phaseFields: Array<keyof JudiProgressRecord> = ['fase1', 'fase2', 'fase3', 'fase4', 'fase5', 'fase6']

function getUsername(record: JudiProgressRecord, fallbackUserId: string) {
    const raw = Array.isArray(record.hubgames_usuarios)
        ? record.hubgames_usuarios[0]?.username
        : record.hubgames_usuarios?.username
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

export function buildRanking(records: JudiProgressRecord[]) {
    const aggregates: Record<string, {
        userId: string
        username: string
        points: number
        wins: number
        losses: number
        finishedGames: number
        accuracy: number
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
                accuracy: 0,
            }
        }

        aggregates[userId].points += points
        aggregates[userId].finishedGames += 1
        if (record.completado) {
            aggregates[userId].wins += 1
        } else {
            aggregates[userId].losses += 1
        }
    })

    return Object.values(aggregates)
        .map((entry) => ({
            ...entry,
            accuracy: entry.finishedGames > 0 ? Math.round((entry.wins / entry.finishedGames) * 100) : 0,
        }))
        .sort((a, b) =>
            b.points - a.points ||
            b.wins - a.wins ||
            b.accuracy - a.accuracy ||
            a.username.localeCompare(b.username, 'es')
        )
}
