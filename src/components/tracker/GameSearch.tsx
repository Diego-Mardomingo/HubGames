'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Heart, ListPlus, Loader2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { STATUS_LABELS, setGamesStatus, type GameStatus } from '@/lib/tracker'
import type { SteamSearchResult } from '@/app/api/steam/search/route'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import './tracker.css'

const DEBOUNCE_MS = 250

/** Abre el buscador desde cualquier sitio (botones de la nav y de la biblioteca). */
export const OPEN_SEARCH_EVENT = 'hubgames:open-search'

export function openGameSearch() {
    window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))
}

/**
 * Buscador de juegos de Steam (#20), con Ctrl+K (o ⌘K). Marca los que ya tienes y los pasa a pendientes con un clic.
 * Los que no tienes irán a la wishlist (#35).
 */
export default function GameSearch() {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const onKey = (e: globalThis.KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                setOpen((o) => !o)
            }
        }
        const onOpen = () => setOpen(true)
        window.addEventListener('keydown', onKey)
        window.addEventListener(OPEN_SEARCH_EVENT, onOpen)
        return () => {
            window.removeEventListener('keydown', onKey)
            window.removeEventListener(OPEN_SEARCH_EVENT, onOpen)
        }
    }, [])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="game-search" aria-describedby={undefined}>
                <DialogTitle className="sr-only">Buscar un juego de Steam</DialogTitle>
                {/* Se monta al abrir: cada apertura empieza con el buscador vacío. */}
                {open && <SearchBody onNavigate={() => setOpen(false)} />}
            </DialogContent>
        </Dialog>
    )
}

function SearchBody({ onNavigate }: { onNavigate: () => void }) {
    const router = useRouter()
    const [term, setTerm] = useState('')
    const [results, setResults] = useState<SteamSearchResult[]>([])
    const [owned, setOwned] = useState<Map<number, GameStatus>>(new Map())
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [active, setActive] = useState(0)
    const [saving, setSaving] = useState<number | null>(null)
    const listRef = useRef<HTMLUListElement>(null)

    useEffect(() => {
        const q = term.trim()
        if (q.length < 2) return
        const controller = new AbortController()
        const timer = setTimeout(async () => {
            setLoading(true)
            setError('')
            try {
                const res = await fetch(`/api/steam/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
                const body = await res.json()
                if (!res.ok) throw new Error(body.error ?? 'No se pudo buscar')
                const found: SteamSearchResult[] = body.results
                const { data } = found.length
                    ? await supabase.from('hubgames_user_games').select('appid, status').in('appid', found.map((r) => r.appid))
                    : { data: [] }
                if (controller.signal.aborted) return
                setOwned(new Map((data ?? []).map((r) => [r.appid, r.status as GameStatus])))
                setResults(found)
                setActive(0)
            } catch (e) {
                if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'No se pudo buscar')
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }, DEBOUNCE_MS)
        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [term])

    const shown = term.trim().length < 2 ? [] : results

    function goTo(appid: number) {
        onNavigate()
        router.push(`/juego/${appid}`)
    }

    async function toBacklog(appid: number) {
        setSaving(appid)
        setError('')
        try {
            await setGamesStatus([appid], 'pendiente')
            setOwned((m) => new Map(m).set(appid, 'pendiente'))
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo guardar')
        } finally {
            setSaving(null)
        }
    }

    function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (shown.length === 0) return
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const next = (active + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length
            setActive(next)
            listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
        } else if (e.key === 'Enter') {
            e.preventDefault()
            goTo(shown[active].appid)
        }
    }

    return (
        <>
            <label className="game-search__field">
                {loading ? <Loader2 className="game-search__spin" size={18} aria-hidden /> : <Search size={18} aria-hidden />}
                <input
                    autoFocus
                    type="text"
                    enterKeyHint="search"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Busca cualquier juego de Steam…"
                    aria-label="Buscar un juego de Steam"
                    aria-controls="game-search-results"
                    aria-activedescendant={shown.length ? `game-search-${shown[active]?.appid}` : undefined}
                />
                <kbd>Esc</kbd>
            </label>

            {error && (
                <p className="alert alert--error" role="alert">
                    {error}
                </p>
            )}

            {term.trim().length >= 2 && !loading && shown.length === 0 && !error && <p className="game-search__hint">Sin resultados.</p>}
            {term.trim().length < 2 && (
                <p className="game-search__hint">
                    Escribe el nombre de un juego. <kbd>↑</kbd> <kbd>↓</kbd> para moverte y <kbd>Enter</kbd> para abrir su ficha.
                </p>
            )}

            {shown.length > 0 && (
                <ul id="game-search-results" ref={listRef} className="game-search__results" role="listbox" aria-label="Resultados">
                    {shown.map((r, i) => {
                        const status = owned.get(r.appid)
                        return (
                            <li
                                key={r.appid}
                                id={`game-search-${r.appid}`}
                                role="option"
                                aria-selected={i === active}
                                className={`game-search__item ${i === active ? 'is-active' : ''}`}
                                onMouseEnter={() => setActive(i)}
                            >
                                <button type="button" className="game-search__open" onClick={() => goTo(r.appid)}>
                                    {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de 231 px del CDN de Steam */}
                                    {r.image ? <img src={r.image} alt="" loading="lazy" /> : <span className="game-search__noimg" />}
                                    <span className="game-search__text">
                                        <span className="game-search__name">{r.name}</span>
                                        <span className="game-search__meta">
                                            {status ? (
                                                <span className={`lib-status lib-status--${status}`}>{STATUS_LABELS[status]}</span>
                                            ) : (
                                                <span>No lo tienes</span>
                                            )}
                                            {r.price && <span>{r.price}</span>}
                                            {r.discount && <span className="game-search__discount">-{r.discount}%</span>}
                                        </span>
                                    </span>
                                </button>
                                {status === 'pendiente' ? (
                                    <span className="game-search__done">
                                        <Check size={14} aria-hidden /> En pendientes
                                    </span>
                                ) : status ? (
                                    <Button size="sm" variant="secondary" disabled={saving === r.appid} onClick={() => toBacklog(r.appid)}>
                                        <ListPlus aria-hidden /> Añadir a pendientes
                                    </Button>
                                ) : (
                                    <Button size="sm" variant="ghost" disabled title="Llegará con la wishlist (#35)">
                                        <Heart aria-hidden /> Wishlist
                                    </Button>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}
        </>
    )
}
