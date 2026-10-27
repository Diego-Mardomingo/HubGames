// Lógica pura del diálogo «Completar juego»: la nota con puntos (teclado, ratón y toque) y el avance de un lote desde la
// bandeja. Sin dependencias del navegador ni de Supabase, con tests.

/** Redondea a medios puntos entre 0 y 10. */
export function clampRating(value: number): number {
    return Math.max(0, Math.min(10, Math.round(value * 2) / 2))
}

/**
 * Lo que hace una tecla con el foco en la nota: `{ rating }` la cambia (null = sin nota), `'submit'` guarda y null no es
 * suya. Flechas y +/- suman o restan medio punto (sin nota, empiezan en 5), una cifra pone esa nota, Inicio/Fin 0 y 10, y
 * Supr o Retroceso la quitan.
 */
export function ratingForKey(current: number | null, key: string): { rating: number | null } | 'submit' | null {
    if (/^[0-9]$/.test(key)) return { rating: Number(key) }
    switch (key) {
        case 'ArrowRight':
        case 'ArrowUp':
        case '+':
            return { rating: current === null ? 5 : clampRating(current + 0.5) }
        case 'ArrowLeft':
        case 'ArrowDown':
        case '-':
            return { rating: current === null ? 5 : clampRating(current - 0.5) }
        case 'Home':
            return { rating: 0 }
        case 'End':
            return { rating: 10 }
        case 'Delete':
        case 'Backspace':
            return { rating: null }
        case 'Enter':
            return 'submit'
        default:
            return null
    }
}

/**
 * Nota bajo el puntero, con `fraction` de 0 (borde izquierdo de la fila de diez puntos) a 1 (derecho): la mitad izquierda
 * de cada punto es su ,5. Nunca baja de 0,5 (el 0 se pone con el teclado o «Sin nota»).
 */
export function ratingAtFraction(fraction: number): number {
    const f = Math.max(0, Math.min(1, fraction))
    return Math.max(0.5, Math.min(10, Math.ceil(f * 20) / 2))
}

/** Toque (sin arrastrar) en un punto: pone la cifra entera y, si ya la tenía, le quita medio (8 → 7,5). */
export function ratingTap(previous: number | null, pointed: number): number {
    const whole = Math.ceil(pointed)
    return previous === whole ? whole - 0.5 : whole
}

/** Un punto (1 a 10) está encendido entero, a medias o apagado con esa nota. */
export function dotFill(rating: number | null, position: number): 'full' | 'half' | 'off' {
    if (rating === null) return 'off'
    if (rating >= position) return 'full'
    return rating === position - 0.5 ? 'half' : 'off'
}

/**
 * Puntos que se encienden al pasar de `from` a `to`, con su retraso (en orden, `stepMs` entre uno y otro) para el pop en
 * cadena. Al bajar no se enciende ninguno: se apagan de golpe.
 */
export function newlyLitDots(from: number | null, to: number | null, stepMs = 22): Map<number, number> {
    const out = new Map<number, number>()
    if (to === null) return out
    let j = 0
    for (let p = 1; p <= 10; p++) {
        if (dotFill(to, p) !== 'off' && dotFill(from, p) === 'off') out.set(p, j++ * stepMs)
    }
    return out
}

// ── Lote (bandeja → Completado con varios seleccionados) ──

export type BatchMark = 'todo' | 'done' | 'skip'

export interface BatchState {
    /** Uno por juego del lote, en orden. */
    marks: BatchMark[]
    /** Juego actual; `marks.length` cuando ya no queda ninguno. */
    index: number
}

export function startBatch(size: number): BatchState {
    return { marks: Array.from({ length: size }, () => 'todo'), index: 0 }
}

/** Marca el actual como completado o saltado y pasa al siguiente. */
export function batchStep(state: BatchState, outcome: 'done' | 'skip'): BatchState {
    if (state.index >= state.marks.length) return state
    const marks = state.marks.slice()
    marks[state.index] = outcome
    return { marks, index: state.index + 1 }
}

/** «Completar los N restantes sin nota»: el actual y todos los que faltan pasan a completados. */
export function completeRest(state: BatchState): BatchState {
    const marks = state.marks.map((m, i) => (i >= state.index ? 'done' : m))
    return { marks, index: marks.length }
}

export function batchFinished(state: BatchState): boolean {
    return state.index >= state.marks.length
}

/** Cuántos quedan después del actual. */
export function batchLeft(state: BatchState): number {
    return Math.max(0, state.marks.length - state.index - 1)
}

export function batchSummary(state: BatchState): { done: number; skipped: number } {
    return {
        done: state.marks.filter((m) => m === 'done').length,
        skipped: state.marks.filter((m) => m === 'skip').length,
    }
}
