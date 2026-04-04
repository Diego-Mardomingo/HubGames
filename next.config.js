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
}

module.exports = withPWA(nextConfig)
