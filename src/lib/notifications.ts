import { supabase, safeGetUser } from '@/lib/supabase/client'

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
    const { data: { user } } = await safeGetUser()
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

export async function subscribeToDailyNotifications(): Promise<{ success: boolean; error?: string }> {
    try {
        if (typeof window === 'undefined') {
            const error = 'Window no disponible'
            console.error('[Notifications]', error)
            return { success: false, error }
        }
        
        if (!('serviceWorker' in navigator)) {
            const error = 'Tu navegador no soporta Service Workers'
            console.warn('[Notifications]', error)
            return { success: false, error }
        }

        if (!('PushManager' in window)) {
            const error = 'Tu navegador no soporta Push Notifications'
            console.warn('[Notifications]', error)
            return { success: false, error }
        }

        if (typeof Notification === 'undefined') {
            const error = 'Tu navegador no soporta la API de Notificaciones'
            console.warn('[Notifications]', error)
            return { success: false, error }
        }

        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
            const error = `Permiso de notificaciones ${permission === 'denied' ? 'denegado' : 'no concedido'}`
            console.warn('[Notifications]', error, ':', permission)
            return { success: false, error }
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
            const error = 'No se ha encontrado ningún Service Worker registrado. Verifica que la PWA esté instalada correctamente.'
            console.error('[Notifications]', error)
            return { success: false, error }
        }

        let subscription = await registration.pushManager.getSubscription()

        if (!subscription) {
            const vapidPublicKey = getVapidPublicKey()
            if (!vapidPublicKey) {
                const error = 'Error de configuración: falta la clave VAPID pública en el servidor.'
                console.error('[Notifications]', error)
                return { success: false, error }
            }

            try {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
                })
                console.log('[Notifications] Suscripción Push creada correctamente')
            } catch (subError: any) {
                const errorMsg = subError?.message || 'Error desconocido al suscribirse'
                const error = `Error al suscribirse al servicio push: ${errorMsg}. ${subError?.name === 'AbortError' ? 'En iOS, asegúrate de usar la PWA instalada (no Safari normal).' : ''}`
                console.error('[Notifications] Error suscribiéndose a Push:', subError)
                return { success: false, error }
            }
        } else {
            console.log('[Notifications] Ya existía una suscripción Push, reutilizándola')
        }

        const userId = await getCurrentUserId()
        if (!userId) {
            const error = 'No se pudo obtener el usuario actual. Por favor, inicia sesión de nuevo.'
            console.error('[Notifications]', error)
            return { success: false, error }
        }

        console.log('[Notifications] Guardando suscripción en Supabase para usuario:', userId)
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
            const errorMsg = `Error guardando en la base de datos: ${error.message || 'Error desconocido'}`
            console.error('[Notifications]', errorMsg, error)
            return { success: false, error: errorMsg }
        }

        console.log('[Notifications] ✅ Suscripción guardada correctamente en Supabase:', data)
        return { success: true }
    } catch (err: any) {
        const error = `Error inesperado: ${err?.message || 'Error desconocido'}`
        console.error('[Notifications]', error, err)
        return { success: false, error }
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

