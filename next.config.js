const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
    runtimeCaching: [],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        domains: ['media.rawg.io'], // RAWG API images
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'media.rawg.io',
            },
        ],
    },
}

module.exports = withPWA(nextConfig)
