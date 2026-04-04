'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertTriangle, Lock, Mail, UserRound, UserRoundPlus } from 'lucide-react'

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

            const { data: authData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: undefined,
                    data: { username, administrador: false },
                },
            })
            if (signUpError || !authData.user) {
                setError(signUpError?.message || 'Error al crear la cuenta')
                setLoading(false)
                return
            }

            const { error: insertError } = await supabase.from('hubgames_usuarios').insert({
                id: authData.user.id,
                username,
                email,
                password_hash: 'auth_managed',
                email_verificado: true,
                fecha_creacion: new Date().toISOString(),
                cuenta_google: false,
                administrador: false,
            })
            if (insertError) {
                setError(`Error al crear el perfil: ${insertError.message}`)
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100dvh - 160px)' }}>
            <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: 420, padding: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ marginBottom: 20 }}>
                    <h1 style={{ margin: '0 0 4px', fontSize: '1.125rem', fontWeight: 700 }}>Crea tu cuenta</h1>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.8125rem' }}>Únete a HubGames y compite en el ranking</p>
                </div>

                <Button variant="secondary" onClick={handleGoogleRegister} style={{ width: '100%', height: 40, fontSize: '0.8125rem' }}>
                    <GoogleIcon />
                    Registrarse con Google
                </Button>

                <div className="divider-text" style={{ margin: '16px 0' }}>o</div>

                <form onSubmit={handleRegister} style={{ display: 'grid', gap: 12 }}>
                    <div style={{ display: 'grid', gap: 4 }}>
                        <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Username</label>
                        <div style={{ position: 'relative' }}>
                            <UserRound size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                            <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Tu alias" style={{ paddingLeft: 32, height: 38 }} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gap: 4 }}>
                        <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" style={{ paddingLeft: 32, height: 38 }} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ display: 'grid', gap: 4 }}>
                            <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Contraseña</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" style={{ paddingLeft: 32, height: 38 }} />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gap: 4 }}>
                            <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Confirmar</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                                <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="••••••••" style={{ paddingLeft: 32, height: 38 }} />
                            </div>
                        </div>
                    </div>
                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)', fontSize: '0.75rem', padding: '8px 10px', borderRadius: 'var(--radius)', background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.12)' }}>
                            <AlertTriangle size={13} />
                            {error}
                        </div>
                    )}
                    <Button type="submit" disabled={loading} style={{ height: 40, fontSize: '0.8125rem' }}>
                        {loading ? 'Creando cuenta...' : (
                            <>
                                <UserRoundPlus size={15} data-icon="inline-start" aria-hidden />
                                Crear cuenta
                            </>
                        )}
                    </Button>
                </form>

                <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted)', marginTop: 16, marginBottom: 0 }}>
                    ¿Ya tienes cuenta?{' '}
                    <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Inicia sesión</Link>
                </p>
            </div>
        </div>
    )
}
