import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    achievementPercent,
    filterOptions,
    gameDuration,
    genreNames,
    inTab,
    parseLibraryHome,
    matchesFilters,
    moveInOrder,
    NO_FILTERS,
    sortGames,
} from './library'
import type { LibraryGame } from './tracker'
import { libraryGame } from './test-utils'

function game(overrides: Partial<LibraryGame> = {}): LibraryGame {
    return libraryGame(overrides)
}

const names = (games: LibraryGame[]) => games.map((g) => g.name)

describe('pestañas y datos derivados', () => {
    it('"todos" incluye todo menos la bandeja, los descartados y "Otros"', () => {
        assert.equal(inTab(game({ status: 'bandeja' }), 'todos'), false)
        assert.equal(inTab(game({ status: 'descartado' }), 'todos'), false)
        assert.equal(inTab(game({ status: 'otros' }), 'todos'), false)
        assert.equal(inTab(game({ status: 'ya_jugado' }), 'todos'), true)
        assert.equal(inTab(game({ status: 'ya_jugado' }), 'ya_jugado'), true)
        assert.equal(inTab(game({ status: 'otros' }), 'otros'), true)
        assert.equal(inTab(game({ status: 'ya_jugado' }), 'completado'), false)
        // Rejugable es una lista activa: sale en "Todos" y no cuenta como completado ni jugando.
        assert.equal(inTab(game({ status: 'rejugable' }), 'todos'), true)
        assert.equal(inTab(game({ status: 'rejugable' }), 'rejugable'), true)
        assert.equal(inTab(game({ status: 'rejugable' }), 'completado'), false)
        assert.equal(inTab(game({ status: 'rejugable' }), 'jugando'), false)
        assert.equal(inTab(game({ status: 'jugando' }), 'pendiente'), false)
        assert.equal(inTab(game({ status: 'bandeja' }), 'bandeja'), true)
        // Las marcas se suman al estado: un completado sin final está en las dos listas.
        const terraria = game({ status: 'completado', endless: true, favorite: true })
        assert.equal(inTab(terraria, 'completado'), true)
        assert.equal(inTab(terraria, 'sin_final'), true)
        assert.equal(inTab(terraria, 'favorito'), true)
        assert.equal(inTab(game({}), 'favorito'), false)
    })

    it('lee los géneros de la ficha de Steam e ignora lo que no encaja', () => {
        const g = game({ genres: [{ id: '1', description: 'Acción' }, { id: '25' }, 'raro', { id: '3', description: 'RPG' }] })
        assert.deepEqual(genreNames(g), ['Acción', 'RPG'])
        assert.deepEqual(genreNames(game({ genres: null })), [])
    })

    it('% de logros redondeado hacia abajo, null sin logros', () => {
        assert.equal(achievementPercent(game({ achievements_total: 3, achievements_unlocked: 2 })), 66)
        assert.equal(achievementPercent(game({ achievements_total: 0 })), null)
    })
})

describe('filtros', () => {
    it('género, año de completado y nota mínima', () => {
        const g = game({ genres: [{ id: '1', description: 'Acción' }], completed_at: '2025-06-01T10:00:00Z', rating: 8.5 })
        assert.equal(matchesFilters(g, { ...NO_FILTERS, genre: 'Acción' }), true)
        assert.equal(matchesFilters(g, { ...NO_FILTERS, genre: 'RPG' }), false)
        assert.equal(matchesFilters(g, { ...NO_FILTERS, completedYear: 2025 }), true)
        assert.equal(matchesFilters(g, { ...NO_FILTERS, completedYear: 2026 }), false)
        assert.equal(matchesFilters(g, { ...NO_FILTERS, minRating: 8 }), true)
        assert.equal(matchesFilters(g, { ...NO_FILTERS, minRating: 9 }), false)
        assert.equal(matchesFilters(game(), { ...NO_FILTERS, minRating: 0 }), false, 'sin nota no pasa el filtro de nota')
    })

    it('% de logros: los juegos sin logros solo salen sin filtro', () => {
        const none = game()
        const zero = game({ achievements_total: 10, achievements_unlocked: 0 })
        const almost = game({ achievements_total: 10, achievements_unlocked: 8 })
        const full = game({ achievements_total: 10, achievements_unlocked: 10 })
        const pick = (achievements: typeof NO_FILTERS.achievements) =>
            [none, zero, almost, full].filter((g) => matchesFilters(g, { ...NO_FILTERS, achievements }))
        assert.deepEqual(pick('todos'), [none, zero, almost, full])
        assert.deepEqual(pick('sin_logros'), [zero])
        assert.deepEqual(pick('empezados'), [almost, full])
        assert.deepEqual(pick('casi'), [almost])
        assert.deepEqual(pick('perfectos'), [full])
    })

    it('duración por tramos de la mediana de SteamSpy', () => {
        const at = (hours: number | null) => game({ steamspy_median_forever: hours === null ? null : hours * 60 })
        assert.equal(matchesFilters(at(4.9), { ...NO_FILTERS, duration: 'corto' }), true)
        assert.equal(matchesFilters(at(5), { ...NO_FILTERS, duration: 'medio' }), true)
        assert.equal(matchesFilters(at(39), { ...NO_FILTERS, duration: 'largo' }), true)
        assert.equal(matchesFilters(at(40), { ...NO_FILTERS, duration: 'muy_largo' }), true)
        assert.equal(matchesFilters(at(null), { ...NO_FILTERS, duration: 'sin_dato' }), true)
        assert.equal(matchesFilters(game({ steamspy_median_forever: 0 }), { ...NO_FILTERS, duration: 'sin_dato' }), true)
    })

    it('duración: HowLongToBeat antes que SteamSpy', () => {
        assert.deepEqual(gameDuration(game({ hltb_main: 600, hltb_main_extra: 900, steamspy_median_forever: 120 })), {
            main: 600,
            mainExtra: 900,
            completionist: null,
            source: 'hltb',
        })
        assert.equal(gameDuration(game({ steamspy_median_forever: 120 })).source, 'steamspy')
        assert.equal(gameDuration(game({ hltb_completionist: 3000 })).main, null)
        assert.equal(gameDuration(game({})).source, null)
        assert.equal(matchesFilters(game({ hltb_main: 20 * 60, steamspy_median_forever: 60 }), { ...NO_FILTERS, duration: 'largo' }), true)
    })

    it('marcas: favoritos, sin final o con final', () => {
        const cs = game({ endless: true })
        const fav = game({ favorite: true })
        const pick = (marks: typeof NO_FILTERS.marks) => [cs, fav].filter((g) => matchesFilters(g, { ...NO_FILTERS, marks }))
        assert.deepEqual(pick('todas'), [cs, fav])
        assert.deepEqual(pick('sin_final'), [cs])
        assert.deepEqual(pick('con_final'), [fav])
        assert.deepEqual(pick('favoritos'), [fav])
    })

    it('comprados o sin comprar', () => {
        const mine = game({ owned: true })
        const wanted = game({ owned: false })
        const pick = (own: typeof NO_FILTERS.own) => [mine, wanted].filter((g) => matchesFilters(g, { ...NO_FILTERS, own }))
        assert.deepEqual(pick('comprados'), [mine])
        assert.deepEqual(pick('sin_comprar'), [wanted])
    })

    it('opciones de los desplegables sin repetidos y ordenadas', () => {
        const opts = filterOptions([
            game({ genres: [{ description: 'RPG' }, { description: 'Acción' }], completed_at: '2024-01-01T12:00:00Z' }),
            game({ genres: [{ description: 'Acción' }], completed_at: '2026-03-01T12:00:00Z' }),
        ])
        assert.deepEqual(opts.genres, ['Acción', 'RPG'])
        assert.deepEqual(opts.years, [2026, 2024])
    })
})

describe('ordenaciones', () => {
    it('mi orden: por posición y los nuevos al final por orden de llegada', () => {
        const games = [
            game({ name: 'Nuevo 2', status_changed_at: '2026-10-20T00:00:00Z' }),
            game({ name: 'Segundo', backlog_position: 2 }),
            game({ name: 'Nuevo 1', status_changed_at: '2026-10-10T00:00:00Z' }),
            game({ name: 'Primero', backlog_position: 1 }),
        ]
        assert.deepEqual(names(sortGames(games, 'manual')), ['Primero', 'Segundo', 'Nuevo 1', 'Nuevo 2'])
    })

    it('nota y duración dejan los vacíos al final; empate por nombre', () => {
        const games = [game({ name: 'B', rating: null }), game({ name: 'C', rating: 7 }), game({ name: 'A', rating: 7 }), game({ name: 'D', rating: 9 })]
        assert.deepEqual(names(sortGames(games, 'nota')), ['D', 'A', 'C', 'B'])
        const durations = [game({ name: 'Sin' }), game({ name: 'Largo', steamspy_median_forever: 3000 }), game({ name: 'Corto', steamspy_median_forever: 60 })]
        assert.deepEqual(names(sortGames(durations, 'duracion')), ['Corto', 'Largo', 'Sin'])
    })

    it('jugado recientemente con los nunca jugados al final', () => {
        const games = [
            game({ name: 'Nunca' }),
            game({ name: 'Ayer', rtime_last_played: '2026-10-23T00:00:00Z' }),
            game({ name: 'Antes', rtime_last_played: '2026-01-01T00:00:00Z' }),
        ]
        assert.deepEqual(names(sortGames(games, 'reciente')), ['Ayer', 'Antes', 'Nunca'])
    })

    it('no modifica el array de entrada', () => {
        const games = [game({ name: 'B' }), game({ name: 'A' })]
        sortGames(games, 'nombre')
        assert.deepEqual(names(games), ['B', 'A'])
    })
})

describe('lista de inicio', () => {
    it('lee lo guardado y corrige lo que no reconoce', () => {
        const home = parseLibraryHome({ tab: 'pendiente', sort: 'descuento', view: 'cuadricula', filters: { own: 'sin_comprar', genre: 'RPG' } })
        assert.deepEqual(home, {
            tab: 'pendiente',
            sort: 'descuento',
            view: 'cuadricula',
            filters: { ...NO_FILTERS, own: 'sin_comprar', genre: 'RPG' },
        })
        // Un orden que no existe en esa lista vuelve al de por defecto.
        assert.equal(parseLibraryHome({ tab: 'completado', sort: 'manual' })?.sort, 'completado')
        assert.equal(parseLibraryHome({ tab: 'inventada' })?.tab, 'todos')
        assert.equal(parseLibraryHome({ tab: 'ya_jugado' })?.tab, 'ya_jugado')
        assert.equal(parseLibraryHome({ tab: 'otros' })?.tab, 'otros')
        // Rejugables: por defecto, el jugado más recientemente; la nota no tiene sentido (se pone al completar).
        assert.deepEqual(parseLibraryHome({ tab: 'rejugable' }), { tab: 'rejugable', sort: 'reciente', view: 'lista', filters: NO_FILTERS })
        assert.equal(parseLibraryHome({ tab: 'rejugable', sort: 'nota' })?.sort, 'reciente')
        assert.equal(parseLibraryHome(null), null)
    })
})

describe('arrastrar pendientes', () => {
    it('mueve hacia arriba y hacia abajo', () => {
        assert.deepEqual(moveInOrder([1, 2, 3, 4], 4, 2), [1, 4, 2, 3])
        assert.deepEqual(moveInOrder([1, 2, 3, 4], 1, 3), [2, 3, 1, 4])
    })

    it('ignora destinos desconocidos', () => {
        assert.deepEqual(moveInOrder([1, 2], 1, 9), [1, 2])
    })
})
