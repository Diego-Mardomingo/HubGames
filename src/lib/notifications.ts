import { supabase } from '@/lib/supabase/client'

const VAPID_PUBLIC_KEY_RAW = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY

function getVapidPublicKey(): string | null {
    const raw = (VAPID_PUBLIC_KEY_RAW || '').trim()
    if (!raw) return null
    // Por si se ha pegado con comillas en Vercel: "xxxxx"
    return raw.replace(/^"+|"+$/g, '')
}

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

    const rawData = atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

export async function getCurrentUserId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
}

export async function getNotificationPreference(): Promise<boolean> {
    const userId = await getCurrentUserId()
    if (!userId) return false

    const { data, error } = await supabase
        .from('hubgames_push_subscriptions')
        .select('enabled')
        .eq('user_id', userId)
        .maybeSingle()

    if (error) {
        console.error('Error obteniendo preferencia de notificaciones', error)
        return false
    }

    // Si no hay registro todavía, asumimos que aún NO lo ha activado
    if (!data) return false

    return data.enabled
}

export async function subscribeToDailyNotifications(): Promise<boolean> {
    try {
        if (typeof window === 'undefined') {
            console.error('[Notifications] Window no disponible')
            return false
        }
        
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
            console.warn('[Notifications] Push notifications no soportadas en este navegador.')
            return false
        }

        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
            console.warn('[Notifications] Permiso de notificaciones no concedido:', permission)
            return false
        }

        // Intentamos obtener el service worker con múltiples intentos
        let registration: ServiceWorkerRegistration | null = null
        
        // Primero intentamos obtener el registro existente
        registration = await navigator.serviceWorker.getRegistration() || null
        
        // Si no hay registro, intentamos esperar a que se registre (puede tardar unos segundos)
        if (!registration) {
            console.log('[Notifications] Service Worker no encontrado, esperando a que se registre...')
            try {
                // Esperamos hasta 10 segundos a que el SW se registre
                registration = await Promise.race([
                    navigator.serviceWorker.ready,
                    new Promise<ServiceWorkerRegistration | null>((resolve) => {
                        // Intentar registrar manualmente si no está registrado
                        navigator.serviceWorker
                            .register('/sw.js', { scope: '/' })
                            .then((reg) => {
                                console.log('[Notifications] Service Worker registrado manualmente')
                                // Esperar a que esté activo
                                setTimeout(() => resolve(reg), 1000)
                            })
                            .catch(() => resolve(null))
                        
                        // Timeout después de 10 segundos
                        setTimeout(() => resolve(null), 10000)
                    })
                ]) as ServiceWorkerRegistration | null
            } catch (swError) {
                console.error('[Notifications] Error obteniendo Service Worker:', swError)
            }
        } else {
            // Si ya hay registro, esperamos a que esté listo
            try {
                await registration.update()
                console.log('[Notifications] Service Worker encontrado y actualizado')
            } catch (e) {
                console.warn('[Notifications] No se pudo actualizar el Service Worker:', e)
            }
        }

        if (!registration) {
            console.error('[Notifications] No se ha encontrado ningún Service Worker registrado para HubGames después de múltiples intentos.')
            console.error('[Notifications] Verifica que el archivo /sw.js existe y está accesible.')
            return false
        }

        let subscription = await registration.pushManager.getSubscription()

        if (!subscription) {
            const vapidPublicKey = getVapidPublicKey()
            if (!vapidPublicKey) {
                console.error('[Notifications] Falta NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY en el entorno')
                return false
            }

            try {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
                })
            } catch (subError: any) {
                console.error('[Notifications] Error suscribiéndose a Push:', subError)
                return false
            }
        }

        const userId = await getCurrentUserId()
        if (!userId) {
            console.error('[Notifications] No se pudo obtener el usuario actual para guardar la suscripción')
            return false
        }

        const { error, data } = await supabase
            .from('hubgames_push_subscriptions')
            .upsert(
                {
                    user_id: userId,
                    subscription: subscription.toJSON(),
                    enabled: true,
                },
                {
                    onConflict: 'user_id',
                },
            )
            .select()

        if (error) {
            console.error('[Notifications] Error guardando suscripción push en Supabase:', error)
            return false
        }

        console.log('[Notifications] Suscripción guardada correctamente:', data)
        return true
    } catch (err: any) {
        console.error('[Notifications] Error inesperado en subscribeToDailyNotifications:', err)
        return false
    }
}

export async function disableDailyNotifications(): Promise<boolean> {
    if (typeof window === 'undefined') return false

    const userId = await getCurrentUserId()
    if (!userId) return false

    // Marcamos como desactivado en la BBDD
    const { error } = await supabase
        .from('hubgames_push_subscriptions')
        .update({ enabled: false })
        .eq('user_id', userId)

    if (error) {
        console.error('Error desactivando notificaciones diarias', error)
        return false
    }

    // Opcionalmente podemos cancelar la suscripción en el navegador
    try {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.getRegistration()
            if (registration) {
                const subscription = await registration.pushManager.getSubscription()
                if (subscription) {
                    await subscription.unsubscribe()
                }
            }
        }
    } catch (err) {
        console.error('Error cancelando suscripción push en el navegador', err)
    }

    return true
}

