// Qué vacío enseña la biblioteca y con qué acción (la vista pone los textos de las listas, el icono y el color).
import type { LibraryTab } from './library'

/** Acción del vacío: ir a otra lista (con su recuento), abrir el buscador o clasificar la bandeja. */
export type EmptyAction = { kind: 'tab'; tab: LibraryTab; count: number } | { kind: 'search' } | { kind: 'tray'; count: number } | null

export type LibraryEmpty =
    /** Los filtros dejan la lista vacía: neutro, con cuántos hay sin ellos y «Quitar filtros». */
    | { kind: 'filters'; total: number }
    /** Ni un juego, ni clasificado ni en la bandeja: falta Steam (o la primera sincronización). */
    | { kind: 'steam' }
    /** Todo está en la bandeja: tamaño página, con «Clasificar la bandeja». */
    | { kind: 'unclassified'; tray: number }
    /** Esta lista está vacía: su icono y su color, qué saldrá aquí y a dónde ir. */
    | { kind: 'list'; tab: LibraryTab; text: string; action: EmptyAction }

/** Frase de cada lista vacía: qué saldrá aquí o cómo se llena. */
export const LIST_EMPTY_TEXT: Record<LibraryTab, string> = {
    todos: 'Aquí salen tus juegos clasificados, menos los descartados y los de «Otros».',
    jugando: 'Empieza uno de tus pendientes y aparecerá aquí.',
    pendiente: 'Añade juegos desde la bandeja o el buscador para jugarlos más adelante.',
    pausado: 'Cuando dejes un juego a medias, pásalo aquí desde su ficha o su menú.',
    rejugable: 'Juegos de partidas sueltas a los que vuelves de vez en cuando, sin un final que perseguir.',
    completado: 'Al completar un juego desde su ficha o la bandeja, se queda aquí con tu nota.',
    abandonado: 'Los juegos que empiezas y dejas. De momento, ninguno.',
    ya_jugado: 'Juegos que jugaste antes de HubGames o sin seguimiento: ni completados ni abandonados.',
    descartado: 'Los que tienes pero no te interesan. Se descartan desde la bandeja o el menú de cada juego.',
    otros: 'Software, demos, betas y bandas sonoras: lo que no encaja en ninguna lista.',
    favorito: 'Marca con el corazón los juegos que más te gustan, estén en la lista que estén.',
    sin_final: 'Marca con ∞ los juegos que no se terminan: se juegan.',
    bandeja: 'Nada por clasificar.',
}

/** A dónde lleva el vacío de cada lista: una lista vecina con juegos, la bandeja o el buscador. */
function listAction(tab: LibraryTab, counts: Record<LibraryTab, number>): EmptyAction {
    const toTab = (t: LibraryTab): EmptyAction => (counts[t] > 0 ? { kind: 'tab', tab: t, count: counts[t] } : null)
    const tray: EmptyAction = counts.bandeja > 0 ? { kind: 'tray', count: counts.bandeja } : null
    switch (tab) {
        case 'jugando':
            return toTab('pendiente') ?? { kind: 'search' }
        case 'pendiente':
        case 'todos':
            return tray ?? { kind: 'search' }
        case 'pausado':
        case 'completado':
            return toTab('jugando')
        case 'favorito':
            return toTab('completado')
        case 'sin_final':
            return toTab('rejugable')
        case 'ya_jugado':
        case 'otros':
        case 'rejugable':
            return tray
        default:
            return null
    }
}

/**
 * El vacío de la biblioteca para la lista `tab` con `total` juegos (sin filtros) y `filtered` si hay filtros puestos.
 * `counts` lleva lo de cada lista y `classified` (todo lo que no está en la bandeja).
 */
export function libraryEmpty(tab: LibraryTab, counts: Record<LibraryTab, number> & { classified: number }, filtered: boolean): LibraryEmpty {
    if (filtered && counts[tab] > 0) return { kind: 'filters', total: counts[tab] }
    if (counts.classified === 0) return counts.bandeja > 0 ? { kind: 'unclassified', tray: counts.bandeja } : { kind: 'steam' }
    return { kind: 'list', tab, text: LIST_EMPTY_TEXT[tab], action: listAction(tab, counts) }
}
