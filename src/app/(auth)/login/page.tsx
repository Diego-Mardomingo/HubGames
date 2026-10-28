'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SaveButton, type SaveState } from '@/components/SaveButton'
import { ArrowRight, Mail } from 'lucide-react'
import { AuthForm, FormError, PasswordField, authEnter, useShake } from '@/components/AuthShell'
import {
    CREDENTIALS_MESSAGE,
    OAUTH_RETURN_MESSAGE,
    OAUTH_START_MESSAGE,
    missingFieldsMessage,
    signInErrorMessage,
    welcomeMessage,
    type AuthErrorLike,
    type AuthField,
    type AuthMessage,
} from '@/lib/auth-messages'

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

type LoginField = Extract<AuthField, 'email' | 'password'>
const NO_FIELDS: Record<LoginField, boolean> = { email: false, password: false }

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [state, setState] = useState<SaveState>('idle')
    const [googleBusy, setGoogleBusy] = useState(false)
    const [message, setMessage] = useState<AuthMessage | null>(null)
    const [invalid, setInvalid] = useState(NO_FIELDS)
    const [formRef, shake] = useShake<HTMLFormElement>()
    const emailRef = useRef<HTMLInputElement>(null)
    const passwordRef = useRef<HTMLInputElement>(null)
    const busy = state !== 'idle' || googleBusy

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (params.get('error') === 'oauth') setMessage(OAUTH_RETURN_MESSAGE)
        // Desde «Ya hay una cuenta con este email» del registro: el email ya escrito y el foco en la contraseña
        const prefill = params.get('email')
        if (prefill) {
            setEmail(prefill)
            passwordRef.current?.focus()
        }
    }, [])

    /** Muestra un error: marca sus campos, sacude el formulario y lleva el foco donde hay que corregir. */
    const fail = (msg: AuthMessage) => {
        setMessage(msg)
        setInvalid({ email: msg.fields?.includes('email') ?? false, password: msg.fields?.includes('password') ?? false })
        shake()
        // Credenciales: la contraseña seleccionada para reescribirla; si falta algo, el primer campo vacío
        const field = msg === CREDENTIALS_MESSAGE ? 'password' : msg.fields?.[0]
        // Tras «Entrando…» los campos aún están desactivados en este render: el foco, en el siguiente fotograma
        requestAnimationFrame(() => {
            if (field === 'email') emailRef.current?.focus()
            if (field === 'password') {
                passwordRef.current?.focus()
                passwordRef.current?.select()
            }
        })
    }

    /** Al escribir en un campo marcado se desmarca, y el aviso se va. */
    const edit = (field: LoginField, value: string) => {
        if (field === 'email') setEmail(value)
        else setPassword(value)
        if (invalid[field]) setInvalid((prev) => ({ ...prev, [field]: false }))
        if (message && message.tone !== 'ok') setMessage(null)
    }

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault()
        if (busy) return
        const missing = missingFieldsMessage(email, password)
        if (missing) {
            fail(missing)
            return
        }
        setMessage(null)
        setInvalid(NO_FIELDS)
        setState('saving')
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
            if (error) {
                setState('idle')
                fail(signInErrorMessage(error, navigator.onLine))
                return
            }

            let username: string | null = data.user?.user_metadata?.username ?? null
            if (data.user) {
                const { data: profile } = await supabase
                    .from('hubgames_usuarios')
                    .select('username')
                    .eq('id', data.user.id)
                    .maybeSingle()
                if (profile?.username && profile.username !== data.user.user_metadata?.username) {
                    await supabase.auth.updateUser({ data: { username: profile.username } })
                }
                username = profile?.username ?? username
            }
            setState('done')
            setMessage(welcomeMessage(username))
            router.push('/')
        } catch (err) {
            console.error(err)
            setState('idle')
            fail(signInErrorMessage(err as AuthErrorLike, navigator.onLine))
        }
    }

    const handleGoogleLogin = async () => {
        setMessage(null)
        setGoogleBusy(true)
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        })
        if (oauthError) {
            setGoogleBusy(false)
            setMessage(OAUTH_START_MESSAGE)
        }
    }

    return (
        <AuthForm title="Hola de nuevo" subtitle="Entra para ver tu biblioteca, tus logros y tu progreso en JUDI.">
            <Button variant="secondary" onClick={handleGoogleLogin} loading={googleBusy} disabled={busy} className="btn-block hg-enter" style={authEnter(1)}>
                {googleBusy ? 'Abriendo Google…' : (
                    <>
                        <GoogleIcon />
                        Continuar con Google
                    </>
                )}
            </Button>

            <div className="divider-text hg-enter" style={authEnter(2)}>o con tu email</div>

            <form ref={formRef} onSubmit={handleLogin} className="auth__fields hg-enter" style={authEnter(3)} noValidate>
                <div className={`field${invalid.email ? ' is-bad' : ''}`}>
                    <label className="field__label" htmlFor="login-email">Email</label>
                    <div className="field__control">
                        <Mail size={16} className="field__icon" aria-hidden />
                        <Input
                            ref={emailRef}
                            id="login-email"
                            type="email"
                            inputMode="email"
                            enterKeyHint="next"
                            autoComplete="email"
                            value={email}
                            onChange={(event) => edit('email', event.target.value)}
                            placeholder="tu@email.com"
                            disabled={busy}
                            aria-invalid={invalid.email || undefined}
                            aria-describedby="login-msg"
                        />
                    </div>
                </div>
                <PasswordField
                    id="login-password"
                    label="Contraseña"
                    value={password}
                    onChange={(value) => edit('password', value)}
                    autoComplete="current-password"
                    enterKeyHint="go"
                    invalid={invalid.password}
                    disabled={busy}
                    describedBy="login-msg"
                    inputRef={passwordRef}
                />
                <FormError id="login-msg" message={message} />
                <SaveButton
                    type="submit"
                    state={state}
                    done="Dentro"
                    saving="Entrando…"
                    disabled={googleBusy}
                    className="btn-block auth__submit"
                >
                    Entrar
                    <ArrowRight size={16} data-icon="inline-end" aria-hidden />
                </SaveButton>
            </form>

            <p className="auth__switch hg-enter" style={authEnter(4)}>
                ¿No tienes cuenta?{' '}
                <Link href="/registro" className="link">Regístrate gratis</Link>
            </p>
        </AuthForm>
    )
}
