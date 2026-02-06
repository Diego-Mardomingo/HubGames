'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        // Client-side validation
        if (!email || !password) {
            setError('Por favor completa todos los campos')
            setLoading(false)
            return
        }

        try {
            // First, try to find user in hubgames_usuarios
            const { data: userData, error: userError } = await supabase
                .from('hubgames_usuarios')
                .select('*')
                .eq('email', email)
                .single()

            if (userError || !userData) {
                setError('Email o contraseña incorrectos')
                setLoading(false)
                return
            }

            // Sign in with Supabase Auth
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (signInError) {
                if (signInError.message.includes('Invalid login credentials')) {
                    setError('Email o contraseña incorrectos')
                } else {
                    setError('Error al iniciar sesión. Por favor intenta de nuevo.')
                }
                setLoading(false)
                return
            }

            // Update user metadata with username and admin status
            if (data.user) {
                await supabase.auth.updateUser({
                    data: {
                        username: userData.username,
                        administrador: userData.administrador,
                    },
                })
            }

            // Redirect without forcing refresh
            router.push('/')
        } catch (err) {
            setError('Error al iniciar sesión')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            })

            if (error) {
                setError('Error al iniciar sesión con Google')
                console.error(error)
            }
        } catch (err) {
            setError('Error al iniciar sesión con Google')
            console.error(err)
        }
    }

    return (
        <div className="cuerpo">
            <h1 className="encabezado" style={{ textAlign: 'center', marginBottom: '1em', color: '#00171F' }}>
                Iniciar sesión
            </h1>

            <div style={{ maxWidth: '400px', margin: '0 auto', width: '100%' }}>
                <div className="boton_google" style={{ marginBottom: '1.5em' }}>
                    <button
                        onClick={handleGoogleLogin}
                        className="btn-primary"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5em' }}
                    >
                        <i className="fa-brands fa-google"></i>
                        Iniciar sesión con Google
                    </button>
                </div>

                <form onSubmit={handleLogin}>
                    <div className="credenciales" style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
                        <div className="email" style={{ position: 'relative' }}>
                            <input
                                type="email"
                                required
                                autoComplete="email"
                                name="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75em',
                                    paddingLeft: '2.5em',
                                    borderRadius: '5px',
                                    border: '2px solid #00171F',
                                    fontSize: '1em',
                                }}
                                placeholder="Email"
                            />
                            <i
                                className="fa-solid fa-at"
                                style={{ position: 'absolute', left: '0.8em', top: '50%', transform: 'translateY(-50%)', color: '#00171F' }}
                            ></i>
                        </div>

                        <div className="pass" style={{ position: 'relative' }}>
                            <input
                                type="password"
                                required
                                autoComplete="current-password"
                                name="pass"
                                id="pass"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.75em',
                                    paddingLeft: '2.5em',
                                    borderRadius: '5px',
                                    border: '2px solid #00171F',
                                    fontSize: '1em',
                                }}
                                placeholder="Contraseña"
                            />
                            <i
                                className="fa-solid fa-key"
                                style={{ position: 'absolute', left: '0.8em', top: '50%', transform: 'translateY(-50%)', color: '#00171F' }}
                            ></i>
                        </div>
                    </div>

                    {error && (
                        <div style={{ color: '#FF0000', textAlign: 'center', marginTop: '1em', fontWeight: 600 }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading}
                        style={{ width: '100%', marginTop: '1.5em' }}
                    >
                        {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                    </button>
                </form>

                <div className="enlace_alternativo" style={{ textAlign: 'center', marginTop: '1.5em', color: '#00171F' }}>
                    ¿No tienes cuenta aún?{' '}
                    <Link href="/registro" style={{ color: '#00A8E8', fontWeight: 700 }}>
                        Crea tu cuenta aquí
                    </Link>
                </div>
            </div>
        </div>
    )
}
