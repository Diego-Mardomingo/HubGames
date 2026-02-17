'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
    useEffect(() => {
        if (typeof window === 'undefined') return
        if (process.env.NODE_ENV === 'development') return // En dev está desactivado

        if ('serviceWorker' in navigator) {
            // Intentar registrar el service worker si no está ya registrado
            navigator.serviceWorker.getRegistration().then((registration) => {
                if (!registration) {
                    // Si no hay registro, intentar registrar el SW generado por next-pwa
                    navigator.serviceWorker
                        .register('/sw.js', { scope: '/' })
                        .then((reg) => {
                            console.log('[SW] Service Worker registrado correctamente:', reg.scope)
                        })
                        .catch((err) => {
                            console.error('[SW] Error registrando Service Worker:', err)
                        })
                } else {
                    console.log('[SW] Service Worker ya estaba registrado:', registration.scope)
                }
            })
        }
    }, [])

    return null
}
