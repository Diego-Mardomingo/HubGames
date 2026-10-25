'use client'

import { useSyncExternalStore } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { getThemePref, setThemePref, THEME_CHANGED_EVENT, type ThemePref } from '@/lib/theme'

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Tema claro', icon: Sun },
    { value: 'dark', label: 'Tema oscuro', icon: Moon },
    { value: 'system', label: 'Tema del sistema', icon: Monitor },
]

function subscribe(onChange: () => void) {
    window.addEventListener(THEME_CHANGED_EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
        window.removeEventListener(THEME_CHANGED_EVENT, onChange)
        window.removeEventListener('storage', onChange)
    }
}

/**
 * `compact`: un solo botón que rota claro → oscuro → sistema (barra móvil y barra lateral plegada).
 * Por defecto: control segmentado con las tres opciones.
 */
export default function ThemeToggle({ compact = false, className }: { compact?: boolean; className?: string }) {
    // null en el servidor: no conoce la preferencia guardada.
    const pref = useSyncExternalStore<ThemePref | null>(subscribe, getThemePref, () => null)
    const choose = setThemePref

    if (compact) {
        const current = OPTIONS.find((o) => o.value === (pref ?? 'system'))!
        const next = OPTIONS[(OPTIONS.indexOf(current) + 1) % OPTIONS.length]
        const Icon = current.icon
        return (
            <button
                type="button"
                className={['theme-toggle-btn', className].filter(Boolean).join(' ')}
                onClick={() => choose(next.value)}
                aria-label={`${current.label}. Cambiar a ${next.label.toLowerCase()}`}
                title={current.label}
            >
                <Icon size={18} aria-hidden />
            </button>
        )
    }

    return (
        <div className={['theme-toggle', className].filter(Boolean).join(' ')} role="radiogroup" aria-label="Tema">
            {OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={pref === value}
                    aria-label={label}
                    title={label}
                    onClick={() => choose(value)}
                >
                    <Icon size={16} aria-hidden />
                </button>
            ))}
        </div>
    )
}
