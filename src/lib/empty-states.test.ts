import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIBRARY_TABS, type LibraryTab } from './library'
import { LIST_EMPTY_TEXT, libraryEmpty } from './empty-states'

const counts = (over: Partial<Record<LibraryTab, number>> = {}) => {
    const out = Object.fromEntries(LIBRARY_TABS.map((t) => [t, 0])) as Record<LibraryTab, number>
    Object.assign(out, over)
    return { ...out, classified: out.todos + out.descartado + out.otros }
}

test('libraryEmpty: con filtros y juegos en la lista, el vacío es de los filtros', () => {
    assert.deepEqual(libraryEmpty('pendiente', counts({ todos: 41, pendiente: 41 }), true), { kind: 'filters', total: 41 })
})

test('libraryEmpty: sin nada clasificado, bandeja con juegos o falta Steam', () => {
    assert.deepEqual(libraryEmpty('todos', counts({ bandeja: 212 }), false), { kind: 'unclassified', tray: 212 })
    assert.deepEqual(libraryEmpty('todos', counts(), false), { kind: 'steam' })
    // Los filtros no tapan que no hay nada: con la lista a 0 manda el vacío de verdad
    assert.deepEqual(libraryEmpty('todos', counts(), true), { kind: 'steam' })
})

test('libraryEmpty: lista vacía con su frase y una lista vecina con juegos', () => {
    const c = counts({ todos: 64, jugando: 3, completado: 58, rejugable: 6, bandeja: 12 })
    assert.deepEqual(libraryEmpty('pausado', c, false), { kind: 'list', tab: 'pausado', text: LIST_EMPTY_TEXT.pausado, action: { kind: 'tab', tab: 'jugando', count: 3 } })
    assert.deepEqual(libraryEmpty('otros', c, false), { kind: 'list', tab: 'otros', text: LIST_EMPTY_TEXT.otros, action: { kind: 'tray', count: 12 } })
    assert.deepEqual((libraryEmpty('sin_final', c, false) as { action: unknown }).action, { kind: 'tab', tab: 'rejugable', count: 6 })
})

test('libraryEmpty: sin a dónde ir, sin acción; Jugando y Pendientes acaban en el buscador', () => {
    const c = counts({ todos: 5, completado: 5 })
    assert.equal((libraryEmpty('abandonado', c, false) as { action: unknown }).action, null)
    assert.equal((libraryEmpty('pausado', c, false) as { action: unknown }).action, null)
    assert.deepEqual((libraryEmpty('jugando', c, false) as { action: unknown }).action, { kind: 'search' })
    assert.deepEqual((libraryEmpty('pendiente', c, false) as { action: unknown }).action, { kind: 'search' })
})

test('LIST_EMPTY_TEXT: una frase por lista, sin títulos con punto', () => {
    for (const t of LIBRARY_TABS) assert.ok(LIST_EMPTY_TEXT[t].length > 0 && LIST_EMPTY_TEXT[t].length <= 140, t)
})
