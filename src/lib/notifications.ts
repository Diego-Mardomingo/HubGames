import { supabase } from '@/lib/supabase/client'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY

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

    // Por defecto, consideramos activado si no hay registro todavía
    if (!data) return true

    return data.enabled
}

export async function subscribeToDailyNotifications(): Promise<boolean> {
    if (typeof window === 'undefined') return false
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
        console.warn('Push notifications no soportadas en este navegador.')
        return false
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
        console.warn('Permiso de notificaciones no concedido')
        return false
    }

    // En desarrollo, next-pwa suele estar desactivado, así que ready puede no resolverse nunca.
    // Usamos getRegistration() y, si no hay SW, devolvemos false limpiamente.
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
        console.warn('No se ha encontrado ningún Service Worker registrado para HubGames.')
        return false
    }

    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
        if (!VAPID_PUBLIC_KEY) {
            console.error('Falta NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY en el entorno')
            return false
        }

        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
    }

    const userId = await getCurrentUserId()
    if (!userId) {
        console.error('No se pudo obtener el usuario actual para guardar la suscripción')
        return false
    }

    const { error } = await supabase
        .from('hubgames_push_subscriptions')
        .upsert(
            {
                user_id: userId,
                subscription,
                enabled: true,
            },
            {
                onConflict: 'user_id',
            },
        )

    if (error) {
        console.error('Error guardando suscripción push', error)
        return false
    }

    return true
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

