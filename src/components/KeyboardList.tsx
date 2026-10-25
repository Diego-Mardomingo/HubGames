'use client'

import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'

/**
 * Donde se escribe, las teclas son del usuario: ni j/k ni flechas. Tampoco en el asa de arrastre de dnd-kit,
 * que usa las flechas para mover el elemento.
 */
export function isTyping(el: Element | null): boolean {
    if (!el) return false
    if ((el as HTMLElement).isContentEditable) return true
    return !!el.closest(
        'input, textarea, select, [role="dialog"], [role="radiogroup"], [role="listbox"], [role="menu"], [aria-roledescription="sortable"]',
    )
}

/**
 * Lista navegable con teclado (cursor de selección): ↑/↓ o j/k mueven el foco entre los enlaces principales de las
 * filas (`[data-row-link]`) y Enter, nativo del enlace, abre la ficha. Las flechas solo actúan con el foco dentro de
 * la lista (fuera siguen desplazando la página); j/k también entran en ella desde cualquier sitio que no sea un campo
 * ni otra lista navegable (con varias en la página, entra en la primera).
 */
export default function KeyboardList({
    children,
    className,
    label,
    as: Tag = 'ul',
    onKeyDown,
}: {
    children: ReactNode
    className?: string
    label: string
    as?: 'ul' | 'ol'
    /** Atajos propios de la lista (la bandeja clasifica con cifras). */
    onKeyDown?: (e: ReactKeyboardEvent<HTMLElement>) => void
}) {
    const ref = useRef<HTMLUListElement & HTMLOListElement>(null)

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
            const list = ref.current
            if (!list) return
            const arrow = e.key === 'ArrowDown' || e.key === 'ArrowUp'
            const letter = e.key === 'j' || e.key === 'k'
            if (!arrow && !letter) return
            const focused = document.activeElement
            const inside = !!focused && list.contains(focused)
            if (isTyping(focused) || (arrow && !inside)) return
            if (!inside && focused?.closest('[data-keyboard-list]')) return

            const links = Array.from(list.querySelectorAll<HTMLElement>('[data-row-link]'))
            if (links.length === 0) return
            const current = inside ? links.findIndex((l) => l.closest('li')?.contains(focused)) : -1
            const down = e.key === 'ArrowDown' || e.key === 'j'
            const next = current === -1 ? (down ? 0 : links.length - 1) : Math.max(0, Math.min(links.length - 1, current + (down ? 1 : -1)))
            e.preventDefault()
            links[next].focus()
            links[next].closest('li')?.scrollIntoView({ block: 'nearest' })
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [])

    return (
        <Tag ref={ref} className={className} aria-label={label} data-keyboard-list="" onKeyDown={onKeyDown}>
            {children}
        </Tag>
    )
}
