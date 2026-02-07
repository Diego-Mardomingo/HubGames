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
        <div className="cuerpo" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem 1rem' }}>
            <div className="encabezado" style={{
                textAlign: 'center',
                marginBottom: '2em',
                background: 'transparent',
                color: '#fff',
            }}>
                <h1 style={{ margin: 0, color: '#00A8E8', fontSize: 'clamp(2rem, 5vw, 3em)', fontWeight: 800, letterSpacing: '-1px', textTransform: 'uppercase' }}>Bienvenido</h1>
                <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: '0.5rem', fontSize: '1.1rem' }}>Accede a tu cuenta de HubGames</p>
            </div>

            <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%' }}>
                <div className="glass-panel auth-card">
                    <div className="boton_google" style={{ marginBottom: '2.5em' }}>
                        <button
                            onClick={handleGoogleLogin}
                            className="btn-secondary"
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.8em',
                                minHeight: '56px',
                                fontSize: '1em',
                                fontWeight: 600,
                                background: 'rgba(255,255,255,0.05)',
                                color: '#fff',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}
                        >
                            <i className="fa-brands fa-google" style={{ fontSize: '1.2em' }}></i>
                            Continuar con Google
                        </button>
                    </div>

                    <div style={{ textAlign: 'center', margin: '2.5em 0', position: 'relative' }}>
                        <hr style={{ border: 'none', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }} />
                        <span style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            backgroundColor: '#050a0f',
                            padding: '0 1.5em',
                            color: 'rgba(255,255,255,0.4)',
                            fontSize: '0.85em',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '2px'
                        }}>o bien</span>
                    </div>

                    <form onSubmit={handleLogin} style={{ marginTop: '2.5em' }}>
                        <div className="credenciales" style={{ display: 'flex', flexDirection: 'column', gap: '2em' }}>
                            <div className="email" style={{ position: 'relative' }}>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginBottom: '0.6rem', fontWeight: 600, paddingLeft: '0.5rem' }}>EMAIL</label>
                                <div style={{ position: 'relative' }}>
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
                                            padding: '1.2em',
                                            paddingLeft: '3.5em',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            fontSize: '1em',
                                            backgroundColor: 'rgba(10, 20, 30, 0.4)',
                                            color: '#fff',
                                            outline: 'none',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                        placeholder="ejemplo@email.com"
                                    />
                                    <i
                                        className="fa-solid fa-at"
                                        style={{ position: 'absolute', left: '1.2em', top: '50%', transform: 'translateY(-50%)', color: '#00A8E8', fontSize: '1.1em', opacity: 0.7 }}
                                    ></i>
                                </div>
                            </div>

                            <div className="pass" style={{ position: 'relative' }}>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginBottom: '0.6rem', fontWeight: 600, paddingLeft: '0.5rem' }}>CONTRASEÑA</label>
                                <div style={{ position: 'relative' }}>
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
                                            padding: '1.2em',
                                            paddingLeft: '3.5em',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            fontSize: '1em',
                                            backgroundColor: 'rgba(10, 20, 30, 0.4)',
                                            color: '#fff',
                                            outline: 'none',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                        placeholder="••••••••"
                                    />
                                    <i
                                        className="fa-solid fa-key"
                                        style={{ position: 'absolute', left: '1.2em', top: '50%', transform: 'translateY(-50%)', color: '#00A8E8', fontSize: '1.1em', opacity: 0.7 }}
                                    ></i>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div style={{
                                color: '#ff4d4d',
                                backgroundColor: 'rgba(255, 77, 77, 0.08)',
                                padding: '1.2em',
                                borderRadius: '12px',
                                marginTop: '2.5em',
                                fontWeight: 600,
                                textAlign: 'center',
                                fontSize: '0.9em',
                                border: '1px solid rgba(255, 77, 77, 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}>
                                <i className="fa-solid fa-circle-exclamation"></i> {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading}
                            style={{
                                width: '100%',
                                marginTop: '3em',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                minHeight: '60px',
                                fontSize: '1.15em',
                                borderRadius: '30px',
                                letterSpacing: '0.5px'
                            }}
                        >
                            {loading ? <span className="loader" style={{ width: '25px', height: '25px', borderWidth: '4px' }}></span> : 'Entrar en HubGames'}
                        </button>
                    </form>

                    <div className="enlace_alternativo" style={{ textAlign: 'center', marginTop: '3em', color: 'rgba(255,255,255,0.4)', fontSize: '0.95em' }}>
                        ¿No tienes una cuenta?{' '}
                        <Link href="/registro" style={{ color: '#00A8E8', fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s', marginLeft: '0.3rem' }}>
                            Crea una ahora
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
