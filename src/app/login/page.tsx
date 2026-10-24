'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowRight, Mail, Lock } from 'lucide-react'
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

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (new URLSearchParams(window.location.search).get('error') === 'oauth') {
            setError('No se pudo completar el inicio de sesión con Google. Inténtalo de nuevo.')
        }
    }, [])

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault()
        setLoading(true)
        setError('')
        if (!email || !password) {
            setError('Por favor completa todos los campos')
            setLoading(false)
            return
        }

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
            if (signInError) {
                setError(signInError.message.includes('Invalid login credentials')
                    ? 'Email o contraseña incorrectos'
                    : 'Error al iniciar sesión. Inténtalo de nuevo.')
                setLoading(false)
                return
            }

            if (data.user) {
                const { data: profile } = await supabase
                    .from('hubgames_usuarios')
                    .select('username')
                    .eq('id', data.user.id)
                    .maybeSingle()
                if (profile?.username && profile.username !== data.user.user_metadata?.username) {
                    await supabase.auth.updateUser({ data: { username: profile.username } })
                }
            }
            router.push('/')
        } catch (err) {
            console.error(err)
            setError('Error al iniciar sesión')
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        })
        if (oauthError) setError('Error al iniciar sesión con Google')
    }

    return (
        <AuthShell title="Bienvenido de nuevo" subtitle="Inicia sesión para guardar tu progreso y entrar en el ranking.">
            <Button variant="secondary" onClick={handleGoogleLogin} className="btn-block">
                <GoogleIcon />
                Continuar con Google
            </Button>

            <div className="divider-text">o con tu email</div>

            <form onSubmit={handleLogin} style={{ display: 'grid', gap: '0.9rem' }}>
                <div className="field">
                    <label className="field__label" htmlFor="login-email">Email</label>
                    <div className="field__control">
                        <Mail size={16} className="field__icon" />
                        <Input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" />
                    </div>
                </div>
                <div className="field">
                    <label className="field__label" htmlFor="login-password">Contraseña</label>
                    <div className="field__control">
                        <Lock size={16} className="field__icon" />
                        <Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
                    </div>
                </div>
                <FormError message={error} />
                <Button type="submit" disabled={loading} className="btn-block">
                    {loading ? 'Entrando...' : (
                        <>
                            Entrar
                            <ArrowRight size={16} data-icon="inline-end" aria-hidden />
                        </>
                    )}
                </Button>
            </form>

            <p className="auth__switch">
                ¿No tienes cuenta?{' '}
                <Link href="/registro" className="link">Regístrate gratis</Link>
            </p>
        </AuthShell>
    )
}
