'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Gauge, LogIn, Trophy } from 'lucide-react'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import {
    ACHIEVEMENT_COLUMNS,
    ACHIEVEMENT_FILTER_LABELS,
    DIFFICULTY_LABELS,
    estimateDifficulty,
    formatPercent,
    matchesAchievementFilter,
    pointsOf,
    sortAchievements,
    steamGuidesUrl,
    type Achievement,
    type AchievementFilter,
    type AchievementSort,
} from '@/lib/achievements'
import { Button } from '@/components/ui/button'
import Loader from '@/components/Loader'
import AchievementItem from '@/components/achievements/AchievementItem'
import { RARITY_TIERS, RARITY_TIER_LABELS, rarityColor, rarityTier, type RarityTier } from '@/lib/rarity'
import '@/styles/lists.css'
import '@/components/achievements/achievements.css'
import '@/components/tracker/tracker.css'

interface Props {
    appid: number
    name: string
}

type State = { kind: 'cargando' } | { kind: 'sin_sesion' } | { kind: 'ok'; list: Achievement[] }

const FILTERS: AchievementFilter[] = ['todos', 'bloqueados', 'desbloqueados', 'ocultos']
const SORTS: AchievementSort[] = ['rareza', 'fecha', 'nombre']
/** Etiquetas cortas para el control segmentado ("Ordenar por …"). */
const SORT_LABELS: Record<AchievementSort, string> = { rareza: 'Rareza', fecha: 'Recientes', nombre: 'Nombre' }
const NONE: Achievement[] = []

type CSSVars = React.CSSProperties & Record<`--${string}`, string>

/** Conseguidos y totales por rareza (los logros sin dato de Steam no cuentan). */
function byRarity(list: Achievement[]): { tier: RarityTier; unlocked: number; total: number }[] {
    const rows = RARITY_TIERS.map((tier) => ({ tier, unlocked: 0, total: 0 }))
    for (const a of list) {
        const tier = rarityTier(a.global_percent)
        if (!tier) continue
        const row = rows[RARITY_TIERS.indexOf(tier)]
        row.total++
        if (a.achieved) row.unlocked++
    }
    return rows.filter((r) => r.total > 0)
}

/** Página de logros de un juego (#25): progreso, filtros, rareza con colores y dificultad estimada. */
export default function GameAchievements({ appid, name }: Props) {
    const [state, setState] = useState<State>({ kind: 'cargando' })
    const [filter, setFilter] = useState<AchievementFilter>('todos')
    const [sort, setSort] = useState<AchievementSort>('rareza')
    const [error, setError] = useState('')

    useEffect(() => {
        let cancelled = false
        safeGetSession().then(async ({ data: { session } }) => {
            if (!session) {
                if (!cancelled) setState({ kind: 'sin_sesion' })
                return
            }
            const { data, error: loadError } = await supabase.from('hubgames_achievements').select(ACHIEVEMENT_COLUMNS).eq('appid', appid)
            if (cancelled) return
            if (loadError) setError(loadError.message)
            setState({ kind: 'ok', list: (data ?? []) as Achievement[] })
        })
        return () => {
            cancelled = true
        }
    }, [appid])

    const list = state.kind === 'ok' ? state.list : NONE
    const counts = useMemo(
        () => Object.fromEntries(FILTERS.map((f) => [f, list.filter((a) => matchesAchievementFilter(a, f)).length])) as Record<AchievementFilter, number>,
        [list],
    )
    const shown = useMemo(() => sortAchievements(list.filter((a) => matchesAchievementFilter(a, filter)), sort), [list, filter, sort])

    if (state.kind === 'cargando') return <Loader label="Cargando logros" resetScroll />

    const unlocked = counts.desbloqueados
    const total = list.length
    const pct = total > 0 ? Math.floor((unlocked / total) * 100) : 0
    const difficulty = estimateDifficulty(list)
    const points = pointsOf(list)
    const tiers = byRarity(list)

    return (
        <div className="logros">
            <Link href={`/juego/${appid}`} className="logros__back">
                <ArrowLeft size={14} aria-hidden /> {name}
            </Link>

            <header className="page-head">
                <div>
                    <h1 className="page-title">Logros de {name}</h1>
                </div>
            </header>

            {error && (
                <p className="alert alert--error" role="alert">
                    {error}
                </p>
            )}

            {state.kind === 'sin_sesion' ? (
                <section className="logros__empty glass">
                    <p>Inicia sesión para ver tus logros de este juego.</p>
                    <Button variant="secondary" asChild>
                        <Link href="/login">
                            <LogIn aria-hidden /> Entrar
                        </Link>
                    </Button>
                </section>
            ) : total === 0 ? (
                <section className="logros__empty glass">
                    <p>No hay logros de este juego en tu cuenta. O no tiene logros, o aún no se han sincronizado desde Steam.</p>
                    <Button variant="secondary" asChild>
                        <Link href={`/juego/${appid}`}>Volver a la ficha</Link>
                    </Button>
                </section>
            ) : (
                <>
                    <section className="ach-summary glass" aria-label="Progreso">
                        <div className="ach-summary__progress">
                            <p className="ach-summary__count">
                                {unlocked}/{total}
                                <small>{pct} %</small>
                            </p>
                            <span className="ach-summary__bar" aria-hidden>
                                <span style={{ width: `${pct}%` }} />
                            </span>
                            <p className="ach-summary__points" title="Puntos según la rareza de cada logro">
                                {points.earned.toLocaleString('es-ES')} de {points.possible.toLocaleString('es-ES')} puntos de cazador
                            </p>
                        </div>
                        <div className="ach-summary__side">
                            {difficulty ? (
                                <p>
                                    <span className={`ach-difficulty ach-difficulty--${difficulty.level}`}>
                                        <Gauge size={14} aria-hidden /> {DIFFICULTY_LABELS[difficulty.level]}
                                    </span>{' '}
                                    para el 100 %: te {difficulty.remaining === 1 ? 'falta 1 logro' : `faltan ${difficulty.remaining} logros`}
                                    {difficulty.rarest !== null && `, el más raro lo tiene el ${formatPercent(difficulty.rarest)}`}
                                    {difficulty.hard > 1 && ` y ${difficulty.hard} son raros o más`}.
                                </p>
                            ) : (
                                <p>
                                    <span className="badge-100">
                                        <Trophy size={11} aria-hidden /> 100%
                                    </span>{' '}
                                    Todos los logros desbloqueados.
                                </p>
                            )}
                            {tiers.length > 0 && (
                                <ul className="ach-tiers" aria-label="Conseguidos por rareza">
                                    {tiers.map((t) => (
                                        <li key={t.tier} style={{ '--c': rarityColor(t.tier) } as CSSVars}>
                                            <span className="ach-tiers__name">{RARITY_TIER_LABELS[t.tier]}</span>
                                            <span>
                                                <b>{t.unlocked}</b>/{t.total}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="ach-summary__links">
                                <a href={steamGuidesUrl(appid)} target="_blank" rel="noreferrer">
                                    <BookOpen size={13} aria-hidden /> Guías de Steam
                                </a>
                            </div>
                        </div>
                    </section>

                    <div className="ach-toolbar">
                        <div className="hg-seg hg-seg--scroll" role="group" aria-label="Filtrar logros">
                            {FILTERS.map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    className={`hg-seg__opt${filter === f ? ' is-active' : ''}`}
                                    aria-pressed={filter === f}
                                    onClick={() => setFilter(f)}
                                >
                                    {ACHIEVEMENT_FILTER_LABELS[f]}
                                    <span className="hg-seg__count">{counts[f]}</span>
                                </button>
                            ))}
                        </div>
                        <div className="ach-sort">
                            <span id="ach-sort-label">Ordenar por</span>
                            <div className="hg-seg" role="group" aria-labelledby="ach-sort-label">
                                {SORTS.map((o) => (
                                    <button
                                        key={o}
                                        type="button"
                                        className={`hg-seg__opt${sort === o ? ' is-active' : ''}`}
                                        aria-pressed={sort === o}
                                        onClick={() => setSort(o)}
                                    >
                                        {SORT_LABELS[o]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {shown.length === 0 ? (
                        <p className="hg-empty">No hay logros con este filtro.</p>
                    ) : (
                        <ul className="ach-list">
                            {shown.map((a) => (
                                <AchievementItem key={a.apiname} achievement={a} gameName={name} />
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    )
}
