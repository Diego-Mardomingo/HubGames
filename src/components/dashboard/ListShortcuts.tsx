'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { moveListCount, type ListCountKey } from '@/lib/dashboard'
import { ChevronRight } from 'lucide-react'
import CountUp from '@/components/CountUp'

const LIST_SHORTCUTS: { key: ListCountKey; label: string }[] = [
    { key: 'jugando', label: 'Jugando' },
    { key: 'pendiente', label: 'Pendiente' },
    { key: 'pausado', label: 'Pausado' },
    { key: 'rejugable', label: 'Rejugable' },
    { key: 'completado', label: 'Completado' },
    { key: 'ya_jugado', label: 'Ya jugado' },
    { key: 'otros', label: 'Otros' },
    { key: 'bandeja', label: 'Bandeja' },
]

/** Lo emite quien mueve un juego de lista sin recargar el Inicio (aparcados, sale pronto); los atajos lo cuentan. */
const LIST_MOVE_EVENT = 'hubgames:list-move'

interface ListMove {
    from: string
    to: string
    /** 1 al mover; -1 al deshacer. */
    n: number
}

/** Un juego pasa de `from` a `to` (n = -1 lo deshace): el atajo de destino sube, el de origen baja y el de destino se ilumina. */
export function announceListMove(from: string, to: string, n: number = 1) {
    window.dispatchEvent(new CustomEvent<ListMove>(LIST_MOVE_EVENT, { detail: { from, to, n } }))
}

/** El atajo de una lista en la cabecera del Inicio, si se ve. */
function listShortcut(list: string): HTMLElement | null {
    const el = document.querySelector<HTMLElement>(`.home-lib [data-list="${list}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const nav = el.closest('.home-lib__bar')?.getBoundingClientRect()
    // En móvil los atajos se desplazan en horizontal: uno fuera de la franja no cuenta.
    const inside = !nav || (r.right > nav.left && r.left < nav.right)
    return r.width > 0 && inside && r.bottom > 0 && r.top < window.innerHeight ? el : null
}

/** Atajos a tus listas: una franja con un tramo por lista, tan ancho como lo que tiene, y la bandeja aparte. */
export default function ListShortcuts({ counts: initial, limit, style }: { counts: Record<ListCountKey, number>; limit: number; style?: CSSProperties }) {
    // Los cambios hechos en el Inicio se suman a lo que vino del servidor; al recargar (sincronizar), manda el servidor.
    const [base, setBase] = useState(initial)
    const [counts, setCounts] = useState(initial)
    if (base !== initial && JSON.stringify(base) !== JSON.stringify(initial)) {
        setBase(initial)
        setCounts(initial)
    }

    useEffect(() => {
        function onMove(e: Event) {
            const { from, to, n } = (e as CustomEvent<ListMove>).detail
            setCounts((c) => moveListCount(c, from, to, n))
            // El atajo al que llega el juego se ilumina un instante (con el contorno de su color) y su icono salta.
            const el = n > 0 ? listShortcut(to) : null
            if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
            const c = getComputedStyle(el).getPropertyValue('--c').trim() || 'currentColor'
            el.animate(
                [{ boxShadow: `0 0 0 0 ${c}` }, { boxShadow: `0 0 0 3px ${c}`, offset: 0.3 }, { boxShadow: '0 0 0 3px transparent' }],
                { duration: 500, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
            )
            el.querySelector('b')?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: 0.4 }, { transform: 'scale(1)' }], {
                duration: 300,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            })
        }
        window.addEventListener(LIST_MOVE_EVENT, onMove)
        return () => window.removeEventListener(LIST_MOVE_EVENT, onMove)
    }, [])

    const shelves = LIST_SHORTCUTS.filter((l) => l.key !== 'bandeja' && (l.key === 'jugando' || counts[l.key] > 0))
    const total = shelves.reduce((sum, l) => sum + counts[l.key], 0)
    return (
        <nav className="home-lib hg-enter" style={style} aria-label="Tus listas">
            {/* Cada tramo es tan ancho como su lista: la franja es la forma de tu biblioteca y a la vez la navegación */}
            <ul className="home-lib__bar">
                {shelves.map(({ key, label }) => {
                    const over = key === 'jugando' && counts.jugando > limit
                    return (
                        <li key={key} style={{ '--n': Math.max(1, counts[key]) } as CSSProperties}>
                            <Link
                                href={`/biblioteca?estado=${key}`}
                                className={`home-lib__seg st-${key}${over ? ' is-over' : ''}`}
                                data-list={key}
                                title={`Ver ${label.toLowerCase()} (${counts[key]} de ${total})`}
                            >
                                <span className="home-lib__label">
                                    {label}
                                    <ChevronRight aria-hidden />
                                </span>
                                <b>
                                    <CountUp value={counts[key]} />
                                    {key === 'jugando' && <small>/{limit}</small>}
                                </b>
                            </Link>
                        </li>
                    )
                })}
            </ul>
            {counts.bandeja > 0 && (
                <div className="home-lib__tray" data-list="bandeja">
                    <p>
                        <b>
                            <CountUp value={counts.bandeja} /> {counts.bandeja === 1 ? 'juego' : 'juegos'}
                        </b>
                        en la bandeja
                    </p>
                    <Link href="/biblioteca/bandeja" className="home-btn home-btn--inv">
                        Clasificar
                    </Link>
                </div>
            )}
        </nav>
    )
}
