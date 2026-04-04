'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trophy } from 'lucide-react'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import { buildRanking, type JudiProgressRecord } from '@/lib/judi-ranking'

type RankingRow = ReturnType<typeof buildRanking>[number]

const RANK_BG = '#0B0E14'
const CARD_BG = '#1C1F26'

function hashHue(userId: string) {
    let h = 0
    for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
    return h % 360
}

function UserAvatar({ userId, username, size }: { userId: string; username: string; size: number }) {
    const initial = username[0]?.toUpperCase() || '?'
    const hue = hashHue(userId)
    const r = '50%'
    return (
        <div
            className="flex shrink-0 items-center justify-center font-bold text-white/95 shadow-inner"
            style={{
                width: size,
                height: size,
                borderRadius: r,
                fontSize: size * 0.42,
                background: `linear-gradient(135deg, hsl(${hue} 42% 38%) 0%, hsl(${(hue + 40) % 360} 38% 28%) 100%)`,
            }}
            aria-hidden
        >
            {initial}
        </div>
    )
}

function formatRankDisplay(rank: number) {
    return rank < 100 ? String(rank).padStart(2, '0') : String(rank)
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

            const selectCols =
                'id_usuario, completado, fase1, fase2, fase3, fase4, fase5, fase6, hubgames_usuarios(username)'
            const pageSize = 1000
            const allRows: JudiProgressRecord[] = []
            let from = 0
            for (;;) {
                const { data, error } = await supabase
                    .from('hubgames_judi_fases_usuario')
                    .select(selectCols)
                    .order('id_lista_judi', { ascending: true })
                    .order('id_usuario', { ascending: true })
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
        return <div className="loader-container"><div className="loader" /></div>
    }

    return (
        <div className="ranking-redesign animate-fade-in-up">
            <header className="ranking-redesign__intro">
                <h1 className="ranking-redesign__title">Ranking global</h1>
                <p className="ranking-redesign__subtitle">
                    Clasificación por puntos. Cuanto antes aciertes, más puntos sumas.
                </p>
            </header>

            {leaderboard.length === 0 && (
                <div className="ranking-redesign__empty">
                    <Trophy size={32} className="opacity-30" strokeWidth={1.25} />
                    <p>Aún no hay partidas finalizadas</p>
                </div>
            )}

            {leaderboard.length > 0 && (
                <div className="ranking-redesign__panel">
                    <div className="ranking-redesign__column-head" role="row">
                        <span>POSICIÓN</span>
                        <span>JUGADOR</span>
                        <span>PUNTOS</span>
                    </div>

                    <ul className="ranking-redesign__list" role="list">
                        {leaderboard.map((entry, index) => {
                            const rank = index + 1
                            const isSelf = entry.userId === currentUserId
                            return (
                                <li
                                    key={entry.userId}
                                    className={`ranking-redesign__row${isSelf ? ' ranking-redesign__row--self' : ''}`}
                                    role="listitem"
                                >
                                    <span className="ranking-redesign__rank-num tabular-nums" aria-label={`Puesto ${rank}`}>
                                        {formatRankDisplay(rank)}
                                    </span>
                                    <div className="ranking-redesign__player">
                                        <UserAvatar userId={entry.userId} username={entry.username} size={36} />
                                        <div className="ranking-redesign__player-text min-w-0">
                                            <span className="ranking-redesign__name truncate" title={entry.username}>
                                                {entry.username}
                                            </span>
                                            <span className="ranking-redesign__wins-sub truncate" title={winsLabel(entry.wins)}>
                                                {winsLabel(entry.wins)}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="ranking-redesign__points tabular-nums">
                                        {entry.points.toLocaleString('es-ES')}
                                    </span>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            )}

            <style jsx>{`
                .ranking-redesign {
                    --rank-bg: ${RANK_BG};
                    --rank-card: ${CARD_BG};
                    --rank-muted: #8b95a8;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    margin: 0 -0.25rem;
                    padding-bottom: 1.5rem;
                }

                .ranking-redesign__intro {
                    padding: 0 0.25rem;
                }

                .ranking-redesign__title {
                    margin: 0;
                    font-size: 1.25rem;
                    font-weight: 700;
                    letter-spacing: -0.02em;
                    color: var(--foreground);
                }

                .ranking-redesign__subtitle {
                    margin: 0.35rem 0 0;
                    font-size: 0.8125rem;
                    line-height: 1.5;
                    color: var(--muted);
                    max-width: 42ch;
                }

                .ranking-redesign__empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 3rem 1rem;
                    color: var(--muted);
                    font-size: 0.875rem;
                }

                .ranking-redesign__panel {
                    display: flex;
                    flex-direction: column;
                    background: var(--rank-bg);
                    border-radius: 12px;
                    border: 1px solid rgba(79, 209, 197, 0.08);
                    overflow: hidden;
                }

                .ranking-redesign__column-head {
                    display: grid;
                    grid-template-columns: 52px minmax(0, 1fr) 76px;
                    gap: 0.35rem 0.5rem;
                    align-items: center;
                    padding: 10px 14px 8px;
                    font-size: 0.625rem;
                    font-weight: 600;
                    letter-spacing: 0.08em;
                    color: var(--rank-muted);
                    text-transform: uppercase;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                }

                .ranking-redesign__column-head span:nth-child(2) {
                    text-align: center;
                }

                .ranking-redesign__column-head span:nth-child(3) {
                    text-align: right;
                }

                .ranking-redesign__list {
                    list-style: none;
                    margin: 0;
                    padding: 10px 10px 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .ranking-redesign__row {
                    display: grid;
                    grid-template-columns: 52px minmax(0, 1fr) 76px;
                    gap: 0.35rem 0.5rem;
                    align-items: center;
                    padding: 10px 12px;
                    background: var(--rank-card);
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.04);
                }

                .ranking-redesign__row--self {
                    border-color: rgba(79, 209, 197, 0.45);
                    box-shadow: 0 0 0 1px rgba(79, 209, 197, 0.12);
                }

                .ranking-redesign__rank-num {
                    font-size: 1.125rem;
                    font-weight: 700;
                    color: #6b7288;
                    line-height: 1;
                }

                .ranking-redesign__player {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 10px;
                    width: 100%;
                    min-width: 0;
                }

                .ranking-redesign__player-text {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 2px;
                    min-width: 0;
                    max-width: calc(100% - 46px);
                    text-align: center;
                }

                .ranking-redesign__name {
                    font-size: 0.8125rem;
                    font-weight: 700;
                    color: var(--foreground);
                }

                .ranking-redesign__wins-sub {
                    font-size: 0.6875rem;
                    font-weight: 500;
                    color: var(--rank-muted);
                    line-height: 1.25;
                }

                .ranking-redesign__points {
                    font-size: 0.9375rem;
                    font-weight: 800;
                    color: var(--foreground);
                    text-align: right;
                }

                @media (max-width: 520px) {
                    .ranking-redesign__column-head,
                    .ranking-redesign__row {
                        grid-template-columns: 44px minmax(0, 1fr) 68px;
                        gap: 0.25rem 0.35rem;
                        padding-left: 8px;
                        padding-right: 8px;
                    }

                    .ranking-redesign__column-head {
                        font-size: 0.5625rem;
                        letter-spacing: 0.05em;
                    }

                    .ranking-redesign__wins-sub {
                        font-size: 0.625rem;
                    }
                }
            `}</style>
        </div>
    )
}
