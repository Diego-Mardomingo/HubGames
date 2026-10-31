/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Service Worker escrito a mano en public/sw.js (#97): solo notificaciones push. Sin caché para que los
    // navegadores recojan siempre la última versión.
    async headers() {
        return [
            {
                source: '/sw.js',
                headers: [
                    { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
                    { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
                    { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
                ],
            },
        ]
    },
    // Onest para la imagen del resumen anual (ImageResponse la lee del disco con readFile)
    outputFileTracingIncludes: {
        '/api/estadisticas/resumen/imagen': ['./src/assets/fonts/onest/*.ttf'],
    },
    images: {
        // Portadas del CDN de Steam (#21). Pocos anchos y caché larga: Vercel Hobby cuenta cada transformación.
        remotePatterns: [
            { protocol: 'https', hostname: 'shared.akamai.steamstatic.com', pathname: '/store_item_assets/**' },
            { protocol: 'https', hostname: 'cdn.akamai.steamstatic.com', pathname: '/steam/apps/**' },
            { protocol: 'https', hostname: 'shared.fastly.steamstatic.com', pathname: '/store_item_assets/**' },
            { protocol: 'https', hostname: 'shared.cloudflare.steamstatic.com', pathname: '/store_item_assets/**' },
            { protocol: 'https', hostname: 'cdn.cloudflare.steamstatic.com', pathname: '/steam/apps/**' },
        ],
        deviceSizes: [640, 1080, 1920],
        imageSizes: [96, 192, 384],
        minimumCacheTTL: 60 * 60 * 24 * 30,
    },
}

module.exports = nextConfig
