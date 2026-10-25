'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import { buildRanking, type JudiProgressRecord } from '@/lib/judi-ranking'
import Loader from '@/components/Loader'
import './ranking.css'

type RankingRow = ReturnType<typeof buildRanking>[number]

/** Inicial sobre superficie neutra: el color queda para las medallas y para resaltar tu fila. */
function UserAvatar({ username, size, self = false }: { username: string; size: number; self?: boolean }) {
    const initial = username[0]?.toUpperCase() || '?'
    return (
        <span className={`rk-avatar${self ? ' is-self' : ''}`} style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden>
            {initial}
        </span>
    )
}

function winsLabel(wins: number) {
    if (wins === 1) return '1 juego acertado'
    return `${wins} juegos acertados`
}

export default function RankingPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [leaderboard, setLeaderboard] = useState<RankingRow[]>([])
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)

    useEffect(() => {
        const loadRanking = async () => {
            const { data: { session } } = await safeGetSession()
            if (!session) { router.push('/login'); return }
            setCurrentUserId(session.user.id)

            const pageSize = 1000
            const allRows: JudiProgressRecord[] = []
            let from = 0
            for (;;) {
                const { data, error } = await supabase
                    .rpc('hubgames_judi_ranking_rows')
                    .range(from, from + pageSize - 1)
                if (error) break
                if (!data?.length) break
                allRows.push(...(data as JudiProgressRecord[]))
                if (data.length < pageSize) break
                from += pageSize
            }

            setLeaderboard(buildRanking(allRows))
            setLoading(false)
        }
        void loadRanking()
    }, [router])

    if (loading) {
        return <Loader label="Cargando ranking" />
    }

    const podium = leaderboard.slice(0, 3)
    const rest = leaderboard.slice(3)
    const selfIndex = leaderboard.findIndex((e) => e.userId === currentUserId)
    const self = selfIndex >= 0 ? leaderboard[selfIndex] : null
    const topPoints = leaderboard[0]?.points ?? 0
    // En el DOM, por puesto; en pantalla, 2º · 1º · 3º (orden de CSS).
    const podiumSlots = podium.map((entry, i) => ({ entry, rank: i + 1 }))

    return (
        <div className="rk">
            <header className="page-head rk-head">
                <div>
                    <h1 className="page-title">Ranking</h1>
                    <p className="page-subtitle">
                        Cuanto antes aciertes el juego del día, más puntos sumas: 6 al primer intento, 1 al último.
                    </p>
                </div>
                {self && (
                    <dl className="rk-self">
                        <div>
                            <dt>tu posición</dt>
                            <dd>{selfIndex + 1}º</dd>
                        </div>
                        <div>
                            <dt>puntos</dt>
                            <dd>{self.points.toLocaleString('es-ES')}</dd>
                        </div>
                        <div>
                            <dt>acertados</dt>
                            <dd>{self.wins.toLocaleString('es-ES')}</dd>
                        </div>
                    </dl>
                )}
            </header>

            {leaderboard.length === 0 && (
                <div className="hg-empty">
                    <p>Aún no hay partidas terminadas.</p>
                </div>
            )}

            {podiumSlots.length > 0 && (
                <ol className="rk-podium" aria-label="Podio">
                    {podiumSlots.map(({ entry, rank }) => {
                        const isSelf = entry.userId === currentUserId
                        return (
                            <li key={entry.userId} className={`rk-podium__item rk-podium__item--${rank}${isSelf ? ' is-self' : ''}`}>
                                <span className="rk-medal" aria-label={`Puesto ${rank}`}>
                                    {rank}
                                </span>
                                <UserAvatar username={entry.username} size={rank === 1 ? 56 : 48} self={isSelf} />
                                <span className="rk-podium__name" title={entry.username}>
                                    {entry.username}
                                    {isSelf && <span className="hg-chip hg-chip--playing">Tú</span>}
                                </span>
                                <span className="rk-podium__pts">
                                    <b>{entry.points.toLocaleString('es-ES')}</b> puntos
                                </span>
                                <span className="rk-podium__sub">
                                    {winsLabel(entry.wins)} · {entry.accuracy} % de precisión
                                </span>
                            </li>
                        )
                    })}
                </ol>
            )}

            {rest.length > 0 && (
                <ol className="rk-list" start={4} aria-label="Clasificación">
                    {rest.map((entry, index) => {
                        const rank = index + 4
                        const isSelf = entry.userId === currentUserId
                        const pct = topPoints ? (entry.points / topPoints) * 100 : 0
                        return (
                            <li key={entry.userId} className={`rk-row${isSelf ? ' is-self' : ''}`}>
                                <span className="rk-row__rank" aria-label={`Puesto ${rank}`}>
                                    {rank}
                                </span>
                                <UserAvatar username={entry.username} size={36} self={isSelf} />
                                <span className="rk-row__player">
                                    <span className="rk-row__name" title={entry.username}>
                                        <span className="rk-row__name-text">{entry.username}</span>
                                        {isSelf && <span className="hg-chip hg-chip--playing">Tú</span>}
                                    </span>
                                    <span className="rk-row__sub">
                                        {winsLabel(entry.wins)} · {entry.accuracy} % de precisión
                                    </span>
                                </span>
                                <span className="hg-bar rk-row__bar" aria-hidden>
                                    <span style={{ width: `${pct}%` }} />
                                </span>
                                <span className="rk-row__pts">
                                    {entry.points.toLocaleString('es-ES')}
                                    <small> pts</small>
                                </span>
                            </li>
                        )
                    })}
                </ol>
            )}
        </div>
    )
}
