'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase, safeGetSession } from '@/lib/supabase/client'
import { Home, Trophy, User, Shield } from 'lucide-react'

const ADMIN_EMAIL = 'diego.lopez.mardomingo@gmail.com'

export default function Nav() {
    const [user, setUser] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const pathname = usePathname()

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/'
        return pathname.startsWith(href)
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

    const isAdmin = !isLoading && user?.email === ADMIN_EMAIL

    const navLinks = [
        { href: '/', label: 'Inicio', icon: Home },
        { href: '/ranking', label: 'Ranking', icon: Trophy },
    ]

    const perfilLabel = !isLoading && user
        ? user.user_metadata?.username || 'Perfil'
        : 'Perfil'
    const profileLink = { href: '/perfil', label: perfilLabel, icon: User }

    const allLinks = isAdmin
        ? [...navLinks, { href: '/admin', label: 'Admin', icon: Shield }, profileLink]
        : [...navLinks, profileLink]

    return (
        <>
            <div className="nav-mobile-top" suppressHydrationWarning>
                <Link href="/" className="nav-brand">
                    <Image src="/img/HGLogo.webp" alt="HubGames Logo" width={32} height={32} priority />
                    <span>HubGames</span>
                </Link>
            </div>
            <nav className="nav-shell" suppressHydrationWarning>
                <div className="nav-inner">
                    <Link href="/" className="nav-brand">
                        <Image src="/img/HGLogo.webp" alt="HubGames Logo" width={32} height={32} priority />
                        <span>HubGames</span>
                    </Link>
                    <div className="nav-menu">
                        {allLinks.map((link) => {
                            const Icon = link.icon
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`nav-link ${isActive(link.href) ? 'active' : ''}`}
                                >
                                    <Icon size={18} />
                                    <span>{link.label}</span>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </nav>
        </>
    )
}
