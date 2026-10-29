'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, BookOpen, Clock, FilterX, LogIn, Trophy, X } from 'lucide-react'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import {
    ACHIEVEMENT_COLUMNS,
    ACHIEVEMENT_FILTER_LABELS,
    steamGuidesUrl,
    type Achievement,
    type AchievementFilter,
    type AchievementSort,
} from '@/lib/achievements'
import { ACHIEVEMENT_FILTERS, LAYOUT_ANIMATION_LIMIT, filterAchievements, lastUnlock, stateCounts } from '@/lib/game-achievements'
import { RARITY_TIER_LABELS, rarityColor, type RarityTier } from '@/lib/rarity'
import { formatHours } from '@/lib/format'
import type { GameStatus } from '@/lib/tracker'
import { Button } from '@/components/ui/button'
import SkeletonSwap from '@/components/SkeletonSwap'
import GameAchievementsSkeleton from './GameAchievementsSkeleton'
import Segmented from '@/components/Segmented'
import AchievementItem from '@/components/achievements/AchievementItem'
import GameCover from '@/components/tracker/GameCover'
import { MarkFlags, StatusChip } from '@/components/tracker/status'
import AchievementsSummary from './AchievementsSummary'
import '@/styles/lists.css'
import '@/components/achievements/achievements.css'
import './logros-juego.css'

interface Props {
    appid: number
    name: string
    headerImage: string | null
}

/** Tu fila de la biblioteca para la cabecera (la misma que lee la ficha). */
interface LibraryInfo {
    status: GameStatus | null
    favorite: boolean | null
    endless: boolean | null
    playtime_forever: number | null
}

type State = { kind: 'cargando' } | { kind: 'sin_sesion' } | { kind: 'ok'; list: Achievement[]; library: LibraryInfo | null }

const SORTS: AchievementSort[] = ['rareza', 'fecha', 'nombre']
/** Etiquetas cortas para el control segmentado ("Ordenar por …"). */
const SORT_LABELS: Record<AchievementSort, string> = { rareza: 'Rareza', fecha: 'Recientes', nombre: 'Nombre' }
const FILTER_LABELS = Object.fromEntries(ACHIEVEMENT_FILTERS.map((f) => [f, ACHIEVEMENT_FILTER_LABELS[f]])) as Record<AchievementFilter, string>
const NONE: Achievement[] = []
const EASE_OUT = [0.22, 1, 0.36, 1] as const
const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>
/** Posición en la entrada escalonada (`.hg-enter`, styles/lists.css). */
const enter = (i: number): CSSVars => ({ '--i': i })

/** Página de logros de un juego (#25): cabecera con tu lista, resumen como el de la ficha, filtros de estado y rareza y lista. */
export default function GameAchievements({ appid, name, headerImage }: Props) {
    const [state, setState] = useState<State>({ kind: 'cargando' })
    const [filter, setFilter] = useState<AchievementFilter>('todos')
    const [rarity, setRarity] = useState<RarityTier | null>(null)
    const [sort, setSort] = useState<AchievementSort>('rareza')
    // Hasta que se toca un filtro, la lista entra escalonada (CSS); después, entra y sale con framer-motion.
    const [touched, setTouched] = useState(false)
    const [error, setError] = useState('')
    const reduce = useReducedMotion() ?? false

    useEffect(() => {
        let cancelled = false
        safeGetSession().then(async ({ data: { session } }) => {
            if (!session) {
                if (!cancelled) setState({ kind: 'sin_sesion' })
                return
            }
            const [achievements, library] = await Promise.all([
                supabase.from('hubgames_achievements').select(ACHIEVEMENT_COLUMNS).eq('appid', appid),
                supabase.from('hubgames_library').select('status, favorite, endless, playtime_forever').eq('appid', appid).maybeSingle(),
            ])
            if (cancelled) return
            if (achievements.error) setError(achievements.error.message)
            setState({ kind: 'ok', list: (achievements.data ?? []) as Achievement[], library: (library.data as LibraryInfo | null) ?? null })
        })
        return () => {
            cancelled = true
        }
    }, [appid])

    const list = state.kind === 'ok' ? state.list : NONE
    const counts = useMemo(() => stateCounts(list, rarity), [list, rarity])
    const shown = useMemo(() => filterAchievements(list, filter, rarity, sort), [list, filter, rarity, sort])

    // Los que entran al cambiar de filtro aparecen escalonados entre ellos: se comparan con lo que se veía antes.
    const [prevShown, setPrevShown] = useState(shown)
    const [before, setBefore] = useState<Set<string> | null>(null)
    if (prevShown !== shown) {
        setPrevShown(shown)
        setBefore(new Set(prevShown.map((a) => a.apiname)))
    }

    const skeleton = <GameAchievementsSkeleton appid={appid} name={name} headerImage={headerImage} />
    if (state.kind === 'cargando') return <SkeletonSwap skeleton={skeleton} resetScroll />
    const wrap = (view: React.ReactNode) => <SkeletonSwap skeleton={skeleton}>{view}</SkeletonSwap>

    const library = state.kind === 'ok' ? state.library : null
    const total = list.length
    const last = lastUnlock(list)
    const filtered = filter !== 'todos' || rarity !== null
    const big = total > LAYOUT_ANIMATION_LIMIT

    const change = <T,>(set: (v: T) => void) => (v: T) => {
        setTouched(true)
        set(v)
    }
    const pickRarity = change((t: RarityTier | null) => setRarity((cur) => (cur === t ? null : t)))
    const clearFilters = () => {
        setTouched(true)
        setFilter('todos')
        setRarity(null)
    }

    const header = (
        <>
            <Link href={`/juego/${appid}`} className="logros__back gl-back hg-enter" style={enter(0)}>
                <ArrowLeft size={14} aria-hidden /> {name}
            </Link>
            <header className="gl-head hg-enter" style={enter(0)}>
                <Link href={`/juego/${appid}`} className="gl-cap" aria-label={`Ficha de ${name}`}>
                    <GameCover appid={appid} name={name} headerImage={headerImage} variant="header" sizes="184px" priority />
                </Link>
                <h1 className="page-title">Logros de {name}</h1>
                {(library || last) && (
                    <p className="gl-meta">
                        {library?.status && <StatusChip status={library.status} />}
                        {library && (library.favorite || library.endless) && (
                            <span className="gl-meta__flags">
                                <MarkFlags favorite={!!library.favorite} endless={!!library.endless} />
                            </span>
                        )}
                        {library && (library.playtime_forever ?? 0) > 0 && (
                            <span className="lib-meta">
                                <Clock aria-hidden />
                                <b>{formatHours(library.playtime_forever!)}</b> jugadas
                            </span>
                        )}
                        {last && (
                            <span className="lib-meta">
                                <Trophy aria-hidden />
                                Último logro, <b>{DATE.format(new Date(last))}</b>
                            </span>
                        )}
                    </p>
                )}
                <div className="gl-head__act">
                    <Button variant="secondary" asChild>
                        <a href={steamGuidesUrl(appid)} target="_blank" rel="noreferrer">
                            <BookOpen aria-hidden /> Guías de Steam
                        </a>
                    </Button>
                </div>
            </header>
        </>
    )

    if (state.kind === 'sin_sesion' || total === 0) {
        return wrap(
            <div className="logros gl">
                {header}
                {error && (
                    <p className="alert alert--error" role="alert">
                        {error}
                    </p>
                )}
                {state.kind === 'sin_sesion' ? (
                    <div className="lg-empty hg-enter" style={enter(1)}>
                        <span className="lg-empty__icon hg-tint st-todos" aria-hidden>
                            <LogIn />
                        </span>
                        <p>
                            <b>Inicia sesión para ver tus logros.</b>
                            Verás tu progreso, tus puntos y lo que te falta de este juego.
                        </p>
                        <div className="lg-empty__action">
                            <Button variant="secondary" size="sm" asChild>
                                <Link href="/login">
                                    <LogIn aria-hidden /> Entrar
                                </Link>
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="lg-empty gl-empty--leg hg-enter" style={enter(1)}>
                        <span className="lg-empty__icon hg-tint" aria-hidden>
                            <Trophy />
                        </span>
                        <p>
                            <b>No hay logros de este juego en tu cuenta.</b>O no tiene logros, o aún no se han sincronizado desde Steam.
                        </p>
                        <div className="lg-empty__action">
                            <Button variant="secondary" size="sm" asChild>
                                <Link href={`/juego/${appid}`}>
                                    <ArrowLeft aria-hidden /> Volver a la ficha
                                </Link>
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    let entering = 0
    const what = [filter !== 'todos' ? ACHIEVEMENT_FILTER_LABELS[filter] : '', rarity ? RARITY_TIER_LABELS[rarity] : ''].filter(Boolean).join(' · ')

    return wrap(
        <div className="logros gl">
            {header}

            {error && (
                <p className="alert alert--error" role="alert">
                    {error}
                </p>
            )}

            <AchievementsSummary list={list} rarity={rarity} onRarity={pickRarity} />

            <div className="gl-bar hg-enter" style={enter(2)}>
                <div className="gl-bar__left">
                    <Segmented
                        aria-label="Filtrar logros"
                        value={filter}
                        options={[...ACHIEVEMENT_FILTERS]}
                        labels={FILTER_LABELS}
                        counts={counts}
                        onChange={change(setFilter)}
                        scroll
                    />
                    <AnimatePresence initial={false}>
                        {rarity && (
                            <motion.button
                                key={rarity}
                                type="button"
                                className="gl-rf-chip hg-tint"
                                style={{ '--c': rarityColor(rarity) } as CSSVars}
                                title="Quitar el filtro de rareza"
                                onClick={() => pickRarity(null)}
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT }}
                            >
                                {RARITY_TIER_LABELS[rarity]} <X aria-hidden />
                                <span className="sr-only"> (quitar filtro)</span>
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
                <div className="gl-sort">
                    <span id="gl-sort-label">Ordenar por</span>
                    <Segmented aria-labelledby="gl-sort-label" value={sort} options={SORTS} labels={SORT_LABELS} onChange={change(setSort)} />
                </div>
            </div>

            <p className="gl-result" aria-live="polite">
                {filtered ? (
                    <>
                        Mostrando <b>{shown.length}</b> de {total}
                    </>
                ) : (
                    `${total} ${total === 1 ? 'logro' : 'logros'}`
                )}
            </p>

            <ul className="ach-list gl-list" aria-label="Logros">
                <AnimatePresence initial={false} mode="popLayout">
                    {shown.map((a, i) => {
                        const isNew = before !== null && !before.has(a.apiname)
                        const delay = isNew && !big ? 0.09 + Math.min(entering++, 8) * 0.02 : 0
                        return (
                            <motion.li
                                key={a.apiname}
                                layout={big || reduce ? false : 'position'}
                                initial={big ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                                animate={{ opacity: 1, scale: 1, transition: { duration: reduce ? 0 : 0.24, delay: reduce ? 0 : delay, ease: EASE_OUT } }}
                                exit={{ opacity: 0, scale: big ? 1 : 0.97, transition: { duration: reduce ? 0 : 0.16, ease: EASE_OUT } }}
                                transition={{ layout: { duration: 0.32, ease: EASE_OUT } }}
                            >
                                <AchievementItem as="div" achievement={a} gameName={name} index={touched ? undefined : i} />
                            </motion.li>
                        )
                    })}
                    {shown.length === 0 && (
                        <motion.li
                            key="sin-resultados"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, transition: { duration: reduce ? 0 : 0.2, delay: reduce ? 0 : 0.12 } }}
                            exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.12 } }}
                        >
                            <div className="lg-empty gl-empty">
                                <span className="lg-empty__icon" aria-hidden>
                                    <FilterX />
                                </span>
                                <p>
                                    <b>No hay logros con este filtro.</b>
                                    {what}: ninguno.
                                </p>
                                <div className="lg-empty__action">
                                    <Button variant="secondary" size="sm" onClick={clearFilters}>
                                        Quitar filtros
                                    </Button>
                                </div>
                            </div>
                        </motion.li>
                    )}
                </AnimatePresence>
            </ul>
        </div>
    )
}
