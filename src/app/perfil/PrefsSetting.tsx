'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Monitor, Moon, Sun } from 'lucide-react'
import { getNotificationPreference, subscribeToDailyNotifications, disableDailyNotifications } from '@/lib/notifications'
import { Spinner } from '@/components/ui/spinner'
import ThemeToggle, { useThemePref } from '@/components/ThemeToggle'
import { PfSection, enter, type Notify } from './Section'

/** El icono de la sección es el de tu tema, con su color: sol ámbar, luna cobalto, sistema neutro. */
const THEME_ICON = {
    light: { icon: Sun, tone: 'dash-warn' },
    dark: { icon: Moon, tone: 'st-todos' },
    system: { icon: Monitor, tone: 'neutral' },
} as const

/** Preferencias: tema (cambia de verdad, con fundido de colores) y notificaciones (en verde cuando están activas). */
export default function PrefsSetting({ notify, index }: { notify: Notify; index: number }) {
    const pref = useThemePref() ?? 'system'
    const theme = THEME_ICON[pref]
    const ThemeIcon = theme.icon
    const [enabled, setEnabled] = useState<boolean | null>(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        let alive = true
        getNotificationPreference()
            .then((v) => alive && setEnabled(v))
            .catch(() => alive && setEnabled(false))
        return () => {
            alive = false
        }
    }, [])

    async function toggle() {
        if (enabled === null) return
        const next = !enabled
        // La bola se desliza al momento; si falla, vuelve.
        setEnabled(next)
        setBusy(true)
        try {
            if (next) {
                const result = await subscribeToDailyNotifications()
                if (!result.success) throw new Error(result.error || 'No se han podido activar las notificaciones')
                notify('ok', 'Notificaciones activadas')
            } else {
                const ok = await disableDailyNotifications()
                if (!ok) throw new Error('No se han podido desactivar las notificaciones')
                notify('ok', 'Notificaciones desactivadas')
            }
        } catch (err) {
            setEnabled(!next)
            notify('error', (err as Error).message || 'Error al actualizar notificaciones')
        } finally {
            setBusy(false)
        }
    }

    const on = Boolean(enabled)
    const NotifIcon = on ? Bell : BellOff

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
            <div className="pf-row pf-row--inline">
                <div className="pf-row__text">
                    <span className="pf-row__label" id="pf-notif-label">
                        <span className={`pf-ink ${on ? 'dash-ok' : 'neutral'}`}>
                            <NotifIcon aria-hidden />
                        </span>
                        Notificaciones
                        {enabled !== null && (
                            <span key={String(on)} className={`pf-onoff pf-ink ${on ? 'dash-ok' : 'neutral'}`}>
                                {on ? 'Activadas' : 'Desactivadas'}
                            </span>
                        )}
                    </span>
                    <p className="pf-row__desc">{busy ? 'Actualizando…' : 'Nuevo JUDI cada día y bajadas de precio de tu wishlist.'}</p>
                </div>
                <div className="pf-row__control">
                    {busy && <Spinner className="pf-switch-spin" />}
                    <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-labelledby="pf-notif-label"
                        disabled={busy || enabled === null}
                        className={`switch pf-switch--ok${busy ? ' is-busy' : ''}`}
                        onClick={toggle}
                    >
                        <span className="switch__thumb" aria-hidden />
                    </button>
                </div>
            </div>
        </PfSection>
    )
}
