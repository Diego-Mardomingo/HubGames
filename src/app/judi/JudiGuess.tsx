'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { RefreshCw, Search, SkipForward, Trophy, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { nextOption, type JudiAttempt } from '@/lib/judi'
import { Button } from '@/components/ui/button'
import AnimatedCount from '@/components/AnimatedCount'
import { useShake } from '@/components/AuthShell'

type Option = { id: number; name: string }

/** Mismo criterio que hubgames_judi_normalize: sin tildes, minúsculas y solo letras y números. */
export function normalizeGameName(value: string) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

/** Resalta lo escrito dentro del nombre (si aparece tal cual, sin contar tildes ni mayúsculas). */
function Highlight({ name, query }: { name: string; query: string }) {
    const q = query.trim().toLowerCase()
    const i = q ? name.toLowerCase().indexOf(q) : -1
    if (i < 0) return <>{name}</>
    return (
        <>
            {name.slice(0, i)}
            <mark>{name.slice(i, i + q.length)}</mark>
            {name.slice(i + q.length)}
        </>
    )
}

/**
 * Campo «¿Qué juego es?»: busca en el pool de JUDI, ↑/↓ mueve el resaltado (saltando los ya probados) e Intro elige el
 * resaltado (nunca envía el texto a medias). «Saltar» al lado, con su coste. Al fallar, el campo tiembla (`missKey`).
 */
export default function JudiGuess({
    tried,
    attempts,
    exact,
    stake,
    checking,
    checkingName,
    error,
    missKey,
    freshAttempt,
    onSubmit,
    onSkip,
    onRetry,
}: {
    /** Nombres ya probados (para «Ya probado»). */
    tried: string[]
    attempts: JudiAttempt[]
    exact: boolean
    stake: number
    checking: boolean
    checkingName: string | null
    error: string | null
    missKey: number
    /** Índice del intento recién añadido (entra con un pop). */
    freshAttempt: number | null
    onSubmit: (name: string) => void
    onSkip: () => void
    onRetry: () => void
}) {
    const id = useId()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<Option[]>([])
    const [searching, setSearching] = useState(false)
    const [open, setOpen] = useState(false)
    const [hl, setHl] = useState(-1)
    const inputRef = useRef<HTMLInputElement>(null)
    const [shakeRef, shake] = useShake<HTMLDivElement>()

    const triedSet = new Set(tried.map(normalizeGameName))
    const triedFlags = results.map((r) => triedSet.has(normalizeGameName(r.name)))

    useEffect(() => {
        if (query.trim().length < 2) return
        let cancelled = false
        const timer = setTimeout(async () => {
            setSearching(true)
            const { data } = await supabase.rpc('hubgames_judi_search_pool', { p_query: query.trim() })
            if (cancelled) return
            const next = (data ?? []).map((item: { steam_appid: number; game_name: string }) => ({ id: item.steam_appid, name: item.game_name }))
            setResults(next)
            setSearching(false)
            const flags = next.map((r) => triedSet.has(normalizeGameName(r.name)))
            setHl(nextOption(flags, -1, 1))
        }, 300)
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
        // triedSet cambia en cada render; basta con la búsqueda.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query])

    // Fallo: el campo tiembla y se vacía.
    const lastMiss = useRef(missKey)
    useEffect(() => {
        if (missKey === lastMiss.current) return
        lastMiss.current = missKey
        shake()
    }, [missKey, shake])

    // Tras comprobar, el foco vuelve al campo para seguir escribiendo.
    const wasChecking = useRef(checking)
    useEffect(() => {
        if (wasChecking.current && !checking) {
            setQuery('')
            setResults([])
            setOpen(false)
            inputRef.current?.focus({ preventScroll: true })
        }
        wasChecking.current = checking
    }, [checking])

    function pick(option: Option | undefined) {
        if (!option || checking || triedSet.has(normalizeGameName(option.name))) return
        setOpen(false)
        onSubmit(option.name)
    }

    function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (results.length === 0) return
            e.preventDefault()
            setOpen(true)
            const next = nextOption(triedFlags, hl, e.key === 'ArrowDown' ? 1 : -1)
            if (next >= 0) setHl(next)
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (open && hl >= 0) pick(results[hl])
        } else if (e.key === 'Escape') {
            setOpen(false)
        }
    }

    const showList = open && query.trim().length >= 2 && !checking
    const listId = `${id}-list`

    return (
        <div className="jd-guess-block">
            <div className="jd-panel__head">
                <label className="jd-panel__title" htmlFor={`${id}-input`}>
                    ¿Qué juego es?
                </label>
                <AnimatedCount value={stake} format={(n) => `+${n} si aciertas`} className="jd-stake hg-tint st-todos">
                    <Trophy aria-hidden />
                </AnimatedCount>
            </div>
            <div ref={shakeRef} className="jd-guess">
                <Search size={16} className="jd-guess__icon" aria-hidden />
                <input
                    ref={inputRef}
                    id={`${id}-input`}
                    type="text"
                    className="hg-input jd-guess__input"
                    value={checking ? (checkingName ?? '') : query}
                    onChange={(e) => {
                        setQuery(e.target.value)
                        setOpen(true)
                        if (e.target.value.trim().length < 2) setResults([])
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    onKeyDown={onKeyDown}
                    placeholder="Escribe el nombre del juego"
                    disabled={checking}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    role="combobox"
                    aria-expanded={showList}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={showList && hl >= 0 ? `${id}-opt-${hl}` : undefined}
                />
                {(searching || checking) && <span className="jd-guess__spinner" aria-hidden />}
                {showList && (results.length > 0 || !searching) && (
                    <ul id={listId} className="jd-guess__dropdown soft-scrollbar" role="listbox" aria-label="Juegos">
                        {results.length === 0 ? (
                            <li className="jd-guess__empty">Ningún juego del pool coincide con «{query.trim()}».</li>
                        ) : (
                            results.map((option, i) => {
                                const isTried = triedFlags[i]
                                return (
                                    <li key={option.id} role="presentation">
                                        <button
                                            id={`${id}-opt-${i}`}
                                            type="button"
                                            role="option"
                                            aria-selected={i === hl}
                                            aria-disabled={isTried}
                                            disabled={isTried}
                                            className={`jd-guess__option${i === hl ? ' is-hl' : ''}`}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onMouseEnter={() => !isTried && setHl(i)}
                                            onClick={() => pick(option)}
                                        >
                                            <span className="jd-guess__name">
                                                <Highlight name={option.name} query={query} />
                                            </span>
                                            {isTried ? (
                                                <span className="jd-guess__tag hg-tint ko">
                                                    <X aria-hidden strokeWidth={3} /> Ya probado
                                                </span>
                                            ) : i === hl ? (
                                                <kbd className="hg-kbd jd-guess__key">Intro</kbd>
                                            ) : null}
                                        </button>
                                    </li>
                                )
                            })
                        )}
                    </ul>
                )}
            </div>
            {error && (
                <div className="alert alert--error jd-guess__error" role="alert">
                    <span className="alert__body">
                        <span>No se ha podido comprobar{checkingName ? ` «${checkingName}»` : ' el intento'}.</span>
                        <span className="alert__sub">No has perdido el intento. Vuelve a probar.</span>
                    </span>
                    <Button size="sm" variant="secondary" onClick={onRetry}>
                        <RefreshCw aria-hidden /> Reintentar
                    </Button>
                </div>
            )}
            <div className="jd-guess__row">
                <p className="jd-guess__help">Cada fallo o salto abre otra captura y una pista.</p>
                <Button size="sm" variant="ghost" onClick={onSkip} disabled={checking} title="Pierdes un intento sin elegir título">
                    <SkipForward aria-hidden /> Saltar <span className="jd-guess__cost">(−1 intento)</span>
                </Button>
            </div>
            {attempts.length > 0 && (
                <div className="jd-tries">
                    <h2 className="jd-panel__title">Tus intentos</h2>
                    {exact ? (
                        <ul className="jd-tries__list" aria-label="Tus intentos">
                            {attempts.map((a, i) => (
                                <li key={i} className={`jd-try jd-try--${a.kind}${freshAttempt === i ? ' jd-fx-chip' : ''}`}>
                                    <span className="jd-try__icon">{a.kind === 'miss' ? <X aria-hidden strokeWidth={3} /> : <SkipForward aria-hidden strokeWidth={3} />}</span>
                                    <span className="jd-try__name">{a.kind === 'miss' ? a.name : 'Saltado'}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <>
                            {tried.length > 0 && (
                                <ul className="jd-tries__list" aria-label="Nombres probados">
                                    {tried.map((name, i) => (
                                        <li key={`${name}-${i}`} className="jd-try jd-try--miss">
                                            <span className="jd-try__icon">
                                                <X aria-hidden strokeWidth={3} />
                                            </span>
                                            <span className="jd-try__name">{name}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <p className="jd-tries__sum">
                                {attempts.length} {attempts.length === 1 ? 'intento sin acertar' : 'intentos sin acertar'}
                                {tried.length < attempts.length ? ' (fallos y saltos de antes, sin orden)' : ''}
                            </p>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
