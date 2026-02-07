'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

export default function RegistroPage() {
    const router = useRouter()
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        // Client-side validations
        if (!username || !email || !password || !confirmPassword) {
            setError('Por favor completa todos los campos')
            setLoading(false)
            return
        }

        if (username.length < 3) {
            setError('El username debe tener al menos 3 caracteres')
            setLoading(false)
            return
        }

        // Validate passwords match
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden')
            setLoading(false)
            return
        }

        // Validate password length
        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres')
            setLoading(false)
            return
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            setError('Por favor ingresa un email válido')
            setLoading(false)
            return
        }

        try {
            // Check if email or username already exists
            const { data: existingUserEmail } = await supabase
                .from('hubgames_usuarios')
                .select('email')
                .eq('email', email)
                .maybeSingle()

            if (existingUserEmail) {
                setError('Este email ya está registrado')
                setLoading(false)
                return
            }

            const { data: existingUserUsername } = await supabase
                .from('hubgames_usuarios')
                .select('username')
                .eq('username', username)
                .maybeSingle()

            if (existingUserUsername) {
                setError('Este username ya está en uso')
                setLoading(false)
                return
            }

            // Sign up with Supabase Auth (no email verification)
            const { data: authData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: undefined, // No email verification
                    data: {
                        username,
                        administrador: false,
                    },
                },
            })

            if (signUpError) {
                if (signUpError.message.includes('already registered')) {
                    setError('Este email ya está registrado')
                } else if (signUpError.message.includes('disabled')) {
                    setError('El registro por email está desactivado en la configuración del servidor')
                } else {
                    setError(signUpError.message || 'Error al crear la cuenta. Por favor intenta de nuevo.')
                }
                setLoading(false)
                return
            }

            if (!authData.user) {
                setError('Error al crear la cuenta')
                setLoading(false)
                return
            }

            // Insert user into hubgames_usuarios table
            const { error: insertError } = await supabase.from('hubgames_usuarios').insert({
                id: authData.user.id,
                username,
                email,
                password_hash: 'auth_managed', // Satisfy DB constraint (managed by Supabase Auth)
                email_verificado: true, // No email verification required
                fecha_creacion: new Date().toISOString(),
                cuenta_google: false,
                administrador: false,
            })

            if (insertError) {
                console.error('Error inserting user profile:', insertError)
                setError('Error al crear el perfil de usuario: ' + insertError.message)
                setLoading(false)
                return
            }

            // Auto sign in after registration - redirect without forced refresh
            router.push('/')
        } catch (err: any) {
            setError(err.message || 'Error al crear la cuenta')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleRegister = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            })

            if (error) {
                setError('Error al registrarse con Google')
                console.error(error)
            }
        } catch (err) {
            setError('Error al registrarse con Google')
            console.error(err)
        }
    }

    return (
        <div className="cuerpo" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '3rem 1rem' }}>
            <div className="encabezado" style={{
                textAlign: 'center',
                marginBottom: '2.5em',
                background: 'transparent',
                color: '#fff',
            }}>
                <h1 style={{ margin: 0, color: '#00A8E8', fontSize: '3em', fontWeight: 800, letterSpacing: '-1px', textTransform: 'uppercase' }}>Crea tu cuenta</h1>
                <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: '0.5rem', fontSize: '1.1rem' }}>Únete a la mayor comunidad de HubGames</p>
            </div>

            <div style={{ maxWidth: '500px', margin: '0 auto', width: '100%' }}>
                <div className="glass-panel" style={{
                    padding: '3.5em',
                    borderRadius: '24px',
                }}>
                    <div className="boton_google" style={{ marginBottom: '2.5em' }}>
                        <button
                            onClick={handleGoogleRegister}
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
                            Registrarse con Google
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

                    <form onSubmit={handleRegister} style={{ marginTop: '2.5em' }}>
                        <div className="credenciales" style={{ display: 'flex', flexDirection: 'column', gap: '1.8em' }}>
                            <div style={{ position: 'relative' }}>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginBottom: '0.5rem', fontWeight: 600, paddingLeft: '0.5rem' }}>USUARIO</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        required
                                        autoComplete="username"
                                        name="username"
                                        id="username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
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
                                        placeholder="Tu apodo"
                                    />
                                    <i
                                        className="fa-solid fa-user"
                                        style={{ position: 'absolute', left: '1.2em', top: '50%', transform: 'translateY(-50%)', color: '#00A8E8', fontSize: '1.1em', opacity: 0.7 }}
                                    ></i>
                                </div>
                            </div>

                            <div style={{ position: 'relative' }}>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginBottom: '0.5rem', fontWeight: 600, paddingLeft: '0.5rem' }}>EMAIL</label>
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

                            <div style={{ position: 'relative' }}>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginBottom: '0.5rem', fontWeight: 600, paddingLeft: '0.5rem' }}>CONTRASEÑA</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="password"
                                        required
                                        autoComplete="new-password"
                                        name="password"
                                        id="password"
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

                            <div style={{ position: 'relative' }}>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginBottom: '0.5rem', fontWeight: 600, paddingLeft: '0.5rem' }}>CONFIRMAR</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="password"
                                        required
                                        autoComplete="new-password"
                                        name="confirmPassword"
                                        id="confirmPassword"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
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
                                marginTop: '2em',
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
                            {loading ? <span className="loader" style={{ width: '25px', height: '25px', borderWidth: '4px' }}></span> : 'Unirme a HubGames'}
                        </button>
                    </form>

                    <div className="enlace_alternativo" style={{ textAlign: 'center', marginTop: '3em', color: 'rgba(255,255,255,0.4)', fontSize: '0.95em' }}>
                        ¿Ya eres miembro?{' '}
                        <Link href="/login" style={{ color: '#00A8E8', fontWeight: 700, textDecoration: 'none', marginLeft: '0.3rem' }}>
                            Inicia sesión aquí
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
