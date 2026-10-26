import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { achievementIconUrl } from './steam-icon'

describe('achievementIconUrl', () => {
    it('pasa las URLs del CDN antiguo a community_assets', () => {
        assert.equal(
            achievementIconUrl('https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/3934270/0d1c.jpg'),
            'https://shared.akamai.steamstatic.com/community_assets/images/apps/3934270/0d1c.jpg',
        )
        assert.equal(
            achievementIconUrl('https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/1/a.jpg'),
            'https://shared.akamai.steamstatic.com/community_assets/images/apps/1/a.jpg',
        )
    })

    it('deja igual las URLs que ya son buenas y devuelve null si no hay icono', () => {
        const ok = 'https://shared.akamai.steamstatic.com/community_assets/images/apps/1/a.jpg'
        assert.equal(achievementIconUrl(ok), ok)
        assert.equal(achievementIconUrl(null), null)
        assert.equal(achievementIconUrl(''), null)
    })
})
