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

        try {
            // Check if email already exists
            const { data: existingUser } = await supabase
                .from('hubgames_usuarios')
                .select('email')
                .eq('email', email)
                .single()

            if (existingUser) {
                setError('Este email ya está registrado')
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
                setError(signUpError.message)
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
                password_hash: null, // Supabase Auth handles password
                email_verificado: true, // No email verification required
                fecha_creacion: new Date().toISOString(),
                cuenta_google: false,
                administrador: false,
            })

            if (insertError) {
                console.error('Error inserting user:', insertError)
                // Continue anyway as auth user was created
            }

            // Auto sign in after registration
            router.push('/')
            router.refresh()
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
        <div className="cuerpo">
            <h1 className="encabezado" style={{ textAlign: 'center', marginBottom: '1em', color: '#00171F' }}>
                Crear cuenta
            </h1>

            <div style={{ maxWidth: '400px', margin: '0 auto', width: '100%' }}>
                <div className="boton_google" style={{ marginBottom: '1.5em' }}>
                    <button
                        onClick={handleGoogleRegister}
                        className="btn-primary"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5em' }}
                    >
                        <i className="fa-brands fa-google"></i>
                        Registrarse con Google
                    </button>
                </div>

                <form onSubmit={handleRegister}>
                    <div className="credenciales" style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
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
                                    padding: '0.75em',
                                    paddingLeft: '2.5em',
                                    borderRadius: '5px',
                                    border: '2px solid #00171F',
                                    fontSize: '1em',
                                }}
                                placeholder="Nombre de usuario"
                            />
                            <i
                                className="fa-solid fa-user"
                                style={{ position: 'absolute', left: '0.8em', top: '50%', transform: 'translateY(-50%)', color: '#00171F' }}
                            ></i>
                        </div>

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
                                    padding: '0.75em',
                                    paddingLeft: '2.5em',
                                    borderRadius: '5px',
                                    border: '2px solid #00171F',
                                    fontSize: '1em',
                                }}
                                placeholder="Confirmar contraseña"
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
                        {loading ? 'Creando cuenta...' : 'Crear cuenta'}
                    </button>
                </form>

                <div className="enlace_alternativo" style={{ textAlign: 'center', marginTop: '1.5em', color: '#00171F' }}>
                    ¿Ya tienes cuenta?{' '}
                    <Link href="/login" style={{ color: '#00A8E8', fontWeight: 700 }}>
                        Inicia sesión aquí
                    </Link>
                </div>
            </div>
        </div>
    )
}
