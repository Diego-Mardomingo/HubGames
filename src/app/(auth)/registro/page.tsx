'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SaveButton, type SaveState } from '@/components/SaveButton'
import { FieldRules, FieldStatus, useUsernameCheck } from '@/components/AccountFields'
import { Mail, UserRound, UserRoundPlus } from 'lucide-react'
import { AuthForm, FormError, PasswordField, authEnter, useShake } from '@/components/AuthShell'
import { PASSWORD_MIN, USERNAME_MIN, emailLooksValid, passwordMismatch, passwordRules } from '@/lib/account'
import {
    OAUTH_START_MESSAGE,
    emailTakenMessage,
    registerIssues,
    registerIssuesMessage,
    signUpErrorMessage,
    signUpWelcomeMessage,
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

const NO_FIELDS: Record<AuthField, boolean> = { username: false, email: false, password: false, confirm: false }

export default function RegistroPage() {
    const router = useRouter()
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [state, setState] = useState<SaveState>('idle')
    const [googleBusy, setGoogleBusy] = useState(false)
    const [message, setMessage] = useState<AuthMessage | null>(null)
    /** Campos marcados por el último envío (o por el servidor); se desmarcan al escribir en ellos. */
    const [invalid, setInvalid] = useState(NO_FIELDS)
    /** Has intentado enviar: los requisitos que faltan pasan a rojo. */
    const [submitted, setSubmitted] = useState(false)
    /** El email se comprueba al salir del campo, no a la primera letra. */
    const [emailBlurred, setEmailBlurred] = useState(false)
    const { avail, onChange: checkName, checkNow } = useUsernameCheck()
    const [formRef, shake] = useShake<HTMLFormElement>()
    const usernameRef = useRef<HTMLInputElement>(null)
    const emailRef = useRef<HTMLInputElement>(null)
    const passwordRef = useRef<HTMLInputElement>(null)
    const confirmRef = useRef<HTMLInputElement>(null)
    const busy = state !== 'idle' || googleBusy

    const rules = passwordRules(password, confirm)
    const mismatch = passwordMismatch(password, confirm)
    const emailBad = emailBlurred && !!email.trim() && !emailLooksValid(email)
    const marked = {
        username: invalid.username || avail === 'taken',
        email: invalid.email || emailBad,
        password: invalid.password,
        confirm: invalid.confirm || mismatch,
    }

    /** Muestra un error: marca sus campos, sacude el formulario y lleva el foco al primero. */
    const fail = (msg: AuthMessage, select = false) => {
        setMessage(msg)
        const next = { ...NO_FIELDS }
        msg.fields?.forEach((f) => (next[f] = true))
        setInvalid(next)
        shake()
        const first = msg.fields?.[0]
        // Tras «Creando cuenta…» los campos aún están desactivados en este render: el foco, en el siguiente fotograma
        requestAnimationFrame(() => {
            const el = { username: usernameRef, email: emailRef, password: passwordRef, confirm: confirmRef }[first ?? 'username'].current
            if (!first) return
            el?.focus()
            if (select) el?.select()
        })
    }

    /** Al escribir en un campo marcado se desmarca, y el aviso se va. */
    const edit = (field: AuthField, value: string) => {
        if (field === 'username') {
            setUsername(value)
            checkName(value)
        }
        if (field === 'email') {
            setEmail(value)
            setEmailBlurred(false)
        }
        if (field === 'password') setPassword(value)
        if (field === 'confirm') setConfirm(value)
        if (invalid[field]) setInvalid((prev) => ({ ...prev, [field]: false }))
        if (message && message.tone !== 'ok') setMessage(null)
    }

    const handleRegister = async (event: React.FormEvent) => {
        event.preventDefault()
        if (busy) return
        // El nombre se comprueba ya (sin esperar a los 400 ms) para no enviar uno en uso
        const availability = avail === 'free' || avail === 'taken' ? avail : await checkNow(username)
        const issues = registerIssues({ username, email, password, confirm, availability })
        const problem = registerIssuesMessage(issues)
        if (problem) {
            setSubmitted(true)
            setEmailBlurred(true)
            fail(problem)
            return
        }
        setSubmitted(false)
        setMessage(null)
        setInvalid(NO_FIELDS)
        setState('saving')
        const name = username.trim()
        const cleanEmail = email.trim()
        try {
            const { data, error } = await supabase.auth.signUp({
                email: cleanEmail,
                password,
                options: { data: { username: name } },
            })
            // Con la confirmación por email activada, un email repetido llega como usuario sin identidades en vez de error
            if (!error && data.user?.identities?.length === 0) {
                setState('idle')
                fail(emailTakenMessage(cleanEmail))
                return
            }
            if (error || !data.user) {
                setState('idle')
                const msg = signUpErrorMessage(error, cleanEmail, navigator.onLine)
                fail(msg, msg.fields?.[0] === 'password')
                return
            }
            setState('done')
            setMessage(signUpWelcomeMessage(name))
            router.push('/')
        } catch (err) {
            console.error(err)
            setState('idle')
            fail(signUpErrorMessage(err as AuthErrorLike, cleanEmail, navigator.onLine))
        }
    }

    const handleGoogleRegister = async () => {
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

    const nameShown = username.trim()
    const usernameStatus =
        avail === 'short' ? (
            <FieldStatus tone={submitted || invalid.username ? 'bad' : 'neutral'}>Al menos {USERNAME_MIN} caracteres</FieldStatus>
        ) : avail === 'checking' ? (
            <FieldStatus tone="checking">Comprobando…</FieldStatus>
        ) : avail === 'taken' ? (
            <FieldStatus tone="bad">
                <b>{nameShown}</b> ya está en uso
            </FieldStatus>
        ) : avail === 'free' ? (
            <FieldStatus tone="ok">
                <b>{nameShown}</b> está libre
            </FieldStatus>
        ) : nameShown ? null : (
            <FieldStatus>Es el nombre que sale en el ranking.</FieldStatus>
        )

    return (
        <AuthForm title="Crea tu cuenta" subtitle="Crea la cuenta y después conecta Steam para traer tus juegos y logros.">
            <Button variant="secondary" onClick={handleGoogleRegister} loading={googleBusy} disabled={busy} className="btn-block hg-enter" style={authEnter(1)}>
                {googleBusy ? 'Abriendo Google…' : (
                    <>
                        <GoogleIcon />
                        Registrarse con Google
                    </>
                )}
            </Button>

            <div className="divider-text hg-enter" style={authEnter(2)}>o con tu email</div>

            <form ref={formRef} onSubmit={handleRegister} className="auth__fields hg-enter" style={authEnter(3)} noValidate>
                <div className={`field${marked.username ? ' is-bad' : avail === 'free' ? ' is-ok' : ''}`}>
                    <label className="field__label" htmlFor="reg-username">Nombre de usuario</label>
                    <div className="field__control">
                        <UserRound size={16} className="field__icon" aria-hidden />
                        <Input
                            ref={usernameRef}
                            id="reg-username"
                            value={username}
                            onChange={(event) => edit('username', event.target.value)}
                            placeholder="Tu alias"
                            autoComplete="username"
                            autoCapitalize="none"
                            spellCheck={false}
                            enterKeyHint="next"
                            disabled={busy}
                            aria-invalid={marked.username || undefined}
                            aria-describedby="reg-username-status reg-msg"
                        />
                    </div>
                    <p id="reg-username-status" className="field__status-row" aria-live="polite">
                        {usernameStatus}
                    </p>
                </div>
                <div className={`field${marked.email ? ' is-bad' : ''}`}>
                    <label className="field__label" htmlFor="reg-email">Email</label>
                    <div className="field__control">
                        <Mail size={16} className="field__icon" aria-hidden />
                        <Input
                            ref={emailRef}
                            id="reg-email"
                            type="email"
                            inputMode="email"
                            enterKeyHint="next"
                            value={email}
                            onChange={(event) => edit('email', event.target.value)}
                            onBlur={() => setEmailBlurred(true)}
                            placeholder="tu@email.com"
                            autoComplete="email"
                            disabled={busy}
                            aria-invalid={marked.email || undefined}
                            aria-describedby="reg-email-status reg-msg"
                        />
                    </div>
                    <p id="reg-email-status" className="field__status-row" aria-live="polite">
                        {emailBad && <FieldStatus tone="bad">Revisa el email: falta algo como nombre@dominio.es</FieldStatus>}
                    </p>
                </div>
                <PasswordField
                    id="reg-password"
                    label="Contraseña"
                    value={password}
                    onChange={(value) => edit('password', value)}
                    autoComplete="new-password"
                    enterKeyHint="next"
                    placeholder={`Mínimo ${PASSWORD_MIN} caracteres`}
                    invalid={marked.password}
                    disabled={busy}
                    describedBy="reg-rules reg-msg"
                    inputRef={passwordRef}
                />
                <PasswordField
                    id="reg-confirm"
                    label="Repite la contraseña"
                    value={confirm}
                    onChange={(value) => edit('confirm', value)}
                    autoComplete="new-password"
                    enterKeyHint="go"
                    placeholder="La misma otra vez"
                    invalid={marked.confirm}
                    disabled={busy}
                    describedBy="reg-rules reg-msg"
                    inputRef={confirmRef}
                />
                <FieldRules
                    id="reg-rules"
                    rules={[
                        { label: `Mínimo ${PASSWORD_MIN} caracteres`, ok: rules.len, bad: (submitted || invalid.password) && !rules.len },
                        { label: mismatch ? 'No coinciden' : 'Coinciden', ok: rules.eq === true, bad: mismatch || (submitted && rules.eq !== true) },
                    ]}
                />
                <FormError id="reg-msg" message={message} />
                <SaveButton type="submit" state={state} done="Cuenta creada" saving="Creando cuenta…" disabled={googleBusy} className="btn-block">
                    <UserRoundPlus size={16} data-icon="inline-start" aria-hidden />
                    Crear cuenta
                </SaveButton>
            </form>

            <p className="auth__switch hg-enter" style={authEnter(4)}>
                ¿Ya tienes cuenta?{' '}
                <Link href="/login" className="link">Inicia sesión</Link>
            </p>
        </AuthForm>
    )
}
