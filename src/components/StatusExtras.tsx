'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import {
    ArrowRight,
    Award,
    BarChart3,
    Check,
    Copy,
    Gamepad2,
    Heart,
    History,
    Home,
    Inbox,
    Library,
    LogIn,
    Search,
    Sparkles,
    Trophy,
    User,
    UserPlus,
    type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { openGameSearch } from '@/components/tracker/GameSearch'
import { statusDelay } from '@/components/StatusPage'
import { closestRoute } from '@/lib/routes'

const ROUTE_ICONS: Record<string, LucideIcon> = {
    '/': Home,
    '/biblioteca': Library,
    '/biblioteca/bandeja': Inbox,
    '/logros': Award,
    '/logros/historial': History,
    '/wishlist': Heart,
    '/estadisticas': BarChart3,
    '/estadisticas/resumen': Sparkles,
    '/judi': Gamepad2,
    '/ranking': Trophy,
    '/perfil': User,
    '/login': LogIn,
    '/registro': UserPlus,
}

/** La ruta pedida (recortada si es larga) y, si se parece a una de la app, «¿Querías decir…?». */
export function RouteHint() {
    const pathname = usePathname() ?? '/'
    let shown = pathname
    try {
        shown = decodeURI(pathname)
    } catch {
        // Ruta con % mal formado: se enseña tal cual
    }
    const suggestion = closestRoute(pathname)
    const Icon = suggestion ? (ROUTE_ICONS[suggestion.href] ?? ArrowRight) : null
    return (
        <>
            <span className="hg-status-path hg-enter" style={statusDelay(2)} title={shown}>
                hubgames<b>{shown}</b>
            </span>
            {suggestion && Icon && (
                <Link href={suggestion.href} className="hg-status-suggest hg-enter" style={statusDelay(3)}>
                    <span className="hg-status-suggest__icon">
                        <Icon aria-hidden />
                    </span>
                    <span className="hg-status-suggest__text">
                        ¿Querías decir <b>{suggestion.label}</b>?<small>{suggestion.href}</small>
                    </span>
                    <ArrowRight className="hg-status-suggest__go" aria-hidden />
                </Link>
            )}
        </>
    )
}

/** «Buscar un juego»: abre el buscador de Ctrl + K (solo existe con sesión). */
export function SearchGameButton({ variant = 'ghost' }: { variant?: 'default' | 'ghost' }) {
    return (
        <Button variant={variant} onClick={openGameSearch}>
            <Search aria-hidden /> Buscar un juego <kbd className="hg-status__kbd">Ctrl + K</kbd>
        </Button>
    )
}

/** El número de Steam de la URL de la ficha (la 404 de juego no recibe los parámetros). */
export function GameIdText() {
    const params = useParams<{ appid?: string }>()
    const raw = typeof params?.appid === 'string' ? decodeURIComponent(params.appid) : ''
    if (/^\d{1,10}$/.test(raw)) {
        return (
            <>
                No hay ningún juego de Steam con el número <b>{raw}</b> en el catálogo. Puede que el enlace esté mal o que el
                juego se haya retirado de la tienda.
            </>
        )
    }
    return <>Este enlace no lleva a ningún juego de Steam del catálogo. Puede que esté mal escrito.</>
}

/** Código del error (o la ruta y la hora) con botón Copiar: el check se dibuja y vuelve a «Copiar» en 1,5 s. */
export function CopyCode({ label, value, copyText }: { label: string; value: string; copyText: string }) {
    const [done, setDone] = useState(false)
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    useEffect(() => () => clearTimeout(timer.current), [])

    async function copy() {
        try {
            await navigator.clipboard.writeText(copyText)
        } catch {
            return
        }
        setDone(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setDone(false), 1500)
    }

    return (
        <div className="hg-status-code hg-enter" style={statusDelay(5)}>
            <span className="hg-status-code__text">
                <span className="hg-status-code__label">{label}</span>
                <span className="hg-status-code__value">{value}</span>
            </span>
            <button type="button" className={`hg-status-code__copy${done ? ' is-done' : ''}`} onClick={copy} aria-live="polite">
                {done ? <Check className="hg-draw" aria-hidden /> : <Copy aria-hidden />}
                {done ? 'Copiado' : 'Copiar'}
            </button>
        </div>
    )
}
