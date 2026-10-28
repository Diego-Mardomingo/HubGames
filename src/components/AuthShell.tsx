'use client'

import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Clock, Eye, EyeOff, Lock, LogIn, WifiOff, ArrowBigUp } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Input } from '@/components/ui/input'
import { LibraryPreview, UnlockAchievement } from '@/components/preview/LibraryPreview'
import { usePreviewSteps } from '@/components/preview/usePreviewSteps'
import { errorText, type AuthIcon, type AuthMessage } from '@/lib/auth-messages'

const enter = (i: number) => ({ '--i': i }) as CSSProperties

/**
 * Marco común del login y el registro. Vive en `src/app/(auth)/layout.tsx`, así que el lateral (y su vista previa «en acción»)
 * no se vuelve a montar al pasar de uno a otro: solo cambia el formulario (`AuthForm`, con su entrada escalonada).
 * Escritorio: lateral con el producto + formulario. Móvil: el formulario y, debajo, la vista previa reducida.
 */
export default function AuthShell({ children }: { children: ReactNode }) {
    const step = usePreviewSteps()
    const pitch = 'Tu biblioteca de Steam y tus logros, en orden.'
    return (
        <>
            <div className="auth">
                <aside className="auth__brand">
                    <span className="hg-enter" style={enter(0)}>
                        <Logo size={26} animated={false} />
                    </span>
                    <div className="auth__pitch hg-enter" style={enter(1)}>
                        <p className="auth__tagline">{pitch}</p>
                        <p className="auth__tagline-sub">
                            Lo que juegas, lo que tienes pendiente y los logros que te faltan, sincronizado con Steam. Y cada día, un juego
                            que adivinar en JUDI.
                        </p>
                    </div>
                    <div
                        className="auth__preview"
                        role="img"
                        aria-label="Ejemplo de HubGames: tu biblioteca por listas, un juego en mínimo histórico y un logro épico que se desbloquea"
                    >
                        <LibraryPreview className="hg-enter" style={enter(2)} step={step} rows={['elden', 'hades', 'disco']} />
                        <ul className="hg-achs hg-enter" style={enter(3)} aria-hidden>
                            <UnlockAchievement unlocked={step >= 2} context="Hollow Knight" />
                        </ul>
                    </div>
                </aside>
                <div className="auth__form-wrap">{children}</div>
            </div>
            <section className="auth__peek hg-enter" style={enter(6)} role="img" aria-label="Ejemplo de tu biblioteca en HubGames">
                <p className="auth__peek-title" aria-hidden>
                    {pitch}
                </p>
                <p className="auth__peek-sub" aria-hidden>
                    Cada juego en su lista, sincronizado con Steam.
                </p>
                <LibraryPreview bare step={step} rows={['hades']} pills={['jugando', 'pendiente', 'completado']} />
            </section>
        </>
    )
}

/** Formulario dentro del marco: título, subtítulo y el contenido, con la entrada escalonada (`.hg-enter`). */
export function AuthForm({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
    return (
        <div className="auth__form">
            <div className="hg-enter" style={enter(0)}>
                <h1 className="auth__title">{title}</h1>
                <p className="auth__subtitle">{subtitle}</p>
            </div>
            {children}
        </div>
    )
}

/** Posición en la entrada escalonada del formulario (el título es la 0). */
export const authEnter = enter

const MSG_ICONS: Record<AuthIcon, typeof AlertCircle> = { alert: AlertCircle, offline: WifiOff, clock: Clock, check: CheckCircle2 }
const MSG_CLASS = { error: 'alert--error', warn: 'alert--warn', ok: 'alert--ok' } as const

/**
 * Aviso del formulario con su tono (`--danger`, `--warning`, `--success`), icono y texto. Baja con un fundido y se va igual.
 * Acepta texto suelto (los mensajes del registro), que se pinta como error.
 */
export function FormError({ message, id }: { message: AuthMessage | string | null; id?: string }) {
    const msg = typeof message === 'string' ? (message ? errorText(message) : null) : message
    const Icon = msg ? MSG_ICONS[msg.icon] : null
    return (
        <div id={id} className="auth-msg-slot">
            <AnimatePresence initial={false} mode="wait">
                {msg && Icon && (
                    <motion.div
                        key={`${msg.tone}:${msg.text}`}
                        className={`alert auth-msg ${MSG_CLASS[msg.tone]}`}
                        role={msg.tone === 'ok' ? 'status' : 'alert'}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }}
                        exit={{ opacity: 0, y: -4, transition: { duration: 0.16, ease: 'easeIn' } }}
                    >
                        <Icon aria-hidden />
                        <div className="auth-msg__body">
                            <p>{msg.text}</p>
                            {msg.sub && <p className="auth-msg__sub">{msg.sub}</p>}
                            {msg.action && (
                                <Link href={msg.action.href} className="auth-msg__act">
                                    <LogIn aria-hidden /> {msg.action.label}
                                </Link>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

/** Sacude un elemento (`.hg-shake`, 320 ms); vuelve a sacudir aunque ya lo esté. */
export function useShake<T extends HTMLElement>() {
    const ref = useRef<T>(null)
    const shake = () => {
        const el = ref.current
        if (!el) return
        el.classList.remove('hg-shake')
        void el.offsetWidth
        el.classList.add('hg-shake')
    }
    return [ref, shake] as const
}

/**
 * Campo de contraseña del login y el registro: candado, botón para verla (con `aria-pressed`) y aviso de Bloq Mayús en ámbar.
 * `invalid` lo marca en rojo.
 */
export function PasswordField({
    id,
    label,
    value,
    onChange,
    autoComplete,
    invalid = false,
    disabled = false,
    describedBy,
    enterKeyHint,
    placeholder = 'Tu contraseña',
    inputRef,
}: {
    id: string
    label: string
    value: string
    onChange: (value: string) => void
    autoComplete: 'current-password' | 'new-password'
    invalid?: boolean
    disabled?: boolean
    describedBy?: string
    enterKeyHint?: 'go' | 'next' | 'done'
    placeholder?: string
    inputRef?: React.RefObject<HTMLInputElement | null>
}) {
    const [shown, setShown] = useState(false)
    const [caps, setCaps] = useState(false)
    const [flip, setFlip] = useState(0)
    const localRef = useRef<HTMLInputElement>(null)
    const ref = inputRef ?? localRef
    const capsId = `${id}-caps`

    const showCaps = caps && !disabled

    const readCaps = (event: React.KeyboardEvent<HTMLInputElement>) => setCaps(event.getModifierState?.('CapsLock') ?? false)

    return (
        <div className={`field${invalid ? ' is-bad' : ''}`}>
            <label className="field__label" htmlFor={id}>
                {label}
            </label>
            <div className="field__control">
                <Lock size={16} className="field__icon" aria-hidden />
                <Input
                    ref={ref}
                    id={id}
                    type={shown ? 'text' : 'password'}
                    autoComplete={autoComplete}
                    enterKeyHint={enterKeyHint}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onKeyDown={readCaps}
                    onKeyUp={readCaps}
                    onBlur={() => setCaps(false)}
                    placeholder={placeholder}
                    disabled={disabled}
                    aria-invalid={invalid || undefined}
                    aria-describedby={[describedBy, showCaps ? capsId : null].filter(Boolean).join(' ') || undefined}
                    className="has-toggle"
                />
                <button
                    type="button"
                    className={`field__toggle${flip ? ' is-flip' : ''}`}
                    key={flip}
                    onClick={() => {
                        setShown((s) => !s)
                        setFlip((f) => f + 1)
                        ref.current?.focus()
                    }}
                    aria-label={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={shown}
                    disabled={disabled}
                >
                    {shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                </button>
            </div>
            {showCaps && (
                <p id={capsId} className="field__hint field__hint--warn">
                    <ArrowBigUp aria-hidden /> Bloq Mayús está activado
                </p>
            )}
        </div>
    )
}
