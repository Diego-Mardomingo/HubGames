'use client'

import Link from 'next/link'
import { useState, useEffect, type MouseEvent } from 'react'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import { persistJudiHomeScrollYFromWindow } from '@/lib/judi-home-scroll'
import { LogoMark, Wordmark } from '@/components/brand/Logo'
import { Home, Gamepad2, Trophy, User, Shield, LogIn } from 'lucide-react'

const ADMIN_EMAIL = 'diego.lopez.mardomingo@gmail.com'

export default function Nav() {
    const [user, setUser] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [scrolled, setScrolled] = useState(false)
    const pathname = usePathname()

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
        const onScroll = () => setScrolled(window.scrollY > 8)
        onScroll()
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    const isAdmin = !isLoading && user?.email === ADMIN_EMAIL
    const username: string | null = !isLoading && user ? user.user_metadata?.username || null : null
    const initial = (username || user?.email || '?')[0]?.toUpperCase()

    const navLinks = [
        { href: '/', label: 'Inicio', icon: Home },
        { href: '/judi', label: 'JUDI', icon: Gamepad2 },
        { href: '/ranking', label: 'Ranking', icon: Trophy },
        ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: Shield }] : []),
    ]

    const mobileLinks = [
        ...navLinks,
        user
            ? { href: '/perfil', label: 'Perfil', icon: User }
            : { href: '/login', label: 'Entrar', icon: LogIn },
    ]

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
            <LogoMark size={30} animated />
            <Wordmark />
        </Link>
    )

    const accountChip = isLoading ? (
        <span className="nav-account nav-account--ghost" aria-hidden />
    ) : user ? (
        <Link
            href="/perfil"
            {...linkHandlers('/perfil')}
            className={`nav-account ${isActive('/perfil') ? 'active' : ''}`}
            aria-label="Mi perfil"
        >
            <span className="nav-account__avatar">{initial}</span>
            <span className="nav-account__name">{username || 'Perfil'}</span>
        </Link>
    ) : (
        <Link href="/login" {...linkHandlers('/login')} className="nav-cta btn-shine">
            <LogIn size={15} aria-hidden />
            Entrar
        </Link>
    )

    return (
        <>
            {/* Móvil: barra superior con marca + cuenta */}
            <header className={`nav-mobile-top ${scrolled ? 'is-scrolled' : ''}`} suppressHydrationWarning>
                {brand}
                {user && !isLoading ? (
                    <Link href="/perfil" {...linkHandlers('/perfil')} className="nav-account nav-account--compact" aria-label="Mi perfil">
                        <span className="nav-account__avatar">{initial}</span>
                    </Link>
                ) : null}
            </header>

            {/* Escritorio: barra flotante de cristal */}
            <header className={`nav-shell ${scrolled ? 'is-scrolled' : ''}`} suppressHydrationWarning>
                <div className="nav-inner">
                    {brand}
                    <nav className="nav-menu" aria-label="Principal">
                        {navLinks.map((link) => {
                            const Icon = link.icon
                            const active = isActive(link.href)
                            return (
                                <Link key={link.href} href={link.href} {...linkHandlers(link.href)} className={`nav-link ${active ? 'active' : ''}`}>
                                    {active && (
                                        <motion.span
                                            layoutId="nav-pill"
                                            className="nav-link__pill"
                                            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                                        />
                                    )}
                                    <Icon size={16} className="nav-link__icon" />
                                    <span>{link.label}</span>
                                </Link>
                            )
                        })}
                    </nav>
                    <div className="nav-right">{accountChip}</div>
                </div>
            </header>

            {/* Móvil: tab bar inferior */}
            <nav className="nav-tabbar" aria-label="Principal móvil" suppressHydrationWarning>
                {mobileLinks.map((link) => {
                    const Icon = link.icon
                    const active = isActive(link.href)
                    return (
                        <Link key={link.href} href={link.href} {...linkHandlers(link.href)} className={`nav-tab ${active ? 'active' : ''}`}>
                            {active && (
                                <motion.span
                                    layoutId="tab-pill"
                                    className="nav-tab__pill"
                                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                                />
                            )}
                            <motion.span className="nav-tab__icon" whileTap={{ scale: 0.82 }}>
                                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                            </motion.span>
                            <span className="nav-tab__label">{link.label}</span>
                        </Link>
                    )
                })}
            </nav>
        </>
    )
}
