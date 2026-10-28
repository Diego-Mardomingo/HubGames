'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Flag, Play } from 'lucide-react'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import type { LibraryGame } from '@/lib/tracker'
import type { WishlistGame } from '@/lib/wishlist'
import { Button } from '@/components/ui/button'
import CompleteDialog from '@/components/tracker/CompleteDialog'
import type { PriceData } from '@/components/wishlist/PriceInfo'
import type { StorePrice } from '@/lib/store-price'

/**
 * Lo tuyo de un juego en su ficha: lo tienes (`ok`), no lo tienes (`no_lo_tienes`: quizá en Pendientes sin comprar o en
 * la wishlist) o no hay sesión. Lo comparten la cabecera (Jugar, Completar), el panel y la sección de logros.
 */
export type GameState =
    | { kind: 'cargando' }
    | { kind: 'sin_sesion' }
    | { kind: 'no_lo_tienes'; userId: string; pending: LibraryGame | null; wish: WishlistGame | null; price: PriceData | null }
    | { kind: 'ok'; userId: string; game: LibraryGame }

interface GameContextValue {
    appid: number
    name: string
    state: GameState
    /** Aplica cambios ya guardados al juego que tienes. */
    update: (patch: Partial<LibraryGame>) => void
    /** Vuelve a leer todo (tras añadir o quitar de Pendientes o de la wishlist). */
    reload: () => Promise<void>
    openComplete: () => void
}

const Ctx = createContext<GameContextValue | null>(null)

export function useGame(): GameContextValue {
    const value = useContext(Ctx)
    if (!value) throw new Error('useGame fuera de GameProvider')
    return value
}

const PRICE_COLUMNS =
    'price_initial, price_final, discount_percent, itad_id, steam_low, steam_low_at, all_low, all_low_shop, all_low_at'

export type { StorePrice }

/** Lo tuyo de un juego (la carga de la ficha). También lo usa el resultado de JUDI. */
export async function loadGameState(appid: number, store: StorePrice | null, isFree: boolean, comingSoon: boolean): Promise<GameState> {
    const {
        data: { session },
    } = await safeGetSession()
    if (!session) return { kind: 'sin_sesion' }
    const userId = session.user.id

    const { data: row } = await supabase.from('hubgames_library').select('*').eq('appid', appid).maybeSingle()
    const game = row as LibraryGame | null
    if (game?.owned) return { kind: 'ok', userId, game }

    const [{ data: wish }, { data: prices }] = await Promise.all([
        supabase.from('hubgames_wishlist').select('*').eq('appid', appid).maybeSingle(),
        game ? Promise.resolve({ data: null }) : supabase.from('hubgames_game_prices').select(PRICE_COLUMNS).eq('appid', appid).maybeSingle(),
    ])
    const base = { is_free: isFree, coming_soon: comingSoon }
    const price: PriceData | null = game
        ? game
        : wish
          ? (wish as WishlistGame)
          : prices
            ? { ...base, ...prices }
            : store
              ? {
                    ...base,
                    price_initial: store.initial,
                    price_final: store.final,
                    discount_percent: store.discount_percent,
                    itad_id: null,
                    steam_low: null,
                    steam_low_at: null,
                    all_low: null,
                    all_low_shop: null,
                    all_low_at: null,
                }
              : null
    return { kind: 'no_lo_tienes', userId, pending: game, wish: (wish as WishlistGame | null) ?? null, price }
}

export function GameProvider({
    appid,
    name,
    store,
    isFree,
    comingSoon,
    children,
}: {
    appid: number
    name: string
    store: StorePrice | null
    isFree: boolean
    comingSoon: boolean
    children: ReactNode
}) {
    const [state, setState] = useState<GameState>({ kind: 'cargando' })
    const [completing, setCompleting] = useState(false)

    const reload = useCallback(async () => {
        setState(await loadGameState(appid, store, isFree, comingSoon))
    }, [appid, store, isFree, comingSoon])

    useEffect(() => {
        let cancelled = false
        loadGameState(appid, store, isFree, comingSoon).then((s) => !cancelled && setState(s))
        return () => {
            cancelled = true
        }
    }, [appid, store, isFree, comingSoon])

    const update = useCallback((patch: Partial<LibraryGame>) => {
        setState((s) => (s.kind === 'ok' ? { ...s, game: { ...s.game, ...patch } } : s))
    }, [])

    const game = state.kind === 'ok' ? state.game : null

    return (
        <Ctx.Provider value={{ appid, name, state, update, reload, openComplete: () => setCompleting(true) }}>
            {children}
            <CompleteDialog
                games={completing && game ? [{ ...game, name }] : null}
                onClose={() => setCompleting(false)}
                onSaved={([{ completion }]) => {
                    // La ficha cambia detrás de la celebración; el diálogo se cierra al terminarla.
                    update({
                        status: 'completado',
                        status_source: 'manual',
                        suggestion: null,
                        rating: completion.rating,
                        completed_at: completion.completedAt,
                        review: completion.review,
                        favorite: completion.favorite,
                        endless: completion.endless,
                    })
                }}
            />
        </Ctx.Provider>
    )
}

/** Jugar y Completar, junto al título. Solo con el juego en tu biblioteca de Steam. */
export function GameHeaderActions() {
    const { appid, state, openComplete } = useGame()
    if (state.kind !== 'ok') return null
    return (
        <>
            <Button asChild>
                <a href={`steam://run/${appid}`}>
                    <Play aria-hidden /> Jugar
                </a>
            </Button>
            <Button variant="secondary" onClick={openComplete}>
                <Flag aria-hidden /> {state.game.status === 'completado' ? 'Editar nota' : 'Completar'}
            </Button>
        </>
    )
}
