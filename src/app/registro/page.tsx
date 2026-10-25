'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock, Mail, UserRound, UserRoundPlus } from 'lucide-react'
import AuthShell, { FormError } from '@/components/AuthShell'

function GoogleIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
    )
}

export default function RegistroPage() {
    const router = useRouter()
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleRegister = async (event: React.FormEvent) => {
        event.preventDefault()
        setLoading(true)
        setError('')

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
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden')
            setLoading(false)
            return
        }
        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres')
            setLoading(false)
            return
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            setError('Por favor ingresa un email válido')
            setLoading(false)
            return
        }

        try {
            // El email repetido no se comprueba antes (#63): lo detecta signUp.
            const { data: usernameAvailable } = await supabase.rpc('hubgames_username_available', {
                p_username: username,
            })
            if (usernameAvailable === false) {
                setError('Este username ya está en uso')
                setLoading(false)
                return
            }

            const { data: authData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: undefined,
                    data: { username },
                },
            })
            // Con confirmación por email, Supabase devuelve un usuario sin identidades en vez del error.
            if (signUpError?.code === 'user_already_exists' || authData.user?.identities?.length === 0) {
                setError('Este email ya está registrado')
                setLoading(false)
                return
            }
            if (signUpError || !authData.user) {
                setError(signUpError?.message || 'Error al crear la cuenta')
                setLoading(false)
                return
            }

            router.push('/')
        } catch (err: any) {
            console.error(err)
            setError(err.message || 'Error al crear la cuenta')
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleRegister = async () => {
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        })
        if (oauthError) setError('Error al registrarse con Google')
    }

    return (
        <AuthShell title="Crea tu cuenta" subtitle="Únete a HubGames y compite cada día en el ranking.">
            <Button variant="secondary" onClick={handleGoogleRegister} className="btn-block">
                <GoogleIcon />
                Registrarse con Google
            </Button>

            <div className="divider-text">o con tu email</div>

            <form onSubmit={handleRegister} style={{ display: 'grid', gap: '0.9rem' }}>
                <div className="field">
                    <label className="field__label" htmlFor="reg-username">Nombre de usuario</label>
                    <div className="field__control">
                        <UserRound size={16} className="field__icon" />
                        <Input id="reg-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Tu alias" autoComplete="username" />
                    </div>
                </div>
                <div className="field">
                    <label className="field__label" htmlFor="reg-email">Email</label>
                    <div className="field__control">
                        <Mail size={16} className="field__icon" />
                        <Input id="reg-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" autoComplete="email" />
                    </div>
                </div>
                <div className="auth__row">
                    <div className="field">
                        <label className="field__label" htmlFor="reg-password">Contraseña</label>
                        <div className="field__control">
                            <Lock size={16} className="field__icon" />
                            <Input id="reg-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete="new-password" />
                        </div>
                    </div>
                    <div className="field">
                        <label className="field__label" htmlFor="reg-confirm">Confirmar</label>
                        <div className="field__control">
                            <Lock size={16} className="field__icon" />
                            <Input id="reg-confirm" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="••••••••" autoComplete="new-password" />
                        </div>
                    </div>
                </div>
                <FormError message={error} />
                <Button type="submit" disabled={loading} className="btn-block">
                    {loading ? 'Creando cuenta...' : (
                        <>
                            <UserRoundPlus size={16} data-icon="inline-start" aria-hidden />
                            Crear cuenta
                        </>
                    )}
                </Button>
            </form>

            <p className="auth__switch">
                ¿Ya tienes cuenta?{' '}
                <Link href="/login" className="link">Inicia sesión</Link>
            </p>
        </AuthShell>
    )
}
