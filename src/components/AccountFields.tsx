'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/spinner'
import { usernameIssue } from '@/lib/account'

export type Availability = 'idle' | 'short' | 'checking' | 'free' | 'taken'

/**
 * Comprueba si un nombre de usuario está libre mientras escribes (registro y perfil): 400 ms después de la última tecla,
 * con `hubgames_username_available`; las respuestas viejas se descartan. Si la consulta falla, se da por libre
 * (el nombre repetido no lo impide la base de datos). `current`: el nombre que ya tienes (perfil), que no se comprueba.
 */
export function useUsernameCheck(current = '') {
    const [avail, setAvail] = useState<Availability>('idle')
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
    const seq = useRef(0)

    useEffect(() => () => clearTimeout(timer.current), [])

    const query = async (value: string, n: number) => {
        const { data, error } = await supabase.rpc('hubgames_username_available', { p_username: value.trim() })
        if (n !== seq.current) return null
        const next: Availability = error ? 'free' : data === false ? 'taken' : 'free'
        setAvail(next)
        return next
    }

    /** Al escribir: estado inmediato (vacío, corto, comprobando) y consulta tras 400 ms. */
    const onChange = useCallback(
        (value: string) => {
            clearTimeout(timer.current)
            const n = ++seq.current
            const issue = usernameIssue(value, current)
            // En el perfil, vaciar tu nombre es «demasiado corto»; en el registro, todavía nada
            if (issue === 'same' || (issue === 'empty' && !current)) return setAvail('idle')
            if (issue === 'short' || issue === 'empty') return setAvail('short')
            setAvail('checking')
            timer.current = setTimeout(() => void query(value, n), 400)
        },
        [current],
    )

    /** Al enviar: comprueba ya (sin esperar) y devuelve el resultado. */
    const checkNow = useCallback(
        async (value: string): Promise<Availability> => {
            clearTimeout(timer.current)
            const n = ++seq.current
            const issue = usernameIssue(value, current)
            if (issue === 'same' || (issue === 'empty' && !current)) {
                setAvail('idle')
                return 'idle'
            }
            if (issue === 'short' || issue === 'empty') {
                setAvail('short')
                return 'short'
            }
            setAvail('checking')
            return (await query(value, n)) ?? 'checking'
        },
        [current],
    )

    const reset = useCallback(() => {
        clearTimeout(timer.current)
        seq.current++
        setAvail('idle')
    }, [])

    return { avail, onChange, checkNow, reset }
}

/**
 * Pista bajo un campo con su tono: neutra, comprobando (spinner), bien (verde, check que se dibuja) o mal (rojo, aspa).
 * Siempre con icono y texto. Perfil y registro.
 */
export function FieldStatus({ tone = 'neutral', children }: { tone?: 'neutral' | 'checking' | 'ok' | 'bad'; children: ReactNode }) {
    return (
        <span key={tone} className={`field-status${tone === 'ok' ? ' is-ok' : tone === 'bad' ? ' is-bad' : ''}`}>
            {tone === 'checking' && <Spinner />}
            {tone === 'ok' && <Check className="hg-draw" aria-hidden />}
            {tone === 'bad' && <X aria-hidden />}
            {children}
        </span>
    )
}

/** Requisitos que se van marcando (contraseña): punto que se rellena de verde con un check; en rojo si `bad`. */
export function FieldRules({ rules, id }: { rules: { label: string; ok: boolean; bad?: boolean }[]; id?: string }) {
    return (
        <ul id={id} className="field-rules" aria-live="polite">
            {rules.map((rule, i) => (
                <li key={i} className={rule.ok ? 'is-ok' : rule.bad ? 'is-bad' : undefined}>
                    <span className="field-rules__dot" aria-hidden>
                        <Check />
                    </span>
                    {rule.label}
                    <span className="sr-only">{rule.ok ? ' (cumplido)' : ''}</span>
                </li>
            ))}
        </ul>
    )
}
