'use client'

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, CheckCheck } from 'lucide-react'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import { completeGames, formatHours, setGamesStatus, type GameStatus, type LibraryGame } from '@/lib/tracker'
import { isPerfect } from '@/lib/tracker-rules'
import { Button } from '@/components/ui/button'
import Loader from '@/components/Loader'
import KeyboardList from '@/components/KeyboardList'
import GameCover from '@/components/tracker/GameCover'
import CompleteDialog from '@/components/tracker/CompleteDialog'
import { LIST_ICONS } from '@/components/tracker/status'
import '../biblioteca.css'

type SortKey = 'horas' | 'verguenza' | 'valorados' | 'nombre'

const SORTS: { key: SortKey; label: string }[] = [
    { key: 'horas', label: 'Más horas' },
    { key: 'verguenza', label: '0 horas' },
    { key: 'valorados', label: 'Mejor valorados' },
    { key: 'nombre', label: 'Nombre' },
]

type Action = { status: GameStatus; label: string; icon: typeof Check }

/**
 * El orden es el de los atajos: 1 pendiente, 2 jugando, 3 completado, 4 abandonado, 5 descartado, 6 ya jugado, 7 otros
 * y 8 rejugable (los tres últimos llegaron después: van al final para no cambiar las teclas de siempre). Icono y color
 * de su lista.
 */
const ACTIONS: Action[] = [
    { status: 'pendiente', label: 'Pendiente', icon: LIST_ICONS.pendiente },
    { status: 'jugando', label: 'Jugando', icon: LIST_ICONS.jugando },
    { status: 'completado', label: 'Completado', icon: LIST_ICONS.completado },
    { status: 'abandonado', label: 'Abandonado', icon: LIST_ICONS.abandonado },
    { status: 'descartado', label: 'Descartado', icon: LIST_ICONS.descartado },
    { status: 'ya_jugado', label: 'Ya jugado', icon: LIST_ICONS.ya_jugado },
    { status: 'otros', label: 'Otros', icon: LIST_ICONS.otros },
    { status: 'rejugable', label: 'Rejugable', icon: LIST_ICONS.rejugable },
]

const PAGE = 60

function sortGames(games: LibraryGame[], key: SortKey): LibraryGame[] {
    const byName = (a: LibraryGame, b: LibraryGame) => (a.name ?? '').localeCompare(b.name ?? '', 'es')
    switch (key) {
        case 'horas':
            return [...games].sort((a, b) => b.playtime_forever - a.playtime_forever || byName(a, b))
        case 'verguenza':
            return games.filter((g) => g.playtime_forever === 0).sort(byName)
        case 'valorados':
            return [...games].sort((a, b) => (b.steamspy_userscore ?? -1) - (a.steamspy_userscore ?? -1) || byName(a, b))
        case 'nombre':
            return [...games].sort(byName)
    }
}

async function loadTray(): Promise<LibraryGame[]> {
    const out: LibraryGame[] = []
    for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
            .from('hubgames_library')
            .select('*')
            .eq('status', 'bandeja')
            .order('appid')
            .range(from, from + 999)
        if (error) throw new Error(error.message)
        out.push(...(data as LibraryGame[]))
        if (data.length < 1000) return out
    }
}

export default function BandejaPage() {
    const router = useRouter()
    const [games, setGames] = useState<LibraryGame[] | null>(null)
    const [sort, setSort] = useState<SortKey>('horas')
    const [selected, setSelected] = useState<Set<number>>(new Set())
    const [visible, setVisible] = useState(PAGE)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [completing, setCompleting] = useState<LibraryGame | null>(null)
    // Tras clasificar con el teclado, el foco pasa a la fila que ocupa el mismo sitio.
    const [focusIndex, setFocusIndex] = useState<number | null>(null)

    useEffect(() => {
        safeGetSession().then(({ data: { session } }) => {
            if (!session) {
                router.push('/login')
                return
            }
            loadTray()
                .then(setGames)
                .catch((e: Error) => {
                    setError(e.message)
                    setGames([])
                })
        })
    }, [router])

    const sorted = useMemo(() => sortGames(games ?? [], sort), [games, sort])
    const shown = sorted.slice(0, visible)
    const shameCount = useMemo(() => (games ?? []).filter((g) => g.playtime_forever === 0).length, [games])

    useEffect(() => {
        if (focusIndex === null) return
        const links = document.querySelectorAll<HTMLElement>('.tray-list [data-row-link]')
        const next = links[Math.min(focusIndex, links.length - 1)]
        next?.focus()
        next?.closest('li')?.scrollIntoView({ block: 'nearest' })
        setFocusIndex(null)
    }, [focusIndex, games])

    /** Quita los juegos de la bandeja al momento y, si falla, los devuelve. */
    async function classify(targets: LibraryGame[], status: GameStatus) {
        if (targets.length === 0 || !games) return
        const ids = new Set(targets.map((g) => g.appid))
        const previous = games
        setGames(games.filter((g) => !ids.has(g.appid)))
        setSelected((s) => new Set([...s].filter((id) => !ids.has(id))))
        setBusy(true)
        setError('')
        try {
            if (status === 'completado') await completeGames(targets)
            else await setGamesStatus([...ids], status)
        } catch (e) {
            setGames(previous)
            setError(e instanceof Error ? e.message : 'No se pudo guardar')
        } finally {
            setBusy(false)
        }
    }

    /** Completar pide nota y fecha; el resto de estados se guarda al momento. */
    function act(game: LibraryGame, status: GameStatus) {
        if (status === 'completado') setCompleting(game)
        else void classify([game], status)
    }

    function toggle(appid: number) {
        setSelected((s) => {
            const next = new Set(s)
            if (next.has(appid)) next.delete(appid)
            else next.add(appid)
            return next
        })
    }

    /** Atajos sobre la fila con el foco: 1–8 la clasifican y x la selecciona. */
    function onListKey(e: KeyboardEvent<HTMLElement>) {
        if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return
        const row = (e.target as HTMLElement).closest<HTMLElement>('li[data-appid]')
        const game = row && shown.find((g) => g.appid === Number(row.dataset.appid))
        if (!game) return
        const digit = Number(e.key)
        if (Number.isInteger(digit) && digit >= 1 && digit <= ACTIONS.length) {
            e.preventDefault()
            const index = shown.indexOf(game)
            act(game, ACTIONS[digit - 1].status)
            if (ACTIONS[digit - 1].status !== 'completado') setFocusIndex(index)
        } else if (e.key === 'x' || e.key === 'X') {
            e.preventDefault()
            toggle(game.appid)
        }
    }

    if (!games) return <Loader label="Cargando bandeja" />

    const selectedGames = sorted.filter((g) => selected.has(g.appid))
    const allShownSelected = shown.length > 0 && shown.every((g) => selected.has(g.appid))

    return (
        <div className={`biblioteca bandeja${selectedGames.length > 0 ? ' has-batch' : ''}`}>
            <header className="page-head">
                <div>
                    <Link href="/biblioteca" className="lib-back">
                        <ArrowLeft size={14} aria-hidden /> Biblioteca
                    </Link>
                    <h1 className="page-title">Bandeja</h1>
                    <p className="page-subtitle">
                        {games.length === 0
                            ? 'Nada por clasificar.'
                            : `${games.length} ${games.length === 1 ? 'juego' : 'juegos'} sin clasificar. Un clic, o una tecla, y fuera de la bandeja.`}
                    </p>
                </div>
            </header>

            {error && (
                <p className="alert alert--error" role="alert">
                    {error}
                </p>
            )}

            {games.length === 0 ? (
                <div className="hg-empty lib-empty">
                    <CheckCheck size={22} aria-hidden className="lib-empty__icon" />
                    <p>Tu bandeja está vacía. Los juegos nuevos de Steam llegarán aquí al sincronizar.</p>
                    <Button variant="secondary" asChild>
                        <Link href="/perfil">Ir a Steam en el perfil</Link>
                    </Button>
                </div>
            ) : (
                <>
                    <div className="tray-toolbar">
                        <div className="hg-seg hg-seg--scroll" role="group" aria-label="Ordenar">
                            {SORTS.map((s) => (
                                <button
                                    key={s.key}
                                    type="button"
                                    aria-pressed={sort === s.key}
                                    className="hg-seg__opt"
                                    onClick={() => {
                                        setSort(s.key)
                                        setVisible(PAGE)
                                    }}
                                >
                                    {s.label}
                                    {s.key === 'verguenza' && <span className="hg-seg__count">{shameCount}</span>}
                                </button>
                            ))}
                        </div>
                        <label className="tray-check">
                            <input
                                type="checkbox"
                                checked={allShownSelected}
                                onChange={() => setSelected(allShownSelected ? new Set() : new Set(shown.map((g) => g.appid)))}
                            />
                            Seleccionar {shown.length === sorted.length ? 'todos' : 'los visibles'}
                        </label>
                    </div>

                    <p className="lib-note">
                        {sort === 'verguenza' && <span>La lista de la vergüenza: juegos que tienes y nunca has abierto.</span>}
                        <span className="hg-keyhint">
                            <kbd>↑</kbd> <kbd>↓</kbd> o <kbd>j</kbd> <kbd>k</kbd> para moverte ·{' '}
                            {ACTIONS.map((a, i) => (
                                <span key={a.status}>
                                    <kbd>{i + 1}</kbd> {a.label.toLowerCase()} ·{' '}
                                </span>
                            ))}
                            <kbd>x</kbd> selecciona
                        </span>
                    </p>

                    <KeyboardList className="hg-rows tray-list" label="Juegos sin clasificar" onKeyDown={onListKey}>
                        {shown.map((game) => {
                            const name = game.name ?? `App ${game.appid}`
                            const isSelected = selected.has(game.appid)
                            return (
                                <li key={game.appid} data-appid={game.appid} className={`hg-row tray-row${isSelected ? ' is-selected' : ''}`}>
                                    <label className="tray-row__select">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggle(game.appid)}
                                            aria-label={`Seleccionar ${name}`}
                                        />
                                    </label>
                                    <span className="hg-row__cover">
                                        <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes="112px" />
                                    </span>
                                    <span className="hg-row__main">
                                        <Link href={`/juego/${game.appid}`} className="hg-row__link" data-row-link>
                                            {name}
                                        </Link>
                                        <span className="hg-row__meta">
                                            {formatHours(game.playtime_forever)}
                                            {game.achievements_total ? ` · ${game.achievements_unlocked ?? 0} / ${game.achievements_total} logros` : null}
                                            {isPerfect(game) && ' (100 %)'}
                                            {game.steamspy_userscore !== null && (
                                                <span title="Valoraciones positivas en Steam"> · {game.steamspy_userscore} % positivas</span>
                                            )}
                                        </span>
                                    </span>
                                    <span className="tray-row__actions">
                                        {ACTIONS.map((a, i) => (
                                            <Button
                                                key={a.status}
                                                type="button"
                                                size="sm"
                                                variant="secondary"
                                                className={`tray-action st-${a.status}`}
                                                title={`${a.label} (${i + 1})`}
                                                aria-label={a.label}
                                                aria-keyshortcuts={String(i + 1)}
                                                onClick={() => act(game, a.status)}
                                            >
                                                <a.icon aria-hidden />
                                                <span className="tray-action__label">{a.label}</span>
                                            </Button>
                                        ))}
                                    </span>
                                </li>
                            )
                        })}
                    </KeyboardList>

                    {sorted.length > visible && (
                        <div className="lib-more">
                            <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE)}>
                                Mostrar más ({sorted.length - visible})
                            </Button>
                        </div>
                    )}
                </>
            )}

            {selectedGames.length > 0 && (
                <div className="tray-batch" role="region" aria-label="Clasificar los seleccionados">
                    <span className="tray-batch__count">
                        {selectedGames.length} {selectedGames.length === 1 ? 'seleccionado' : 'seleccionados'}
                    </span>
                    <div className="tray-batch__actions">
                        {ACTIONS.map((a) => (
                            <Button
                                key={a.status}
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={busy}
                                className={`tray-action st-${a.status}`}
                                title={a.label}
                                aria-label={a.label}
                                onClick={() => classify(selectedGames, a.status)}
                            >
                                <a.icon aria-hidden />
                                <span className="tray-action__label">{a.label}</span>
                            </Button>
                        ))}
                        <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            )}

            <CompleteDialog
                game={completing}
                onOpenChange={(open) => !open && setCompleting(null)}
                onSaved={(appid) => {
                    const index = shown.findIndex((g) => g.appid === appid)
                    setCompleting(null)
                    setGames((list) => list && list.filter((g) => g.appid !== appid))
                    setSelected((s) => new Set([...s].filter((id) => id !== appid)))
                    if (index !== -1) setFocusIndex(index)
                }}
            />
        </div>
    )
}
