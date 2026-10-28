'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { KeyRound, User } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { USERNAME_MIN, PASSWORD_MIN, passwordMismatch, passwordRules } from '@/lib/account'
import { FieldRules, FieldStatus, useUsernameCheck } from '@/components/AccountFields'
import { SaveButton, type SaveState } from '@/components/SaveButton'
import { PfSection, enter, type Notify } from './Section'

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
    const { avail, onChange: checkName, reset: resetCheck } = useUsernameCheck(username)
    const [nameSave, setNameSave] = useState<SaveState>('idle')
    const [pass, setPass] = useState('')
    const [confirm, setConfirm] = useState('')
    const [passSave, setPassSave] = useState<SaveState>('idle')
    const [shake, setShake] = useState(0)
    const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

    useEffect(
        () => () => {
            clearTimeout(resetTimer.current)
        },
        [],
    )

    function onNameChange(value: string) {
        setName(value)
        checkName(value)
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
            resetCheck()
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
    const mismatch = passwordMismatch(pass, confirm)

    async function savePassword(event: FormEvent) {
        event.preventDefault()
        const error = !rules.len ? `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres` : rules.eq !== true ? 'Las contraseñas no coinciden' : ''
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
            <FieldStatus tone="bad">Al menos {USERNAME_MIN} caracteres</FieldStatus>
        ) : avail === 'checking' ? (
            <FieldStatus tone="checking">Comprobando…</FieldStatus>
        ) : avail === 'taken' ? (
            <FieldStatus tone="bad">«{name.trim()}» ya está en uso</FieldStatus>
        ) : avail === 'free' ? (
            <FieldStatus tone="ok">Disponible</FieldStatus>
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
                    <FieldRules
                        rules={[
                            { label: `Mínimo ${PASSWORD_MIN} caracteres`, ok: rules.len, bad: shake > 0 },
                            { label: mismatch ? 'No coinciden' : 'Coinciden', ok: rules.eq === true, bad: mismatch || shake > 0 },
                        ]}
                    />
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
