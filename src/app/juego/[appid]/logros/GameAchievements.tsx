'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Gauge, LogIn, Trophy } from 'lucide-react'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import {
    ACHIEVEMENT_COLUMNS,
    ACHIEVEMENT_FILTER_LABELS,
    ACHIEVEMENT_SORT_LABELS,
    DIFFICULTY_LABELS,
    estimateDifficulty,
    formatPercent,
    matchesAchievementFilter,
    sortAchievements,
    steamGuidesUrl,
    type Achievement,
    type AchievementFilter,
    type AchievementSort,
} from '@/lib/achievements'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Loader from '@/components/Loader'
import { Reveal } from '@/components/motion'
import AchievementItem from '@/components/achievements/AchievementItem'
import '@/components/achievements/achievements.css'
import '@/components/tracker/tracker.css'

interface Props {
    appid: number
    name: string
}

type State = { kind: 'cargando' } | { kind: 'sin_sesion' } | { kind: 'ok'; list: Achievement[] }

const FILTERS: AchievementFilter[] = ['todos', 'bloqueados', 'desbloqueados', 'ocultos']
const SORTS: AchievementSort[] = ['rareza', 'fecha', 'nombre']
const NONE: Achievement[] = []

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

    if (state.kind === 'cargando') return <Loader label="Cargando logros" />

    const unlocked = counts.desbloqueados
    const total = list.length
    const pct = total > 0 ? Math.floor((unlocked / total) * 100) : 0
    const difficulty = estimateDifficulty(list)

    return (
        <div className="logros">
            <Link href={`/juego/${appid}`} className="eyebrow logros__back">
                <ArrowLeft size={13} aria-hidden /> {name}
            </Link>

            <header className="page-head">
                <div>
                    <Reveal>
                        <span className="eyebrow">
                            <Trophy size={13} aria-hidden /> Logros
                        </span>
                    </Reveal>
                    <Reveal delay={0.05}>
                        <h1 className="page-title">{name}</h1>
                    </Reveal>
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
                            <div className="ach-summary__links">
                                <a href={steamGuidesUrl(appid)} target="_blank" rel="noreferrer">
                                    <BookOpen size={13} aria-hidden /> Guías de Steam
                                </a>
                            </div>
                        </div>
                    </section>

                    <div className="ach-toolbar">
                        <nav className="ach-tabs" aria-label="Filtrar logros">
                            {FILTERS.map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    className={`ach-tab ${filter === f ? 'is-active' : ''}`}
                                    aria-pressed={filter === f}
                                    onClick={() => setFilter(f)}
                                >
                                    {ACHIEVEMENT_FILTER_LABELS[f]}
                                    <span className="ach-tab__count">{counts[f]}</span>
                                </button>
                            ))}
                        </nav>
                        <Select value={sort} onValueChange={(v) => setSort(v as AchievementSort)}>
                            <SelectTrigger className="ach-select" aria-label="Ordenar logros">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SORTS.map((s) => (
                                    <SelectItem key={s} value={s}>
                                        {ACHIEVEMENT_SORT_LABELS[s]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {shown.length === 0 ? (
                        <p className="logros__empty glass">No hay logros con este filtro.</p>
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
