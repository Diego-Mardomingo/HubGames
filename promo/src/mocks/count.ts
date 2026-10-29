import { ease, nf } from '../theme'

/** Cifra que cuenta (`CountUp`): de 0 (o `from`) a `to` en `dur` frames desde `start`. */
export const count = (f: number, start: number, to: number, dur = 14, decimals = 0, from = 0) => nf(from + (to - from) * ease(f, start, dur), decimals)

/** Contador que salta (`AnimatedCount`): la cápsula hace pop y la cifra entra desde abajo al cambiar en `at`. */
export const jump = (f: number, at: number) => {
    const t = ease(f, at, 7)
    return { changed: f >= at, t, scale: 1 + Math.sin(Math.min(1, Math.max(0, (f - at) / 9)) * Math.PI) * 0.22, dy: (1 - t) * 10 }
}
