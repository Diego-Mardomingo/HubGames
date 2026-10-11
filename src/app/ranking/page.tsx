'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Crown, Trophy } from 'lucide-react'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import { buildRanking, type JudiProgressRecord } from '@/lib/judi-ranking'
import Loader from '@/components/Loader'
import { CountUp, Reveal } from '@/components/motion'
import './ranking.css'

type RankingRow = ReturnType<typeof buildRanking>[number]

const EASE_OUT = [0.22, 1, 0.36, 1] as const

function hashHue(userId: string) {
    let h = 0
    for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
    return h % 360
}

function UserAvatar({ userId, username, size }: { userId: string; username: string; size: number }) {
    const initial = username[0]?.toUpperCase() || '?'
    const hue = hashHue(userId)
    return (
        <div
            className="avatar"
            style={{
                width: size,
                height: size,
                fontSize: size * 0.4,
                background: `linear-gradient(135deg, hsl(${hue} 70% 62%) 0%, hsl(${(hue + 50) % 360} 65% 40%) 100%)`,
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
        return <Loader label="Cargando ranking" />
    }

    const podium = leaderboard.slice(0, 3)
    const rest = leaderboard.slice(3)
    const selfIndex = leaderboard.findIndex((e) => e.userId === currentUserId)
    const self = selfIndex >= 0 ? leaderboard[selfIndex] : null
    const topPoints = leaderboard[0]?.points ?? 0
    // Orden visual del podio: 2º · 1º · 3º
    const podiumSlots = [
        { entry: podium[1], rank: 2 },
        { entry: podium[0], rank: 1 },
        { entry: podium[2], rank: 3 },
    ].filter((slot): slot is { entry: RankingRow; rank: number } => Boolean(slot.entry))

    return (
        <div className="ranking">
            <header className="page-head">
                <div>
                    <Reveal>
                        <span className="eyebrow">
                            <Trophy size={13} aria-hidden /> Clasificación global
                        </span>
                    </Reveal>
                    <Reveal delay={0.05}>
                        <h1 className="page-title">Ranking</h1>
                    </Reveal>
                    <Reveal delay={0.1}>
                        <p className="page-subtitle">
                            Cuanto antes aciertes el juego del día, más puntos sumas: 6 al primer intento, 1 al último.
                        </p>
                    </Reveal>
                </div>
                {self && (
                    <Reveal delay={0.15} className="ranking-self glass">
                        <span className="ranking-self__pos">#{selfIndex + 1}</span>
                        <span className="ranking-self__text">
                            <span className="ranking-self__label">Tu posición</span>
                            <span className="ranking-self__pts">
                                <CountUp value={self.points} /> pts · {winsLabel(self.wins)}
                            </span>
                        </span>
                    </Reveal>
                )}
            </header>

            {leaderboard.length === 0 && (
                <div className="ranking-empty">
                    <Trophy size={32} strokeWidth={1.25} />
                    <p>Aún no hay partidas finalizadas</p>
                </div>
            )}

            {podiumSlots.length > 0 && (
                <section className="podium" aria-label="Podio">
                    {podiumSlots.map(({ entry, rank }) => {
                        const isSelf = entry.userId === currentUserId
                        return (
                            <motion.div
                                key={entry.userId}
                                className={`podium__col podium__col--${rank}${isSelf ? ' is-self' : ''}`}
                                initial={{ opacity: 0, y: 40 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 160, damping: 20, delay: rank === 1 ? 0.35 : rank === 2 ? 0.2 : 0.1 }}
                            >
                                <div className="podium__player">
                                    {rank === 1 && (
                                        <motion.span
                                            className="podium__crown"
                                            initial={{ y: -16, opacity: 0, rotate: -20 }}
                                            animate={{ y: 0, opacity: 1, rotate: 0 }}
                                            transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.8 }}
                                        >
                                            <Crown size={22} />
                                        </motion.span>
                                    )}
                                    <div className="podium__avatar">
                                        <UserAvatar userId={entry.userId} username={entry.username} size={rank === 1 ? 76 : 60} />
                                    </div>
                                    <span className="podium__name" title={entry.username}>
                                        {entry.username}
                                    </span>
                                    <span className="podium__pts">
                                        <CountUp value={entry.points} /> pts
                                    </span>
                                </div>
                                <motion.div
                                    className="podium__block"
                                    initial={{ scaleY: 0 }}
                                    animate={{ scaleY: 1 }}
                                    transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.1 + (3 - rank) * 0.08 }}
                                >
                                    <span className="podium__rank">{rank}</span>
                                </motion.div>
                            </motion.div>
                        )
                    })}
                </section>
            )}

            {rest.length > 0 && (
                <ol className="ranking-list">
                    {rest.map((entry, index) => {
                        const rank = index + 4
                        const isSelf = entry.userId === currentUserId
                        const pct = topPoints ? (entry.points / topPoints) * 100 : 0
                        return (
                            <motion.li
                                key={entry.userId}
                                className={`ranking-row${isSelf ? ' is-self' : ''}`}
                                initial={{ opacity: 0, x: -12 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true, margin: '-20px' }}
                                transition={{ duration: 0.4, ease: EASE_OUT, delay: Math.min(index, 10) * 0.03 }}
                            >
                                <span className="ranking-row__rank" aria-label={`Puesto ${rank}`}>
                                    {formatRankDisplay(rank)}
                                </span>
                                <UserAvatar userId={entry.userId} username={entry.username} size={38} />
                                <span className="ranking-row__player">
                                    <span className="ranking-row__name" title={entry.username}>
                                        {entry.username}
                                        {isSelf && <span className="ranking-row__you">Tú</span>}
                                    </span>
                                    <span className="ranking-row__sub">
                                        {winsLabel(entry.wins)} · {entry.accuracy}% precisión
                                    </span>
                                </span>
                                <span className="ranking-row__bar" aria-hidden>
                                    <motion.span
                                        initial={{ width: 0 }}
                                        whileInView={{ width: `${pct}%` }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.15 }}
                                    />
                                </span>
                                <span className="ranking-row__pts">{entry.points.toLocaleString('es-ES')}</span>
                            </motion.li>
                        )
                    })}
                </ol>
            )}
        </div>
    )
}
