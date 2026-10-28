'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, KeyRound, User, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { USERNAME_MIN, passwordRules, usernameIssue } from '@/lib/profile'
import { SaveButton, type SaveState } from '@/components/SaveButton'
import { PfSection, enter, type Notify } from './Section'

type Availability = 'idle' | 'short' | 'checking' | 'free' | 'taken'

/** Cuenta: nombre de usuario (con «libre / en uso» mientras escribes) y contraseña (con sus reglas marcándose). Cobalto: eres tú. */
export default function AccountSetting({
    userId,
    username,
    onSaved,
    notify,
    index,
}: {
    userId: string
    username: string
    onSaved: (name: string) => void
    notify: Notify
    index: number
}) {
    const [name, setName] = useState(username)
    const [avail, setAvail] = useState<Availability>('idle')
    const [nameSave, setNameSave] = useState<SaveState>('idle')
    const [pass, setPass] = useState('')
    const [confirm, setConfirm] = useState('')
    const [passSave, setPassSave] = useState<SaveState>('idle')
    const [shake, setShake] = useState(0)
    const checkTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
    const checkSeq = useRef(0)
    const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

    useEffect(
        () => () => {
            clearTimeout(checkTimer.current)
            clearTimeout(resetTimer.current)
        },
        [],
    )

    function onNameChange(value: string) {
        setName(value)
        clearTimeout(checkTimer.current)
        const seq = ++checkSeq.current
        const issue = usernameIssue(value, username)
        if (issue === 'same') return setAvail('idle')
        if (issue === 'short') return setAvail('short')
        setAvail('checking')
        checkTimer.current = setTimeout(async () => {
            const { data, error } = await supabase.rpc('hubgames_username_available', { p_username: value.trim() })
            if (seq !== checkSeq.current) return
            // Si la comprobación falla, se deja guardar: el error de nombre repetido saldría al guardar.
            setAvail(error ? 'free' : data === false ? 'taken' : 'free')
        }, 400)
    }

    function finish(set: (s: SaveState) => void) {
        set('done')
        clearTimeout(resetTimer.current)
        resetTimer.current = setTimeout(() => set('idle'), 1600)
    }

    async function saveName(event: FormEvent) {
        event.preventDefault()
        if (avail !== 'free') return
        const value = name.trim()
        setNameSave('saving')
        try {
            const { error: authError } = await supabase.auth.updateUser({ data: { username: value } })
            if (authError) throw authError
            const { error: dbError } = await supabase.from('hubgames_usuarios').update({ username: value }).eq('id', userId)
            if (dbError) throw dbError
            setAvail('idle')
            setName(value)
            onSaved(value)
            finish(setNameSave)
            notify('ok', 'Nombre de usuario actualizado')
        } catch (err) {
            setNameSave('idle')
            notify('error', (err as Error).message || 'Error al actualizar el nombre de usuario')
        }
    }

    const rules = passwordRules(pass, confirm)
    // «No coinciden» solo cuando ya has escrito tanto como la contraseña (no a la primera letra).
    const mismatch = rules.eq === false && confirm.length >= pass.length

    async function savePassword(event: FormEvent) {
        event.preventDefault()
        const error = !rules.len ? 'La contraseña debe tener al menos 6 caracteres' : rules.eq !== true ? 'Las contraseñas no coinciden' : ''
        if (error) {
            setShake((n) => n + 1)
            notify('error', error)
            return
        }
        setPassSave('saving')
        const { error: passwordError } = await supabase.auth.updateUser({ password: pass })
        if (passwordError) {
            setPassSave('idle')
            notify('error', passwordError.message || 'Error al actualizar la contraseña')
            return
        }
        setPass('')
        setConfirm('')
        setShake(0)
        finish(setPassSave)
        notify('ok', 'Contraseña actualizada')
    }

    const hint =
        avail === 'short' ? (
            <span className="pf-hint pf-ink dash-ko">
                <X aria-hidden /> Al menos {USERNAME_MIN} caracteres
            </span>
        ) : avail === 'checking' ? (
            <span className="pf-hint">
                <Spinner /> Comprobando…
            </span>
        ) : avail === 'taken' ? (
            <span className="pf-hint pf-ink dash-ko">
                <X aria-hidden /> «{name.trim()}» ya está en uso
            </span>
        ) : avail === 'free' ? (
            <span className="pf-hint pf-ink dash-ok">
                <Check aria-hidden /> Disponible
            </span>
        ) : null

    return (
        <PfSection id="pf-account" tone="st-todos" icon={<User />} title="Cuenta" style={enter(index)}>
            <form onSubmit={saveName} className="pf-row" noValidate>
                <div className="pf-row__text">
                    <label className="pf-row__label" htmlFor="perfil-username-input">
                        Nombre de usuario
                    </label>
                    <p className="pf-row__desc">Es el nombre que aparece en el ranking.</p>
                </div>
                <div className="pf-row__control pf-row__control--form">
                    <Input
                        id="perfil-username-input"
                        value={name}
                        onChange={(e) => onNameChange(e.target.value)}
                        placeholder="Tu nombre"
                        autoComplete="username"
                        spellCheck={false}
                        aria-describedby="perfil-username-hint"
                        aria-invalid={avail === 'taken' || avail === 'short' || undefined}
                    />
                    <SaveButton type="submit" state={nameSave} done="Guardado" disabled={avail !== 'free'}>
                        Guardar
                    </SaveButton>
                    <p id="perfil-username-hint" className="pf-hint-row" aria-live="polite">
                        {hint}
                    </p>
                </div>
            </form>

            <form onSubmit={savePassword} className="pf-row" noValidate>
                <div className="pf-row__text">
                    <span className="pf-row__label" id="pf-pass-label">
                        Contraseña
                    </span>
                    <ul className="pf-rules" aria-live="polite">
                        <li className={rules.len ? 'is-ok' : shake > 0 ? 'is-bad' : undefined}>
                            <span className="pf-rules__dot" aria-hidden>
                                <Check />
                            </span>
                            Mínimo 6 caracteres
                        </li>
                        <li className={rules.eq ? 'is-ok' : mismatch || shake > 0 ? 'is-bad' : undefined}>
                            <span className="pf-rules__dot" aria-hidden>
                                <Check />
                            </span>
                            {mismatch ? 'No coinciden' : 'Coinciden'}
                        </li>
                    </ul>
                </div>
                <div key={shake} className={`pf-row__control pf-row__control--stack${shake ? ' hg-shake' : ''}`} role="group" aria-labelledby="pf-pass-label">
                    <label htmlFor="perfil-pass-new" className="sr-only">
                        Nueva contraseña
                    </label>
                    <Input
                        id="perfil-pass-new"
                        type="password"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        placeholder="Nueva contraseña"
                        autoComplete="new-password"
                    />
                    <label htmlFor="perfil-pass-confirm" className="sr-only">
                        Confirmar contraseña
                    </label>
                    <Input
                        id="perfil-pass-confirm"
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Confirmar contraseña"
                        autoComplete="new-password"
                        aria-invalid={mismatch || undefined}
                    />
                    <SaveButton type="submit" variant="secondary" state={passSave} done="Contraseña cambiada">
                        <KeyRound data-icon="inline-start" aria-hidden /> Cambiar contraseña
                    </SaveButton>
                </div>
            </form>
        </PfSection>
    )
}
