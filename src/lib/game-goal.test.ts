import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { goalMinutes, goalProgress, goalRemainingMinutes, isReplayable, parseGoal } from './game-goal'
import { libraryGame as game } from './test-utils'

const hltb = { hltb_main: 600, hltb_main_extra: 900, hltb_completionist: 1800 }

describe('objetivo por juego (#24)', () => {
    it('por defecto, historia', () => {
        assert.equal(parseGoal(null), 'historia')
        assert.equal(parseGoal('raro'), 'historia')
        assert.equal(goalMinutes(game({ ...hltb, goal: 'historia' })), 600)
        assert.equal(goalMinutes(game({ ...hltb, goal: 'extras' })), 900)
        assert.equal(goalMinutes(game({ ...hltb, goal: 'completo' })), 1800)
    })

    it('historia y extras: horas frente a HowLongToBeat', () => {
        const p = goalProgress(game({ ...hltb, goal: 'extras', playtime_forever: 450 }))
        assert.deepEqual(p, { goal: 'extras', basis: 'horas', percent: 50, targetMinutes: 900, done: false })
        assert.equal(goalProgress(game({ ...hltb, playtime_forever: 700 })).done, true)
        assert.equal(goalProgress(game({ ...hltb, playtime_forever: 700 })).percent, 100)
        assert.equal(goalRemainingMinutes(game({ ...hltb, goal: 'extras', playtime_forever: 450 })), 450)
    })

    it('100 %: % de logros; sin logros, horas frente a la duración completista', () => {
        const p = goalProgress(game({ ...hltb, goal: 'completo', achievements_total: 40, achievements_unlocked: 40 }))
        assert.equal(p.basis, 'logros')
        assert.equal(p.done, true)
        assert.equal(goalRemainingMinutes(game({ ...hltb, goal: 'completo', achievements_total: 40, achievements_unlocked: 10 })), null)
        const sinLogros = goalProgress(game({ ...hltb, goal: 'completo', playtime_forever: 900 }))
        assert.deepEqual([sinLogros.basis, sinLogros.percent], ['horas', 50])
    })

    it('rejugable: sin meta ni progreso aunque haya duración', () => {
        const g = game({ ...hltb, goal: 'rejugable', playtime_forever: 3000 })
        assert.equal(isReplayable(g), true)
        assert.equal(goalMinutes(g), null)
        assert.equal(goalProgress(g).percent, null)
        assert.equal(goalProgress(g).done, false)
        assert.equal(goalRemainingMinutes(g), null)
    })

    it('sin duración no hay progreso por horas', () => {
        assert.equal(goalProgress(game({ goal: 'extras', playtime_forever: 100 })).percent, null)
    })
})
