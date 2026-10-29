'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { Lock, LogIn, Play, RotateCw, TriangleAlert } from 'lucide-react'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import { buildRanking, rankingTrend, type JudiProgressRecord, type RankingEntry, type RankingTrend } from '@/lib/judi-ranking'
import { madridDate } from '@/lib/activity-heatmap'
import SkeletonSwap from '@/components/SkeletonSwap'
import RankingSkeleton from './RankingSkeleton'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/EmptyState'
import RankingView from './RankingView'
import './ranking.css'

type State =
    | { kind: 'loading' }
    | { kind: 'guest' }
    | { kind: 'error' }
    | { kind: 'ready'; ranking: RankingEntry[]; trends: Map<string, RankingTrend> | null; userId: string }

/** Todas las filas de la RPC (de 1000 en 1000). null si falla. */
async function loadRows(): Promise<JudiProgressRecord[] | null> {
    const rows: JudiProgressRecord[] = []
    for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.rpc('hubgames_judi_ranking_rows').range(from, from + 999)
        if (error) return null
        rows.push(...((data ?? []) as JudiProgressRecord[]))
        if (!data || data.length < 1000) break
    }
    return rows
}

function Head() {
    return (
        <header className="page-head rk-head hg-enter">
            <div>
                <h1 className="page-title">Ranking</h1>
                <p className="page-subtitle">Cuanto antes aciertes el juego del día, más puntos sumas.</p>
            </div>
        </header>
    )
}

export default function RankingPage() {
    const [state, setState] = useState<State>({ kind: 'loading' })
    // Sube con «Reintentar» para volver a cargar
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let alive = true
        const load = async () => {
            const {
                data: { session },
            } = await safeGetSession()
            if (!alive) return
            // La RPC solo responde con sesión: sin ella, una tarjeta que explica por qué (en vez de mandar al login sin más)
            if (!session) {
                setState({ kind: 'guest' })
                return
            }
            const rows = await loadRows()
            if (!alive) return
            if (!rows) {
                setState({ kind: 'error' })
                return
            }
            setState({
                kind: 'ready',
                ranking: buildRanking(rows),
                // Sin la migración del día (20261029180000), las filas no lo traen y no hay tendencia
                trends: rankingTrend(rows, madridDate(Date.now())),
                userId: session.user.id,
            })
        }
        void load()
        return () => {
            alive = false
        }
    }, [attempt])

    if (state.kind === 'loading') return <SkeletonSwap skeleton={<RankingSkeleton />} />

    if (state.kind === 'guest')
        return (
            <SkeletonSwap skeleton={<RankingSkeleton />}>
                <div className="rk">
                    <Head />
                    <EmptyState
                        size="page"
                        tone="st-todos"
                        icon={<Lock />}
                        title="El ranking es para jugadores con cuenta"
                        className="hg-enter"
                        style={{ '--i': 1 } as CSSProperties}
                        action={
                            <>
                                <Button asChild>
                                    <Link href="/login">
                                        <LogIn data-icon="inline-start" aria-hidden /> Iniciar sesión
                                    </Link>
                                </Button>
                                <Button asChild variant="secondary">
                                    <Link href="/judi">
                                        <Play data-icon="inline-start" aria-hidden /> Jugar el de hoy
                                    </Link>
                                </Button>
                            </>
                        }
                    >
                        Tus partidas como invitado se guardan solo en este dispositivo. Inicia sesión para guardarlas y competir.
                    </EmptyState>
                </div>
            </SkeletonSwap>
        )

    if (state.kind === 'error')
        return (
            <SkeletonSwap skeleton={<RankingSkeleton />}>
                <div className="rk">
                    <Head />
                    <EmptyState
                        size="page"
                        tone="rk-ko"
                        icon={<TriangleAlert />}
                        title="No se pudo cargar el ranking"
                        role="alert"
                        className="hg-enter"
                        style={{ '--i': 1 } as CSSProperties}
                        action={
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setState({ kind: 'loading' })
                                    setAttempt((k) => k + 1)
                                }}
                            >
                                <RotateCw data-icon="inline-start" aria-hidden /> Reintentar
                            </Button>
                        }
                    >
                        Comprueba la conexión y vuelve a intentarlo.
                    </EmptyState>
                </div>
            </SkeletonSwap>
        )

    return (
        <SkeletonSwap skeleton={<RankingSkeleton />}>
            <RankingView ranking={state.ranking} userId={state.userId} trends={state.trends} />
        </SkeletonSwap>
    )
}
