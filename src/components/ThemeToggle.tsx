'use client'

import { useId, useSyncExternalStore } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Monitor, Moon, Sun } from 'lucide-react'
import { getThemePref, setThemePref, THEME_CHANGED_EVENT, type ThemePref } from '@/lib/theme'

const OPTIONS: { value: ThemePref; label: string; short: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Tema claro', short: 'Claro', icon: Sun },
    { value: 'dark', label: 'Tema oscuro', short: 'Oscuro', icon: Moon },
    { value: 'system', label: 'Tema del sistema', short: 'Sistema', icon: Monitor },
]

function subscribe(onChange: () => void) {
    window.addEventListener(THEME_CHANGED_EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
        window.removeEventListener(THEME_CHANGED_EVENT, onChange)
        window.removeEventListener('storage', onChange)
    }
}

/** Preferencia de tema guardada (null en el servidor, que no la conoce). */
export function useThemePref(): ThemePref | null {
    return useSyncExternalStore<ThemePref | null>(subscribe, getThemePref, () => null)
}

/**
 * `compact`: un solo botón que rota claro → oscuro → sistema (barra móvil y barra lateral plegada).
 * `labeled`: control segmentado con icono y texto (fila "Tema" del perfil), con el fondo activo que se desliza y el icono
 *   activo con el color de su tema (`.theme-opt--*` en styles/lists.css: sol ámbar, luna cobalto, sistema neutro).
 * Por defecto: control segmentado con las tres opciones, solo iconos.
 */
export default function ThemeToggle({
    compact = false,
    labeled = false,
    className,
}: {
    compact?: boolean
    labeled?: boolean
    className?: string
}) {
    // null en el servidor: no conoce la preferencia guardada.
    const pref = useThemePref()
    const choose = setThemePref
    const id = useId()
    const reduce = useReducedMotion()

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

    if (labeled) {
        return (
            <div className={['hg-seg hg-seg--slide', className].filter(Boolean).join(' ')} role="radiogroup" aria-label="Tema">
                {OPTIONS.map(({ value, short, icon: Icon }) => (
                    <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={pref === value}
                        className={`hg-seg__opt theme-opt theme-opt--${value}`}
                        onClick={() => choose(value)}
                    >
                        {pref === value && (
                            <motion.span layoutId={`${id}-thumb`} className="hg-seg__thumb" transition={{ duration: reduce ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }} />
                        )}
                        <span className="hg-seg__text hg-seg__icon">
                            <Icon aria-hidden />
                        </span>
                        <span className="hg-seg__text">{short}</span>
                    </button>
                ))}
            </div>
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
