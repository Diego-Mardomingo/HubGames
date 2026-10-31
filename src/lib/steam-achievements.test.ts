import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergeSteamAchievements, rarestPercent } from './steam-achievements'

describe('mergeSteamAchievements', () => {
    const schema = {
        game: {
            availableGameStats: {
                achievements: [
                    {
                        name: 'WIN',
                        displayName: 'Victoria',
                        description: 'Gana una partida',
                        icon: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/10/a.jpg',
                        icongray: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/10/b.jpg',
                        hidden: 0,
                    },
                    { name: 'SECRET', hidden: 1 },
                ],
            },
        },
    }

    it('cruza el esquema con el % global y lo deja todo bloqueado', () => {
        const list = mergeSteamAchievements(10, schema, {
            achievementpercentages: {
                achievements: [{ name: 'WIN', percent: '42.5' }],
            },
        })
        assert.equal(list.length, 2)
        assert.deepEqual(list[0], {
            appid: 10,
            apiname: 'WIN',
            achieved: false,
            unlocktime: null,
            display_name: 'Victoria',
            description: 'Gana una partida',
            icon: 'https://shared.akamai.steamstatic.com/community_assets/images/apps/10/a.jpg',
            icongray: 'https://shared.akamai.steamstatic.com/community_assets/images/apps/10/b.jpg',
            hidden: false,
            global_percent: 42.5,
        })
        assert.equal(list[1].hidden, true)
        assert.equal(list[1].display_name, null)
        assert.equal(list[1].global_percent, null)
    })

    it('sin esquema (juego sin logros o con estadísticas privadas), lista vacía', () => {
        assert.deepEqual(mergeSteamAchievements(10, null, null), [])
        assert.deepEqual(mergeSteamAchievements(10, { game: {} }, null), [])
    })

    it('ignora porcentajes que no son números', () => {
        const list = mergeSteamAchievements(10, schema, {
            achievementpercentages: { achievements: [{ name: 'WIN', percent: 'x' }] },
        })
        assert.equal(list[0].global_percent, null)
    })
})

describe('rarestPercent', () => {
    it('el mínimo de los que tienen dato', () => {
        assert.equal(rarestPercent([{ global_percent: 30 }, { global_percent: null }, { global_percent: 0.4 }]), 0.4)
    })
    it('null si no hay datos', () => {
        assert.equal(rarestPercent([{ global_percent: null }]), null)
        assert.equal(rarestPercent([]), null)
    })
})
