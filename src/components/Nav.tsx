'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function Nav() {
    const [user, setUser] = useState<any>(null)
    const [showMenu, setShowMenu] = useState(false)

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

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setUser(null)
    }

    return (
        <nav className="nav">
            <Link href="/">
                <Image src="/img/HGLogo.webp" alt="HubGames Logo" width={80} height={80} priority />
            </Link>

            <div className="barras" onClick={() => setShowMenu(!showMenu)}>
                <span>Menú</span>
                <i className={showMenu ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'}></i>
            </div>

            <ul className={`nav_list ${showMenu ? 'mostrar_menu' : ''}`} onClick={() => setShowMenu(false)}>
                <li className="nav_item">
                    <Link href="/">Inicio</Link>
                </li>
                <li className="nav_item">
                    <Link href="/judi">JUDI</Link>
                </li>
                <li className="nav_item">
                    <Link href="/chats">Chats</Link>
                </li>
                {user ? (
                    <>
                        {user.user_metadata?.administrador && (
                            <li className="nav_item">
                                <Link href="/administrar">Administrar</Link>
                            </li>
                        )}
                        <li className="nav_item">
                            <span style={{ color: '#00A8E8' }}>
                                {user.user_metadata?.username || (user.email ? user.email.split('@')[0] : 'Usuario')}
                            </span>
                        </li>
                        <li className="nav_item">
                            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                                Cerrar sesión
                            </button>
                        </li>
                    </>
                ) : (
                    <>
                        <li className="nav_item">
                            <Link href="/login">Iniciar sesión</Link>
                        </li>
                        <li className="nav_item">
                            <Link href="/registro">Registrarse</Link>
                        </li>
                    </>
                )}
            </ul>
        </nav>
    )
}
