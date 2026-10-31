'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Monitor, Moon, Smartphone, Sun, Trash2 } from 'lucide-react'
import {
    enableThisDevice,
    getNotificationState,
    removeDevice,
    setDeviceEnabled,
    setDevicePref,
    type NotificationState,
    type PushDevice,
} from '@/lib/notifications'
import { NOTIFICATION_TYPES, wantsType, type NotificationType } from '@/lib/notification-prefs'
import { timeAgo } from '@/lib/profile'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import ThemeToggle, { useThemePref } from '@/components/ThemeToggle'
import { PfSection, enter, type Notify } from './Section'

/** El icono de la sección es el de tu tema, con su color: sol ámbar, luna cobalto, sistema neutro. */
const THEME_ICON = {
    light: { icon: Sun, tone: 'dash-warn' },
    dark: { icon: Moon, tone: 'st-todos' },
    system: { icon: Monitor, tone: 'neutral' },
} as const

const SUPPORT_MSG = {
    unsupported: 'Este navegador no admite notificaciones push. En iPhone y iPad, instala HubGames en la pantalla de inicio y ábrelo desde allí.',
    denied: 'Las notificaciones están bloqueadas para HubGames en este navegador. Permítelas en los ajustes del sitio y vuelve a intentarlo.',
} as const

function typesLabel(device: PushDevice): string {
    if (!device.enabled) return 'Desactivado'
    const on = NOTIFICATION_TYPES.filter((t) => wantsType(device.prefs, t.key)).map((t) => t.label)
    return on.length ? on.join(' · ') : 'Ningún aviso'
}

/** Preferencias: tema (cambia de verdad, con fundido de colores) y notificaciones por dispositivo (#90). */
export default function PrefsSetting({ notify, index }: { notify: Notify; index: number }) {
    const pref = useThemePref() ?? 'system'
    const theme = THEME_ICON[pref]
    const ThemeIcon = theme.icon

    return (
        <PfSection
            id="pf-prefs"
            tone={theme.tone}
            icon={
                <span key={pref} className="pf-pop">
                    <ThemeIcon />
                </span>
            }
            title="Preferencias"
            style={enter(index)}
        >
            <div className="pf-row pf-row--inline pf-row--stack-sm">
                <div className="pf-row__text">
                    <span className="pf-row__label">Tema</span>
                    <p className="pf-row__desc">Claro, oscuro o el que use tu sistema.</p>
                </div>
                <div className="pf-row__control">
                    <ThemeToggle labeled className="pf-theme" />
                </div>
            </div>
            <NotificationSettings notify={notify} />
        </PfSection>
    )
}

function NotificationSettings({ notify }: { notify: Notify }) {
    const [state, setState] = useState<NotificationState | null>(null)
    // Qué se está guardando: 'main', el tipo, o el id de otro dispositivo.
    const [busy, setBusy] = useState<string | null>(null)
    const [confirming, setConfirming] = useState<string | null>(null)

    useEffect(() => {
        let alive = true
        getNotificationState()
            .then((s) => alive && setState(s))
            .catch(() => alive && setState({ support: 'ok', current: null, others: [] }))
        return () => {
            alive = false
        }
    }, [])

    const current = state?.current ?? null
    const on = Boolean(current?.enabled)
    const blocked = state !== null && state.support !== 'ok' && !on

    const patchCurrent = (device: PushDevice | null) => setState((s) => (s ? { ...s, current: device } : s))
    const patchOther = (id: string, next: PushDevice | null) =>
        setState((s) => (s ? { ...s, others: s.others.flatMap((d) => (d.id === id ? (next ? [next] : []) : [d])) } : s))

    async function toggleMain() {
        if (!state || busy) return
        const next = !on
        const before = current
        // La bola se desliza al momento; si falla, vuelve.
        if (current) patchCurrent({ ...current, enabled: next })
        setBusy('main')
        try {
            if (next) {
                const result = await enableThisDevice()
                if (!result.success || !result.device) throw new Error(result.error || 'No se han podido activar las notificaciones')
                patchCurrent(result.device)
                // Si el permiso se acaba de conceder, el aviso de bloqueo ya no aplica.
                setState((s) => (s ? { ...s, support: 'ok' } : s))
                notify('ok', 'Notificaciones activadas en este dispositivo')
            } else if (current) {
                if (!(await setDeviceEnabled(current.id, false))) throw new Error('No se han podido desactivar las notificaciones')
                notify('ok', 'Notificaciones desactivadas en este dispositivo')
            }
        } catch (err) {
            patchCurrent(before)
            notify('error', (err as Error).message || 'Error al actualizar notificaciones')
        } finally {
            setBusy(null)
        }
    }

    async function toggleType(type: NotificationType) {
        if (!current || busy) return
        const value = !wantsType(current.prefs, type)
        patchCurrent({ ...current, prefs: { ...current.prefs, [type]: value } })
        setBusy(type)
        const prefs = await setDevicePref(current, type, value)
        setBusy(null)
        if (!prefs) {
            patchCurrent(current)
            notify('error', 'No se ha podido guardar la preferencia')
        }
    }

    async function toggleOther(device: PushDevice) {
        if (busy) return
        setBusy(device.id)
        const ok = await setDeviceEnabled(device.id, !device.enabled)
        setBusy(null)
        if (ok) patchOther(device.id, { ...device, enabled: !device.enabled })
        else notify('error', 'No se ha podido cambiar ese dispositivo')
    }

    async function remove(device: PushDevice) {
        if (busy) return
        setBusy(device.id)
        const ok = await removeDevice(device)
        setBusy(null)
        setConfirming(null)
        if (ok) {
            patchOther(device.id, null)
            notify('ok', `${device.name} ya no recibirá avisos`)
        } else notify('error', 'No se ha podido quitar ese dispositivo')
    }

    const NotifIcon = on ? Bell : BellOff
    const desc =
        busy === 'main'
            ? 'Actualizando…'
            : on
              ? `En ${current!.name}. Elige qué avisos quieres recibir aquí.`
              : 'Actívalas en este dispositivo para recibir avisos aquí.'

    return (
        <>
            <div className="pf-row pf-row--inline">
                <div className="pf-row__text">
                    <span className="pf-row__label" id="pf-notif-label">
                        <span className={`pf-ink ${on ? 'dash-ok' : 'neutral'}`}>
                            <NotifIcon aria-hidden />
                        </span>
                        Notificaciones en este dispositivo
                        {state !== null && (
                            <span key={String(on)} className={`pf-onoff pf-ink ${on ? 'dash-ok' : 'neutral'}`}>
                                {on ? 'Activadas' : 'Desactivadas'}
                            </span>
                        )}
                    </span>
                    <p className="pf-row__desc">{desc}</p>
                </div>
                <div className="pf-row__control">
                    {busy === 'main' && <Spinner className="pf-switch-spin" />}
                    <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-labelledby="pf-notif-label"
                        disabled={busy !== null || state === null || blocked}
                        className={`switch pf-switch--ok${busy === 'main' ? ' is-busy' : ''}`}
                        onClick={toggleMain}
                    >
                        <span className="switch__thumb" aria-hidden />
                    </button>
                </div>
            </div>

            {blocked && (
                <div className="pf-notes">
                    <p className="alert alert--warn pf-alert" role="status">
                        <BellOff aria-hidden />
                        {SUPPORT_MSG[state.support as 'unsupported' | 'denied']}
                    </p>
                </div>
            )}

            {state !== null && !blocked && (
                <ul className="pf-notif-types" aria-label="Avisos en este dispositivo">
                    {NOTIFICATION_TYPES.map((t) => {
                        const checked = on && wantsType(current!.prefs, t.key)
                        return (
                            <li key={t.key} className={`pf-notif-type${on ? '' : ' is-off'}`}>
                                <div className="pf-row__text">
                                    <span className="pf-notif-type__label" id={`pf-notif-${t.key}`}>
                                        {t.label}
                                    </span>
                                    <p className="pf-row__desc">{t.desc}</p>
                                </div>
                                <div className="pf-row__control">
                                    {busy === t.key && <Spinner className="pf-switch-spin" />}
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={checked}
                                        aria-labelledby={`pf-notif-${t.key}`}
                                        disabled={!on || busy !== null}
                                        className={`switch pf-switch--ok${busy === t.key ? ' is-busy' : ''}`}
                                        onClick={() => toggleType(t.key)}
                                    >
                                        <span className="switch__thumb" aria-hidden />
                                    </button>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}

            {state !== null && state.others.length > 0 && (
                <div className="pf-row pf-row--full">
                    <div className="pf-row__text">
                        <span className="pf-row__label">Otros dispositivos</span>
                        <p className="pf-row__desc">Donde también activaste las notificaciones. Cada uno tiene sus propios avisos.</p>
                    </div>
                    <ul className="pf-devices">
                        {state.others.map((d) => (
                            <li key={d.id} className={`pf-device${d.enabled ? '' : ' is-off'}`}>
                                <span className={`pf-device__icon hg-tint ${d.enabled ? 'dash-ok' : 'neutral'}`} aria-hidden>
                                    <Smartphone />
                                </span>
                                <div className="pf-device__text">
                                    <span className="pf-device__name" id={`pf-dev-${d.id}`}>
                                        {d.name}
                                    </span>
                                    <span className="pf-device__meta">
                                        {typesLabel(d)} · usado {timeAgo(d.lastUsedAt)}
                                    </span>
                                </div>
                                <div className="pf-device__acts">
                                    {confirming === d.id ? (
                                        <>
                                            <Button variant="ghost" size="sm" disabled={busy === d.id} onClick={() => setConfirming(null)}>
                                                Cancelar
                                            </Button>
                                            <Button variant="danger" size="sm" loading={busy === d.id} onClick={() => remove(d)}>
                                                Quitar
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={d.enabled}
                                                aria-labelledby={`pf-dev-${d.id}`}
                                                disabled={busy !== null}
                                                className={`switch pf-switch--ok${busy === d.id ? ' is-busy' : ''}`}
                                                onClick={() => toggleOther(d)}
                                            >
                                                <span className="switch__thumb" aria-hidden />
                                            </button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="pf-device__remove"
                                                aria-label={`Quitar ${d.name}`}
                                                title="Quitar dispositivo"
                                                disabled={busy !== null}
                                                onClick={() => setConfirming(d.id)}
                                            >
                                                <Trash2 aria-hidden />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </>
    )
}
