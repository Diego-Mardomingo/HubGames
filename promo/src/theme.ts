import { loadFont as loadOnest } from '@remotion/google-fonts/Onest'
import type { CSSProperties } from 'react'
import { Easing, interpolate } from 'remotion'

const onest = loadOnest('normal', { weights: ['400', '500', '600', '700', '800'], subsets: ['latin', 'latin-ext'] })

export type Mode = 'light' | 'dark'

/**
 * Tokens de la app (src/styles/globals.css), claro y oscuro. Las maquetas pintan siempre con `var(--…)` (ver `C`) y el
 * tema lo pone `themeVars(mode)` en el contenedor, igual que `data-theme` en la web.
 */
const TOKENS: Record<Mode, Record<string, string>> = {
    light: {
        background: '#eef0f3',
        foreground: '#1b1f27',
        muted: '#5d6472',
        surface: '#ffffff',
        'surface-2': '#e4e7ec',
        'surface-3': '#d6dae1',
        border: '#dadde3',
        'border-hover': '#c3c8d1',
        primary: '#2453ff',
        'primary-glow': 'rgba(36, 83, 255, 0.12)',
        'primary-foreground': '#ffffff',
        danger: '#c7243b',
        'danger-foreground': '#ffffff',
        success: '#1a7743',
        warning: '#8e5e18',
        'rar-comun': '#8a8f98',
        'rar-poco': '#2e9e5b',
        'rar-rara': '#2f6fe0',
        'rar-epica': '#8b4fd8',
        'rar-leg': '#c98a0b',
        'rar-ink': '62%',
        'medal-1': '#c08a00',
        'medal-2': '#8b95a3',
        'medal-3': '#b0642d',
        'medal-ink': '62%',
        'st-bandeja': '#5d6472',
        'st-pendiente': '#0b7285',
        'st-jugando': '#2453ff',
        'st-pausado': '#8e5e18',
        'st-completado': '#1a7743',
        'st-abandonado': '#c7243b',
        'st-descartado': '#6b7280',
        'st-yajugado': '#5c5b06',
        'st-otros': '#931f8f',
        'st-rejugable': '#9c3c08',
        'st-favorito': '#c2255c',
        'st-sinfinal': '#6741d9',
        'on-done': '#ffffff',
        'sc-top': '#1a7743',
        'sc-good': '#4d7c0f',
        'sc-mid': '#8e5e18',
        'sc-bad': '#c7243b',
        deal: '#f5c400',
        'deal-foreground': '#2b2100',
        tint: '12%',
        'shadow-sm': '0 1px 2px rgba(20, 24, 33, 0.06)',
        'shadow-lg': '0 16px 40px -16px rgba(20, 24, 33, 0.22)',
        'shadow-win': '0 40px 90px -30px rgba(20, 24, 33, 0.35), 0 2px 6px rgba(20, 24, 33, 0.06)',
    },
    dark: {
        background: '#15171c',
        foreground: '#e8eaee',
        muted: '#9aa1ae',
        surface: '#1e2129',
        'surface-2': '#282c36',
        'surface-3': '#323744',
        border: '#2e323c',
        'border-hover': '#404553',
        primary: '#7b9bff',
        'primary-glow': 'rgba(123, 155, 255, 0.14)',
        'primary-foreground': '#0e1220',
        danger: '#f26b7e',
        'danger-foreground': '#1b0a0d',
        success: '#4cc97e',
        warning: '#f2b53a',
        'rar-comun': '#9aa0aa',
        'rar-poco': '#4cc97e',
        'rar-rara': '#5b93ff',
        'rar-epica': '#b07cff',
        'rar-leg': '#f2b53a',
        'rar-ink': '100%',
        'medal-1': '#f5c542',
        'medal-2': '#c3cad4',
        'medal-3': '#e39a62',
        'medal-ink': '100%',
        'st-bandeja': '#9aa1ae',
        'st-pendiente': '#3bc9db',
        'st-jugando': '#7b9bff',
        'st-pausado': '#f2b53a',
        'st-completado': '#4cc97e',
        'st-abandonado': '#f26b7e',
        'st-descartado': '#8a919e',
        'st-yajugado': '#d2cf5c',
        'st-otros': '#eb84f8',
        'st-rejugable': '#ff9a5c',
        'st-favorito': '#f783ac',
        'st-sinfinal': '#b197fc',
        'on-done': '#0b1f13',
        'sc-top': '#4cc97e',
        'sc-good': '#a9d15b',
        'sc-mid': '#f2b53a',
        'sc-bad': '#f26b7e',
        deal: '#ffd43b',
        'deal-foreground': '#221a00',
        tint: '14%',
        'shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.3)',
        'shadow-lg': '0 20px 48px -18px rgba(0, 0, 0, 0.6)',
        'shadow-win': '0 40px 90px -30px rgba(0, 0, 0, 0.75), 0 2px 6px rgba(0, 0, 0, 0.3)',
    },
}

/** Variables CSS de un tema, para el `style` del contenedor. */
export const themeVars = (mode: Mode): CSSProperties =>
    Object.fromEntries(Object.entries(TOKENS[mode]).map(([k, v]) => [`--${k}`, v])) as CSSProperties

/** Valor escrito de un token (para lo que no admite variables). */
export const token = (mode: Mode, name: string) => TOKENS[mode][name]

const v = (name: string) => `var(--${name})`

/** Colores como referencias a las variables del tema activo. */
export const C = {
    bg: v('background'),
    fg: v('foreground'),
    muted: v('muted'),
    surface: v('surface'),
    surface2: v('surface-2'),
    surface3: v('surface-3'),
    border: v('border'),
    borderHover: v('border-hover'),
    primary: v('primary'),
    primaryGlow: v('primary-glow'),
    primaryFg: v('primary-foreground'),
    danger: v('danger'),
    dangerFg: v('danger-foreground'),
    success: v('success'),
    warning: v('warning'),
    deal: v('deal'),
    dealFg: v('deal-foreground'),
    onDone: v('on-done'),
    shadowSm: v('shadow-sm'),
    shadowLg: v('shadow-lg'),
    shadowWin: v('shadow-win'),
    st: {
        bandeja: v('st-bandeja'),
        pendiente: v('st-pendiente'),
        jugando: v('st-jugando'),
        pausado: v('st-pausado'),
        rejugable: v('st-rejugable'),
        completado: v('st-completado'),
        abandonado: v('st-abandonado'),
        yajugado: v('st-yajugado'),
        descartado: v('st-descartado'),
        otros: v('st-otros'),
        favorito: v('st-favorito'),
        sinfinal: v('st-sinfinal'),
    },
    sc: { top: v('sc-top'), good: v('sc-good'), mid: v('sc-mid'), bad: v('sc-bad') },
    rar: { comun: v('rar-comun'), poco: v('rar-poco'), rara: v('rar-rara'), epica: v('rar-epica'), leg: v('rar-leg') },
    medal: [v('medal-1'), v('medal-2'), v('medal-3')],
}

/** Fondo tenue de un color (`.hg-tint`): 12 % en claro, 14 % en oscuro. */
export const tint = (c: string, amount = 'var(--tint)') => `color-mix(in srgb, ${c} ${amount}, transparent)`
/** Rareza como texto (`.rar-ink`): en claro se mezcla con el texto para llegar a 4,5:1. */
export const rarInk = (c: string) => `color-mix(in srgb, ${c} var(--rar-ink), var(--foreground))`
/** Medalla como texto (`--medal-ink`). */
export const medalInk = (c: string) => `color-mix(in srgb, ${c} var(--medal-ink), var(--foreground))`

export const F = { body: onest.fontFamily }

/** Curva `--ease-out` de la app. */
const OUT = Easing.bezier(0.22, 1, 0.36, 1)

/** 0 → 1 entre `start` y `start + dur`, con la curva de salida de la app. */
export const ease = (f: number, start: number, dur: number, easing = OUT) =>
    interpolate(f, [start, start + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing })

/** Pop corto (los `.hg-pop-in` de la app): un poco de rebote, sin exagerar. */
export const pop = (f: number, start: number, dur = 10) =>
    interpolate(f, [start, start + dur], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.34, 1.4, 0.64, 1),
    })

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Mezcla dos colores (para transiciones de color entre listas). */
export const mix = (a: string, b: string, t: number) => (t <= 0 ? a : t >= 1 ? b : `color-mix(in srgb, ${b} ${Math.round(t * 100)}%, ${a})`)

/** Formato español: 1.240, 23,99 */
export const nf = (n: number, decimals = 0) => {
    const [int, dec] = n.toFixed(decimals).split('.')
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return dec ? `${grouped},${dec}` : grouped
}

/** Entrada `.hg-enter`: sube 8 px y aparece. En el vídeo, algo más de recorrido para que se lea a 30 fps. */
export const rise = (f: number, start: number, dur = 10, dist = 12) => {
    const t = ease(f, start, dur)
    return { opacity: t, translate: `0 ${(1 - t) * dist}px` } as const
}
