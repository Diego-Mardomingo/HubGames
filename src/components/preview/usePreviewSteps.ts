'use client'

import { useEffect, useState } from 'react'

/** Pasos de la vista previa «en acción»: 1 Hades II pasa a Jugando, 2 se desbloquea un logro, 3 destella el mínimo histórico. */
export const PREVIEW_STEPS = [700, 1200, 1600] as const
export const PREVIEW_LAST_STEP = PREVIEW_STEPS.length

/**
 * Paso actual de la vista previa del producto (portada sin sesión, login y registro). Avanza una sola vez al montar;
 * con `prefers-reduced-motion`, salta directamente al estado final.
 */
export function usePreviewSteps() {
    const [step, setStep] = useState(0)

    useEffect(() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const timers = (reduced ? [0] : PREVIEW_STEPS).map((ms, i) =>
            window.setTimeout(() => setStep(reduced ? PREVIEW_LAST_STEP : i + 1), ms)
        )
        return () => timers.forEach(clearTimeout)
    }, [])

    return step
}
