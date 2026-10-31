import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

/** robots.txt (#107): todo rastreable menos la administración, la API y el callback de login. */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/auth/'] },
        sitemap: `${SITE_URL}/sitemap.xml`,
    }
}
