import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RARITY_TIER_LABELS, rarityColor, rarityTier } from './rarity'

describe('rareza (niveles del rediseño)', () => {
    it('umbrales: <1 legendaria, <5 épica, <15 rara, <40 poco común, resto común', () => {
        assert.equal(rarityTier(0.4), 'leg')
        assert.equal(rarityTier(1), 'epica')
        assert.equal(rarityTier(4.99), 'epica')
        assert.equal(rarityTier(5), 'rara')
        assert.equal(rarityTier(14.9), 'rara')
        assert.equal(rarityTier(15), 'poco')
        assert.equal(rarityTier(39.9), 'poco')
        assert.equal(rarityTier(40), 'comun')
        assert.equal(rarityTier(100), 'comun')
    })

    it('sin dato, sin rareza', () => {
        assert.equal(rarityTier(null), null)
        assert.equal(rarityTier(undefined), null)
        assert.equal(rarityTier(Number.NaN), null)
    })

    it('nombre y color', () => {
        assert.equal(RARITY_TIER_LABELS.leg, 'Legendaria')
        assert.equal(rarityColor('epica'), 'var(--rar-epica)')
    })
})
