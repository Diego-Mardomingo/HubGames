'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Check, CheckCheck, Clock, Flag, Inbox, ListPlus, Play, Trophy, X } from 'lucide-react'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import { completeGames, formatHours, setGamesStatus, type GameStatus, type LibraryGame } from '@/lib/tracker'
import { Button } from '@/components/ui/button'
import Loader from '@/components/Loader'
import CompleteDialog from '@/components/tracker/CompleteDialog'
import { Reveal } from '@/components/motion'
import '../biblioteca.css'

type SortKey = 'horas' | 'verguenza' | 'valorados' | 'nombre'

const SORTS: { key: SortKey; label: string }[] = [
    { key: 'horas', label: 'Más horas' },
    { key: 'verguenza', label: '0 horas' },
    { key: 'valorados', label: 'Mejor valorados' },
    { key: 'nombre', label: 'Nombre' },
]

type Action = { status: GameStatus; label: string; icon: typeof Check }

const ACTIONS: Action[] = [
    { status: 'pendiente', label: 'Pendiente', icon: ListPlus },
    { status: 'jugando', label: 'Jugando', icon: Play },
    { status: 'completado', label: 'Completado', icon: Flag },
    { status: 'abandonado', label: 'Abandonado', icon: X },
    { status: 'descartado', label: 'No me interesa', icon: Ban },
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

    function toggle(appid: number) {
        setSelected((s) => {
            const next = new Set(s)
            if (next.has(appid)) next.delete(appid)
            else next.add(appid)
            return next
        })
    }

    if (!games) return <Loader label="Cargando bandeja" />

    const selectedGames = sorted.filter((g) => selected.has(g.appid))
    const allShownSelected = shown.length > 0 && shown.every((g) => selected.has(g.appid))

    return (
        <div className="biblioteca">
            <header className="page-head">
                <div>
                    <Reveal>
                        <span className="eyebrow">
                            <Inbox size={13} aria-hidden /> Biblioteca
                        </span>
                    </Reveal>
                    <Reveal delay={0.05}>
                        <h1 className="page-title">Bandeja</h1>
                    </Reveal>
                    <Reveal delay={0.1}>
                        <p className="page-subtitle">
                            {games.length === 0
                                ? 'Nada por clasificar.'
                                : `${games.length} ${games.length === 1 ? 'juego' : 'juegos'} sin clasificar. Un clic y fuera de la bandeja.`}
                        </p>
                    </Reveal>
                </div>
            </header>

            {error && (
                <p className="alert alert--error" role="alert">
                    {error}
                </p>
            )}

            {games.length === 0 ? (
                <div className="tray-empty glass">
                    <CheckCheck size={28} aria-hidden />
                    <p>Tu bandeja está vacía. Los juegos nuevos de Steam llegarán aquí al sincronizar.</p>
                    <Button variant="secondary" asChild>
                        <Link href="/perfil">Ir a Steam en el perfil</Link>
                    </Button>
                </div>
            ) : (
                <>
                    <div className="tray-toolbar">
                        <div className="tray-sorts" role="tablist" aria-label="Ordenar">
                            {SORTS.map((s) => (
                                <button
                                    key={s.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={sort === s.key}
                                    className={`tray-sort ${sort === s.key ? 'is-active' : ''}`}
                                    onClick={() => {
                                        setSort(s.key)
                                        setVisible(PAGE)
                                    }}
                                >
                                    {s.label}
                                    {s.key === 'verguenza' && <span className="tray-sort__count">{shameCount}</span>}
                                </button>
                            ))}
                        </div>
                        <label className="tray-check">
                            <input
                                type="checkbox"
                                checked={allShownSelected}
                                onChange={() =>
                                    setSelected(allShownSelected ? new Set() : new Set(shown.map((g) => g.appid)))
                                }
                            />
                            Seleccionar {shown.length === sorted.length ? 'todos' : 'los visibles'}
                        </label>
                    </div>

                    {sort === 'verguenza' && (
                        <p className="tray-note">
                            La lista de la vergüenza: juegos que tienes y nunca has abierto.
                        </p>
                    )}

                    <ul className="tray-list">
                        <AnimatePresence initial={false}>
                            {shown.map((game) => (
                                <motion.li
                                    key={game.appid}
                                    layout
                                    className={`tray-row glass ${selected.has(game.appid) ? 'is-selected' : ''}`}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
                                >
                                    <label className="tray-row__select">
                                        <input
                                            type="checkbox"
                                            checked={selected.has(game.appid)}
                                            onChange={() => toggle(game.appid)}
                                            aria-label={`Seleccionar ${game.name ?? game.appid}`}
                                        />
                                    </label>
                                    <div className="tray-row__cover">
                                        {game.header_image && <img src={game.header_image} alt="" loading="lazy" />}
                                    </div>
                                    <div className="tray-row__info">
                                        <p className="tray-row__name">{game.name ?? `App ${game.appid}`}</p>
                                        <p className="tray-row__meta">
                                            <span>
                                                <Clock size={12} aria-hidden /> {formatHours(game.playtime_forever)}
                                            </span>
                                            {game.achievements_total ? (
                                                <span>
                                                    <Trophy size={12} aria-hidden /> {game.achievements_unlocked ?? 0}/
                                                    {game.achievements_total}
                                                </span>
                                            ) : null}
                                            {game.steamspy_userscore !== null && (
                                                <span title="Valoraciones positivas en Steam">
                                                    {game.steamspy_userscore}% positivas
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="tray-row__actions">
                                        {ACTIONS.map((a) => (
                                            <Button
                                                key={a.status}
                                                type="button"
                                                size="sm"
                                                variant="secondary"
                                                className={`tray-action tray-action--${a.status}`}
                                                title={a.label}
                                                onClick={() => (a.status === 'completado' ? setCompleting(game) : classify([game], a.status))}
                                            >
                                                <a.icon aria-hidden />
                                                <span className="tray-action__label">{a.label}</span>
                                            </Button>
                                        ))}
                                    </div>
                                </motion.li>
                            ))}
                        </AnimatePresence>
                    </ul>

                    {sorted.length > visible && (
                        <div className="tray-more">
                            <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE)}>
                                Mostrar más ({sorted.length - visible})
                            </Button>
                        </div>
                    )}
                </>
            )}

            <AnimatePresence>
                {selectedGames.length > 0 && (
                    <motion.div
                        className="tray-batch glass"
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 24 }}
                    >
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
                                    title={a.label}
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
                    </motion.div>
                )}
            </AnimatePresence>

            <CompleteDialog
                game={completing}
                onOpenChange={(open) => !open && setCompleting(null)}
                onSaved={(appid) => {
                    setCompleting(null)
                    setGames((list) => list && list.filter((g) => g.appid !== appid))
                    setSelected((s) => new Set([...s].filter((id) => id !== appid)))
                }}
            />
        </div>
    )
}
