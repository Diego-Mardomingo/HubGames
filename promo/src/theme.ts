import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadSora } from '@remotion/google-fonts/Sora'
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono'
import { Easing, interpolate } from 'remotion'

const inter = loadInter('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] })
const sora = loadSora('normal', { weights: ['600', '700', '800'], subsets: ['latin'] })
const mono = loadMono('normal', { weights: ['500', '700'], subsets: ['latin'] })

/** Tokens de la app ("consola premium": casi negro, cristal, violeta → cian). */
export const C = {
    bg: '#07070c',
    fg: '#eceaf6',
    muted: '#8e8ba8',
    mutedLight: '#b3b0cc',
    surface: '#0f0e18',
    surface2: '#151422',
    surface3: '#1d1c2e',
    border: 'rgba(255,255,255,0.08)',
    borderHover: 'rgba(255,255,255,0.16)',
    primary: '#9a86ff',
    accent: '#2ad4f0',
    success: '#34d399',
    danger: '#fb7185',
    warning: '#fbbf24',
    gold: '#fcd34d',
    grad: 'linear-gradient(120deg, #b69cff 0%, #6f8bff 52%, #2ad4f0 100%)',
    gradSoft: 'linear-gradient(120deg, rgba(182,156,255,0.18), rgba(42,212,240,0.12))',
    glass: 'rgba(20,19,34,0.72)',
}

export const F = {
    body: inter.fontFamily,
    display: sora.fontFamily,
    mono: mono.fontFamily,
}

const OUT = Easing.bezier(0.22, 1, 0.36, 1)

/** 0 → 1 entre `start` y `start + dur`, con la curva de salida de la app. */
export const ease = (f: number, start: number, dur: number, easing = OUT) =>
    interpolate(f, [start, start + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing })

/** Rebote suave para "pops". */
export const pop = (f: number, start: number, dur = 18) =>
    interpolate(f, [start, start + dur], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
    })

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Formato español: 1.240, 23,99 */
export const nf = (n: number, decimals = 0) => {
    const [int, dec] = n.toFixed(decimals).split('.')
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return dec ? `${grouped},${dec}` : grouped
}

/** Fondo, entrada y salida de un bloque: aparece desde abajo con desenfoque. */
export const rise = (f: number, start: number, dur = 20, dist = 40) => {
    const t = ease(f, start, dur)
    return {
        opacity: t,
        translate: `0 ${(1 - t) * dist}px`,
        filter: t < 1 ? `blur(${(1 - t) * 10}px)` : undefined,
    } as const
}
