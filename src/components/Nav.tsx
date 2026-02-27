'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function Nav() {
    const [user, setUser] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const pathname = usePathname()

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/'
        return pathname.startsWith(href)
    }

    useEffect(() => {
        // Check current session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            setIsLoading(false)
        })

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [])

    return (
        <>
            {/* Desktop header - visible only on desktop */}
            <header className="nav-header-desktop">
                <Link href="/">
                    <Image src="/img/HGLogo.webp" alt="HubGames Logo" width={60} height={60} priority />
                </Link>
            </header>

            {/* Navigation list - desktop horizontal top / mobile fixed bottom */}
            <nav className="nav-container" suppressHydrationWarning>
                <ul className="nav-list">
                    <li className={`nav-item ${isActive('/') ? 'nav-item-active' : ''}`}>
                        <Link href="/">
                            <i className="fa-solid fa-house" suppressHydrationWarning></i>
                            <span className="nav-label">Inicio</span>
                        </Link>
                    </li>
                    <li className={`nav-item nav-item-judi ${isActive('/judi') ? 'nav-item-active' : ''}`}>
                        <Link href="/judi">
                            <i className="fa-solid fa-gamepad" suppressHydrationWarning></i>
                            <span className="nav-label">JUDI</span>
                            <span className="nav-badge" suppressHydrationWarning>
                                <i className="fa-solid fa-star" suppressHydrationWarning></i>
                            </span>
                        </Link>
                    </li>
                    {!isLoading && user ? (
                        <>
                            {user.user_metadata?.administrador && (
                                <li className={`nav-item ${isActive('/administrar') ? 'nav-item-active' : ''}`}>
                                    <Link href="/administrar">
                                        <i className="fa-solid fa-screwdriver-wrench" suppressHydrationWarning></i>
                                        <span className="nav-label nav-label-full">Administrar</span>
                                        <span className="nav-label nav-label-short">Admin</span>
                                    </Link>
                                </li>
                            )}
                            <li className={`nav-item ${isActive('/perfil') ? 'nav-item-active' : ''}`}>
                                <Link href="/perfil">
                                    <i className="fa-solid fa-user" suppressHydrationWarning></i>
                                    <span className="nav-label nav-label-full">{user.user_metadata?.username || 'Perfil'}</span>
                                    <span className="nav-label nav-label-short">Perfil</span>
                                </Link>
                            </li>
                        </>
                    ) : (
                        <>
                            <li className={`nav-item ${isActive('/login') ? 'nav-item-active' : ''}`}>
                                <Link href="/login">
                                    <i className="fa-solid fa-right-to-bracket" suppressHydrationWarning></i>
                                    <span className="nav-label nav-label-full">Iniciar sesión</span>
                                    <span className="nav-label nav-label-short">Entrar</span>
                                </Link>
                            </li>
                            <li className={`nav-item ${isActive('/registro') ? 'nav-item-active' : ''}`}>
                                <Link href="/registro">
                                    <i className="fa-solid fa-user-plus" suppressHydrationWarning></i>
                                    <span className="nav-label nav-label-full">Registrarse</span>
                                    <span className="nav-label nav-label-short">Registro</span>
                                </Link>
                            </li>
                        </>
                    )}
                </ul>
            </nav>
        </>
    )
}
