'use client'

import { useSyncExternalStore } from 'react'

const noop = () => () => {}
const isApple = () => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)

/** Atajo del buscador de juegos como se escribe en la interfaz: «Ctrl + K», o «⌘ + K» en Mac. */
export function useSearchShortcut(): string {
    // En el servidor no se sabe el sistema: «Ctrl + K» y, al hidratar, «⌘ + K» si es un Mac.
    const apple = useSyncExternalStore(noop, isApple, () => false)
    return apple ? '⌘ + K' : 'Ctrl + K'
}

/** Pista de teclado del buscador (`<kbd>`). */
export default function SearchShortcut({ className }: { className?: string }) {
    return <kbd className={className}>{useSearchShortcut()}</kbd>
}
