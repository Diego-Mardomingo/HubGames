'use client'

import Link from 'next/link'
import { useState, useEffect, useSyncExternalStore, type MouseEvent } from 'react'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import { persistJudiHomeScrollYFromWindow } from '@/lib/judi-home-scroll'
import { LogoMark, Wordmark } from '@/components/brand/Logo'
import {
    Home,
    Gamepad2,
    Trophy,
    User,
    Shield,
    LogIn,
    Library,
    Search,
    Award,
    Heart,
    BarChart3,
    Inbox,
    Tag,
    Clock,
    Check,
    X,
    PanelLeftClose,
    PanelLeftOpen,
    type LucideIcon,
} from 'lucide-react'
import { countTray, TRACKER_CHANGED_EVENT } from '@/lib/tracker'
import { JUDI_CHANGED_EVENT } from '@/lib/judi'
import type { JudiTodayState } from '@/lib/dashboard'
import { loadJudiToday, loadWishlistDeals, type WishlistDeal } from '@/lib/nav-status'
import { isSidebarCollapsed, setSidebarCollapsed, subscribeSidebar } from '@/lib/sidebar'
import GameSearch, { openGameSearch } from '@/components/tracker/GameSearch'
import SearchShortcut, { useSearchShortcut } from '@/components/tracker/SearchShortcut'
import AnimatedCount from '@/components/AnimatedCount'
import ThemeToggle from '@/components/ThemeToggle'

type NavKey = 'home' | 'lib' | 'ach' | 'wish' | 'stats' | 'judi' | 'rank' | 'admin'
type NavLink = { key: NavKey; href: string; label: string; icon: LucideIcon; desktopOnly?: boolean }
type NavGroup = { title: string | null; links: NavLink[] }

/** Estado del JUDI de hoy en la navegación: icono + palabra (en la barra plegada y las pestañas, solo el icono). */
const JUDI_INDICATOR: Partial<Record<JudiTodayState, { tone: string; icon: LucideIcon; text: string; label: string }>> = {
    pendiente: { tone: 'nav-ind--warn', icon: Clock, text: 'Hoy', label: 'JUDI de hoy sin jugar' },
    en_curso: { tone: 'nav-ind--warn', icon: Clock, text: 'Hoy', label: 'JUDI de hoy a medias' },
    acertado: { tone: 'nav-ind--ok', icon: Check, text: 'Acertado', label: 'JUDI de hoy acertado' },
    fallado: { tone: 'nav-ind--ko', icon: X, text: 'Fallado', label: 'JUDI de hoy fallado' },
}

const upTo99 = (n: number) => (n > 99 ? '99+' : String(n))

export default function Nav() {
    const [user, setUser] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isAdminUser, setIsAdminUser] = useState(false)
    const [scrolled, setScrolled] = useState(false)
    const [trayCount, setTrayCount] = useState(0)
    const [dealGames, setDealGames] = useState<WishlistDeal[]>([])
    const [judiState, setJudiState] = useState<JudiTodayState>('sin_juego')
    const pathname = usePathname()
    const shortcut = useSearchShortcut()
    // En el servidor, desplegada: la preferencia guardada la aplica el script de <head> antes de pintar (sidebar.ts).
    const collapsed = useSyncExternalStore(subscribeSidebar, isSidebarCollapsed, () => false)

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/'
        return pathname.startsWith(href)
    }

    /** Segundo tap en Inicio/logo estando ya en home: subir la lista con scroll suave. */
    const handleHomeLinkClick = (e: MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
    }

    /** Antes de ir a ranking/perfil/etc. desde `/judi`, guardar Y (la transición puede poner scroll en 0 y corromper sessionStorage). */
    const handleLeaveHomeNavClick = () => {
        if (pathname === '/judi') persistJudiHomeScrollYFromWindow()
    }

    /** pointerdown va antes que el click de Next; así capturamos la Y real antes de cualquier reset del router. */
    const handleLeaveHomePointerDownCapture = () => {
        handleLeaveHomeNavClick()
    }

    useEffect(() => {
        safeGetSession()
            .then(({ data: { session } }) => {
                setUser(session?.user ?? null)
                setIsLoading(false)
            })
            .catch(() => {
                setUser(null)
                setIsLoading(false)
            })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [])

    useEffect(() => {
        if (!user) {
            setIsAdminUser(false)
            return
        }
        let cancelled = false
        supabase.rpc('is_admin').then(({ data }) => {
            if (!cancelled) setIsAdminUser(data === true)
        })
        return () => { cancelled = true }
    }, [user])

    // Contador de la bandeja: al iniciar sesión, al navegar y cuando se clasifica un juego.
    useEffect(() => {
        if (!user) return
        let cancelled = false
        const refresh = () => countTray().then((n) => { if (!cancelled) setTrayCount(n) })
        refresh()
        window.addEventListener(TRACKER_CHANGED_EVENT, refresh)
        return () => {
            cancelled = true
            window.removeEventListener(TRACKER_CHANGED_EVENT, refresh)
        }
    }, [user, pathname])

    // Juegos de la wishlist en mínimo histórico: al iniciar sesión y al navegar (los precios se actualizan a diario).
    // La misma lista llega al buscador, que la enseña antes de escribir.
    useEffect(() => {
        if (!user) return
        let cancelled = false
        loadWishlistDeals().then((list) => { if (!cancelled) setDealGames(list) })
        return () => { cancelled = true }
    }, [user, pathname])

    // JUDI de hoy: con o sin sesión, al navegar y tras cada intento.
    useEffect(() => {
        if (isLoading) return
        let cancelled = false
        const refresh = () => loadJudiToday(Boolean(user)).then((s) => { if (!cancelled) setJudiState(s) })
        refresh()
        window.addEventListener(JUDI_CHANGED_EVENT, refresh)
        return () => {
            cancelled = true
            window.removeEventListener(JUDI_CHANGED_EVENT, refresh)
        }
    }, [user, isLoading, pathname])

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8)
        onScroll()
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    const signedIn = !isLoading && Boolean(user)
    const isAdmin = !isLoading && isAdminUser
    const tray = signedIn ? trayCount : 0
    const deals = signedIn ? dealGames.length : 0
    const judi = JUDI_INDICATOR[judiState]
    const username: string | null = !isLoading && user ? user.user_metadata?.username || null : null
    const initial = (username || user?.email || '?')[0]?.toUpperCase()

    const groups: NavGroup[] = [
        { title: null, links: [{ key: 'home', href: '/', label: 'Inicio', icon: Home }] },
        ...(user
            ? [
                  {
                      title: 'Tu colección',
                      links: [
                          { key: 'lib', href: '/biblioteca', label: 'Biblioteca', icon: Library },
                          { key: 'ach', href: '/logros', label: 'Logros', icon: Award },
                          // En móvil no caben en la barra inferior: se llega desde la biblioteca y desde "Tu año".
                          { key: 'wish', href: '/wishlist', label: 'Wishlist', icon: Heart, desktopOnly: true },
                          { key: 'stats', href: '/estadisticas', label: 'Estadísticas', icon: BarChart3, desktopOnly: true },
                      ] satisfies NavLink[],
                  },
              ]
            : []),
        {
            title: 'Juego diario',
            links: [
                { key: 'judi', href: '/judi', label: 'JUDI', icon: Gamepad2 },
                { key: 'rank', href: '/ranking', label: 'Ranking', icon: Trophy },
            ],
        },
        ...(isAdmin ? [{ title: 'Administración', links: [{ key: 'admin', href: '/admin', label: 'Admin', icon: Shield }] satisfies NavLink[] }] : []),
    ]

    // Móvil: como mucho 6 pestañas; Admin va a la barra superior.
    const mobileLinks: NavLink[] = [
        ...groups.flatMap((g) => g.links).filter((link) => !link.desktopOnly && link.key !== 'admin'),
        user
            ? { key: 'home', href: '/perfil', label: 'Perfil', icon: User }
            : { key: 'home', href: '/login', label: 'Entrar', icon: LogIn },
    ]

    /** Indicador de un enlace: cápsula con icono y cifra o palabra; en la barra plegada y las pestañas, en la esquina. */
    const indicator = (key: NavKey) => {
        if (key === 'lib' && tray > 0) {
            return (
                <AnimatedCount value={tray} format={upTo99} className="nav-ind nav-ind--tray hg-tint st-bandeja" aria-label={`${tray} en la bandeja`}>
                    <Inbox className="nav-ind__icon" aria-hidden />
                </AnimatedCount>
            )
        }
        if (key === 'wish' && deals > 0) {
            return (
                <AnimatedCount value={deals} format={upTo99} className="nav-ind nav-ind--deal" aria-label={`${deals} en mínimo histórico`}>
                    <Tag className="nav-ind__icon" aria-hidden />
                </AnimatedCount>
            )
        }
        if (key === 'judi' && judi) {
            const Icon = judi.icon
            return (
                <span key={judiState} className={`nav-ind nav-ind--state hg-tint ${judi.tone}`} aria-label={judi.label}>
                    <Icon className="nav-ind__icon" aria-hidden />
                    <span className="nav-ind__text" aria-hidden>{judi.text}</span>
                </span>
            )
        }
        return null
    }

    const linkHandlers = (href: string) => {
        const isListLink = href === '/' || href === '/judi'
        return {
            scroll: !isListLink,
            onPointerDownCapture: isListLink ? undefined : handleLeaveHomePointerDownCapture,
            onClick: isListLink ? (href === pathname ? handleHomeLinkClick : undefined) : handleLeaveHomeNavClick,
        }
    }

    const brand = (
        <Link href="/" scroll={false} className="nav-brand" onClick={pathname === '/' ? handleHomeLinkClick : undefined} aria-label="HubGames, inicio">
            <LogoMark size={22} animated />
            <Wordmark />
        </Link>
    )

    const pill = (
        <motion.span layoutId="nav-pill" className="nav-link__pill" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
    )

    const profileActive = isActive('/perfil')
    const accountChip = isLoading ? (
        <span className="nav-account nav-account--ghost" aria-hidden />
    ) : user ? (
        <Link
            href="/perfil"
            {...linkHandlers('/perfil')}
            className={`nav-account ${profileActive ? 'active' : ''}`}
            aria-current={profileActive ? 'page' : undefined}
            title="Mi perfil"
        >
            {profileActive && pill}
            <span className="nav-account__avatar" aria-hidden>{initial}</span>
            <span className="nav-account__text">
                <span className="nav-account__name">{username || 'Perfil'}</span>
                <span className="nav-account__meta">Ver perfil</span>
            </span>
        </Link>
    ) : (
        <>
            <p className="nav-cta-hint">Entra para tener tu biblioteca de Steam y tus logros.</p>
            <Link href="/login" {...linkHandlers('/login')} className="nav-cta" title="Entrar">
                <LogIn size={16} aria-hidden />
                <span className="nav-cta__label">Entrar</span>
            </Link>
        </>
    )

    const searchButton = signedIn ? (
        <button
            type="button"
            className="nav-search"
            onClick={openGameSearch}
            aria-label={`Buscar un juego (${shortcut})`}
            aria-keyshortcuts="Control+K Meta+K"
            title={`Buscar un juego (${shortcut})`}
        >
            <Search size={16} aria-hidden />
            <span className="nav-search__label">Buscar juego</span>
            <SearchShortcut className="nav-search__kbd" />
        </button>
    ) : null

    const collapseLabel = collapsed ? 'Desplegar la barra lateral' : 'Plegar la barra lateral'
    const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose

    return (
        <>
            {signedIn ? <GameSearch deals={dealGames} /> : null}

            {/* Móvil: barra superior con marca + cuenta */}
            <header className={`nav-mobile-top ${scrolled ? 'is-scrolled' : ''}`} suppressHydrationWarning>
                {brand}
                <div className="nav-right">
                    {searchButton}
                    <ThemeToggle compact />
                    {isAdmin ? (
                        <Link
                            href="/admin"
                            {...linkHandlers('/admin')}
                            className={`nav-top-icon ${isActive('/admin') ? 'active' : ''}`}
                            aria-label="Admin"
                            aria-current={isActive('/admin') ? 'page' : undefined}
                            title="Admin"
                        >
                            <Shield size={19} aria-hidden />
                        </Link>
                    ) : null}
                    {signedIn ? (
                        <Link
                            href="/perfil"
                            {...linkHandlers('/perfil')}
                            className={`nav-account nav-account--compact ${profileActive ? 'active' : ''}`}
                            aria-label="Mi perfil"
                        >
                            <span className="nav-account__avatar">{initial}</span>
                        </Link>
                    ) : null}
                </div>
            </header>

            {/* Escritorio: barra lateral fija (plegada por debajo de 1100 px o a mano) */}
            <aside id="nav-side" className="nav-side" suppressHydrationWarning>
                {brand}
                {searchButton}
                <nav className="nav-menu" aria-label="Principal">
                    {groups.map((group) => (
                        <div key={group.title ?? 'inicio'} className="nav-group">
                            {group.title ? <p className="nav-group__title">{group.title}</p> : null}
                            {group.links.map((link) => {
                                const Icon = link.icon
                                const active = isActive(link.href)
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        {...linkHandlers(link.href)}
                                        className={`nav-link ${active ? 'active' : ''}`}
                                        aria-current={active ? 'page' : undefined}
                                        title={link.label}
                                    >
                                        {active && pill}
                                        <Icon size={18} className="nav-link__icon" aria-hidden />
                                        <span className="nav-link__label">{link.label}</span>
                                        {indicator(link.key)}
                                    </Link>
                                )
                            })}
                        </div>
                    ))}
                </nav>
                <div className="nav-side__foot">
                    <div className="nav-side__tools">
                        <ThemeToggle className="nav-side__theme" />
                        <ThemeToggle compact className="nav-side__theme-compact" />
                        <button
                            type="button"
                            className="nav-collapse"
                            onClick={() => setSidebarCollapsed(!collapsed)}
                            aria-label={collapseLabel}
                            aria-expanded={!collapsed}
                            aria-controls="nav-side"
                            title={collapseLabel}
                        >
                            <CollapseIcon size={18} aria-hidden />
                        </button>
                    </div>
                    {accountChip}
                </div>
            </aside>

            {/* Móvil: tab bar inferior */}
            <nav className="nav-tabbar" aria-label="Principal móvil" suppressHydrationWarning>
                {mobileLinks.map((link) => {
                    const Icon = link.icon
                    const active = isActive(link.href)
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            {...linkHandlers(link.href)}
                            className={`nav-tab ${active ? 'active' : ''}`}
                            aria-current={active ? 'page' : undefined}
                        >
                            {active && (
                                <motion.span
                                    layoutId="tab-pill"
                                    className="nav-tab__pill"
                                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                                />
                            )}
                            <span className="nav-tab__icon">
                                <Icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden />
                                {indicator(link.key)}
                            </span>
                            <span className="nav-tab__label">{link.label}</span>
                        </Link>
                    )
                })}
            </nav>
        </>
    )
}
