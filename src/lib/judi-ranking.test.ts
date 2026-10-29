import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    buildRanking,
    daysBefore,
    hasRankingDays,
    rankingGap,
    rankingTrend,
    rankingWindow,
    rankOf,
    type JudiProgressRecord,
} from './judi-ranking'

/** Partida terminada: `fails` intentos fallados y acertada (o no). */
function game(user: string, fails: number, won: boolean, dia?: string): JudiProgressRecord {
    const r: JudiProgressRecord = { id_usuario: user, username: user, completado: won }
    for (let i = 1; i <= 6; i++) (r as Record<string, unknown>)[`fase${i}`] = i <= fails
    if (dia !== undefined) r.dia = dia
    return r
}

describe('ranking de JUDI', () => {
    it('suma puntos, aciertos, precisión y media de intentos al acertar', () => {
        const [a] = buildRanking([game('ana', 0, true), game('ana', 2, true), game('ana', 6, false)])
        assert.equal(a.points, 6 + 4)
        assert.equal(a.wins, 2)
        assert.equal(a.losses, 1)
        assert.equal(a.accuracy, 67)
        assert.equal(a.avgAttempts, 2) // (1 + 3) / 2
        assert.equal(a.rank, 1)
    })

    it('sin aciertos, sin media', () => {
        const [a] = buildRanking([game('ana', 6, false)])
        assert.equal(a.avgAttempts, null)
        assert.equal(a.points, 0)
    })

    it('ignora partidas sin terminar', () => {
        const open = { id_usuario: 'ana', completado: false, fase1: true } as JudiProgressRecord
        assert.deepEqual(buildRanking([open]), [])
    })

    it('empate total = mismo puesto, y el siguiente salta (1, 2, 2, 4)', () => {
        const r = buildRanking([
            game('ana', 0, true), game('ana', 0, true),
            game('bea', 0, true), game('carla', 0, true),
            game('dani', 3, true),
        ])
        assert.deepEqual(r.map((e) => [e.username, e.rank, e.sharedRank]), [
            ['ana', 1, false], ['bea', 2, true], ['carla', 2, true], ['dani', 4, false],
        ])
    })

    it('empate a puntos que desempatan los aciertos: puestos distintos y pointsTie', () => {
        // ana: 6 = una a la primera; bea: 3 + 3 = dos aciertos
        const r = buildRanking([game('ana', 0, true), game('bea', 3, true), game('bea', 3, true)])
        assert.deepEqual(r.map((e) => [e.username, e.rank, e.pointsTie, e.sharedRank]), [
            ['bea', 1, true, false], ['ana', 2, true, false],
        ])
    })

    it('rankOf usa el puesto compartido', () => {
        const r = buildRanking([game('ana', 0, true), game('bea', 0, true)])
        assert.deepEqual(rankOf(r, 'bea'), { position: 1, total: 2 })
        assert.equal(rankOf(r, 'nadie'), null)
        assert.equal(rankOf(r, null), null)
    })
})

describe('tendencia', () => {
    it('sin día en las filas (RPC sin migrar) no hay tendencia', () => {
        assert.equal(hasRankingDays([game('ana', 0, true)]), false)
        assert.equal(hasRankingDays([]), false)
        assert.equal(rankingTrend([game('ana', 0, true)], '2026-10-29'), null)
        assert.equal(rankingTrend([game('ana', 0, true, '2026-10-01'), game('bea', 0, true)], '2026-10-29'), null)
    })

    it('daysBefore', () => {
        assert.equal(daysBefore('2026-10-29', 30), '2026-09-29')
        assert.equal(daysBefore('2026-03-01', 1), '2026-02-28')
    })

    it('compara con el ranking sin los últimos 30 días de JUDI', () => {
        const rows = [
            game('ana', 0, true, '2026-09-01'), game('ana', 0, true, '2026-09-02'), // 12 antes
            game('bea', 0, true, '2026-09-01'), // 6 antes
            game('bea', 0, true, '2026-10-20'), game('bea', 0, true, '2026-10-21'), // +12 en la ventana
            game('carla', 1, true, '2026-10-28'), // nueva
        ]
        const t = rankingTrend(rows, '2026-10-29')!
        assert.deepEqual(t.get('bea'), { kind: 'up', delta: 1, gain: 12, previousRank: 2 })
        assert.deepEqual(t.get('ana'), { kind: 'down', delta: 1, gain: 0, previousRank: 1 })
        assert.deepEqual(t.get('carla'), { kind: 'new', delta: 0, gain: 5, previousRank: null })
    })

    it('el día del corte cuenta como «antes»', () => {
        const t = rankingTrend([game('ana', 0, true, '2026-09-29'), game('ana', 0, true, '2026-09-30')], '2026-10-29')!
        assert.deepEqual(t.get('ana'), { kind: 'same', delta: 0, gain: 6, previousRank: 1 })
    })
})

describe('distancia', () => {
    const r = buildRanking([
        game('ana', 0, true), game('ana', 0, true), // 12
        game('bea', 0, true), game('bea', 3, true), // 9
        game('carla', 0, true), game('carla', 3, true), // 9 (empata a puntos con bea; desempata el nombre: sameStanding)
        game('dani', 2, true), // 4
    ])

    it('primero: ventaja sobre el segundo', () => {
        const g = rankingGap(r, 'ana')
        assert.equal(g?.kind, 'lead')
        assert.equal(g && 'points' in g ? g.points : null, 3)
    })

    it('empatas a puntos con alguien por delante', () => {
        const g = rankingGap(r, 'carla')
        assert.equal(g?.kind, 'tie')
        assert.equal(g && 'other' in g ? g.other.username : null, 'bea')
    })

    it('detrás: los puntos para pasar al primero que tiene más', () => {
        const g = rankingGap(r, 'dani')
        assert.equal(g?.kind, 'behind')
        assert.equal(g && 'points' in g ? g.points : null, 6) // 9 - 4 + 1
        assert.equal(g && 'other' in g ? g.other.username : null, 'carla')
    })

    it('solo o fuera', () => {
        assert.deepEqual(rankingGap(buildRanking([game('ana', 0, true)]), 'ana'), { kind: 'solo' })
        assert.equal(rankingGap(r, 'nadie'), null)
    })
})

describe('ventana de listas largas', () => {
    const list = Array.from({ length: 40 }, (_, i) => ({ userId: `u${i + 1}` }))
    const shape = (items: ReturnType<typeof rankingWindow<{ userId: string }>>['items']) =>
        items.map((it) => (it.kind === 'gap' ? '·' : it.index + 1)).join(' ')

    it('menos de 15: entera', () => {
        const w = rankingWindow(list.slice(0, 14), 'u3')
        assert.equal(w.truncated, false)
        assert.equal(w.items.length, 14)
    })

    it('top 10, tu zona (±2) y huecos', () => {
        const w = rankingWindow(list, 'u23')
        assert.equal(w.truncated, true)
        assert.equal(shape(w.items), '1 2 3 4 5 6 7 8 9 10 · 21 22 23 24 25 ·')
    })

    it('si tu zona toca el top, no hay hueco entre medias', () => {
        assert.equal(shape(rankingWindow(list, 'u12').items), '1 2 3 4 5 6 7 8 9 10 11 12 13 14 ·')
    })

    it('al final no deja hueco detrás', () => {
        assert.equal(shape(rankingWindow(list, 'u40').items), '1 2 3 4 5 6 7 8 9 10 · 38 39 40')
    })

    it('sin ti, solo el top; con all, entera', () => {
        assert.equal(shape(rankingWindow(list, null).items), '1 2 3 4 5 6 7 8 9 10 ·')
        assert.equal(rankingWindow(list, 'u23', { all: true }).items.length, 40)
    })
})
