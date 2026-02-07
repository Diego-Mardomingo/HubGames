'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function Nav() {
    const [user, setUser] = useState<any>(null)
    const [showMenu, setShowMenu] = useState(false)
    const menuRef = useRef<HTMLUListElement>(null)

    useEffect(() => {
        // Check current session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
        })

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [])

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                const target = event.target as HTMLElement
                if (!target.closest('.barras')) {
                    setShowMenu(false)
                }
            }
        }

        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showMenu])

    return (
        <nav className="nav">
            <Link href="/">
                <Image src="/img/HGLogo.webp" alt="HubGames Logo" width={60} height={60} priority />
            </Link>

            <div className="barras" onClick={() => setShowMenu(!showMenu)}>
                <span>Menú</span>
                <i className={showMenu ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'}></i>
            </div>

            <ul
                ref={menuRef}
                className={`nav_list ${showMenu ? 'mostrar_menu' : ''}`}
            >
                <li className="nav_item" onClick={() => setShowMenu(false)}>
                    <Link href="/">
                        <i className="fa-solid fa-house"></i>
                        Inicio
                    </Link>
                </li>
                <li className="nav_item" onClick={() => setShowMenu(false)}>
                    <Link href="/judi">
                        <i className="fa-solid fa-gamepad"></i>
                        JUDI
                    </Link>
                </li>
                {user ? (
                    <>
                        {user.user_metadata?.administrador && (
                            <li className="nav_item" onClick={() => setShowMenu(false)}>
                                <Link href="/administrar">
                                    <i className="fa-solid fa-screwdriver-wrench"></i>
                                    Administrar
                                </Link>
                            </li>
                        )}
                        <li className="nav_item" onClick={() => setShowMenu(false)}>
                            <Link href="/perfil">
                                <i className="fa-solid fa-user"></i>
                                {user.user_metadata?.username || (user.email ? user.email.split('@')[0] : 'Usuario')}
                            </Link>
                        </li>
                    </>
                ) : (
                    <>
                        <li className="nav_item" onClick={() => setShowMenu(false)}>
                            <Link href="/login">
                                <i className="fa-solid fa-right-to-bracket"></i>
                                Iniciar sesión
                            </Link>
                        </li>
                        <li className="nav_item" onClick={() => setShowMenu(false)}>
                            <Link href="/registro">
                                <i className="fa-solid fa-user-plus"></i>
                                Registrarse
                            </Link>
                        </li>
                    </>
                )}
            </ul>
        </nav>
    )
}
