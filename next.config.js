const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
    runtimeCaching: [],
    // Directorio donde next-pwa buscará código extra para el Service Worker
    customWorkerDir: 'worker',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    turbopack: {},
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

module.exports = withPWA(nextConfig)
