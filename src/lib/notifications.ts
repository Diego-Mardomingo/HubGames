// Notificaciones push por dispositivo (#90). Cada navegador en el que se activan tiene su fila en
// hubgames_push_subscriptions (única por endpoint) con sus propias preferencias por tipo. «Este dispositivo» se
// reconoce por el endpoint de pushManager.getSubscription().
import { supabase, safeGetUser } from '@/lib/supabase/client'
import type { Json } from '@/lib/supabase/database.types'
import { deviceNameFromUA, wantsType, type NotificationPrefs, type NotificationType } from '@/lib/notification-prefs'

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

export type PushDevice = {
    id: string
    name: string
    enabled: boolean
    prefs: NotificationPrefs
    lastUsedAt: string
    current: boolean
}

/** ok: se puede activar · unsupported: el navegador no tiene push · denied: el permiso está bloqueado. */
export type NotificationSupport = 'ok' | 'unsupported' | 'denied'

export type NotificationState = {
    support: NotificationSupport
    current: PushDevice | null
    others: PushDevice[]
}

export function notificationSupport(): NotificationSupport {
    if (typeof window === 'undefined') return 'unsupported'
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return 'unsupported'
    return Notification.permission === 'denied' ? 'denied' : 'ok'
}

/** Endpoint de la suscripción push de este navegador, sin pedir permisos ni crear nada. */
async function currentEndpoint(): Promise<string | null> {
    if (notificationSupport() === 'unsupported') return null
    try {
        const registration = await navigator.serviceWorker.getRegistration()
        const subscription = await registration?.pushManager.getSubscription()
        return subscription?.endpoint ?? null
    } catch {
        return null
    }
}

function thisDeviceName(): string {
    const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches
    return deviceNameFromUA(navigator.userAgent, standalone)
}

/** Este dispositivo y los demás del usuario. Al consultarlo desde un dispositivo, se apunta que se ha usado. */
export async function getNotificationState(): Promise<NotificationState> {
    const support = notificationSupport()
    const userId = await getCurrentUserId()
    if (!userId) return { support, current: null, others: [] }

    const [endpoint, { data, error }] = await Promise.all([
        currentEndpoint(),
        supabase
            .from('hubgames_push_subscriptions')
            .select('id, endpoint, device_name, enabled, prefs, last_used_at')
            .eq('user_id', userId)
            .order('last_used_at', { ascending: false }),
    ])
    if (error) throw new Error(error.message)

    let current: PushDevice | null = null
    const others: PushDevice[] = []
    for (const row of data ?? []) {
        const device: PushDevice = {
            id: row.id,
            name: row.device_name || 'Dispositivo sin nombre',
            enabled: row.enabled,
            prefs: (row.prefs ?? {}) as NotificationPrefs,
            lastUsedAt: row.last_used_at,
            current: endpoint !== null && row.endpoint === endpoint,
        }
        if (device.current) current = device
        else others.push(device)
    }

    if (current) {
        current.lastUsedAt = new Date().toISOString()
        void supabase.from('hubgames_push_subscriptions').update({ last_used_at: current.lastUsedAt }).eq('id', current.id).then(() => {})
    }
    return { support, current, others }
}

/** ¿Llegan a este dispositivo los avisos de un tipo? null si no se sabe (sin sesión o error). */
export async function receivesOnThisDevice(type: NotificationType): Promise<boolean | null> {
    try {
        const { current } = await getNotificationState()
        return Boolean(current?.enabled && wantsType(current.prefs, type))
    } catch {
        return null
    }
}

/** Pide permiso, crea (o reutiliza) la suscripción push de este navegador y la activa sin tocar los demás dispositivos. */
export async function enableThisDevice(): Promise<{ success: boolean; error?: string; device?: PushDevice }> {
    try {
        const support = notificationSupport()
        if (support === 'unsupported') return { success: false, error: 'Este navegador no admite notificaciones push' }

        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
            return {
                success: false,
                error: permission === 'denied' ? 'El permiso de notificaciones está bloqueado en este navegador' : 'No se ha concedido el permiso de notificaciones',
            }
        }

        let registration: ServiceWorkerRegistration | null = (await navigator.serviceWorker.getRegistration()) || null

        // Si no hay registro, esperamos a que se registre (puede tardar unos segundos)
        if (!registration) {
            try {
                registration = (await Promise.race([
                    navigator.serviceWorker.ready,
                    new Promise<ServiceWorkerRegistration | null>((resolve) => {
                        navigator.serviceWorker
                            .register('/sw.js', { scope: '/' })
                            .then((reg) => setTimeout(() => resolve(reg), 1000))
                            .catch(() => resolve(null))
                        setTimeout(() => resolve(null), 10000)
                    }),
                ])) as ServiceWorkerRegistration | null
            } catch (swError) {
                console.error('[Notifications] Error obteniendo Service Worker:', swError)
            }
        } else {
            try {
                await registration.update()
            } catch (e) {
                console.warn('[Notifications] No se pudo actualizar el Service Worker:', e)
            }
        }

        if (!registration) {
            return { success: false, error: 'No se ha encontrado ningún Service Worker registrado. Verifica que la PWA esté instalada correctamente.' }
        }

        let subscription = await registration.pushManager.getSubscription()
        if (!subscription) {
            const vapidPublicKey = getVapidPublicKey()
            if (!vapidPublicKey) return { success: false, error: 'Error de configuración: falta la clave VAPID pública en el servidor.' }
            try {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
                })
            } catch (subError: any) {
                const errorMsg = subError?.message || 'Error desconocido al suscribirse'
                console.error('[Notifications] Error suscribiéndose a Push:', subError)
                return {
                    success: false,
                    error: `Error al suscribirse al servicio push: ${errorMsg}. ${subError?.name === 'AbortError' ? 'En iOS, asegúrate de usar la PWA instalada (no Safari normal).' : ''}`,
                }
            }
        }

        const name = thisDeviceName()
        const { data, error } = await supabase
            .rpc('hubgames_push_register', { p_subscription: subscription.toJSON() as unknown as Json, p_device_name: name })
            .single()
        if (error || !data) {
            console.error('[Notifications] Error guardando la suscripción', error)
            return { success: false, error: `Error guardando en la base de datos: ${error?.message || 'Error desconocido'}` }
        }

        return {
            success: true,
            device: { id: data.id, name, enabled: true, prefs: (data.prefs ?? {}) as NotificationPrefs, lastUsedAt: new Date().toISOString(), current: true },
        }
    } catch (err: any) {
        console.error('[Notifications] Error inesperado', err)
        return { success: false, error: `Error inesperado: ${err?.message || 'Error desconocido'}` }
    }
}

/**
 * Desactiva un dispositivo (el actual u otro). No se cancela la suscripción del navegador: así, al reactivarlo, se
 * reconoce el mismo endpoint y se recuperan sus preferencias por tipo.
 */
export async function setDeviceEnabled(id: string, enabled: boolean): Promise<boolean> {
    const { error } = await supabase.from('hubgames_push_subscriptions').update({ enabled, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) console.error('[Notifications] Error cambiando el dispositivo', error)
    return !error
}

export async function setDevicePref(device: PushDevice, type: NotificationType, value: boolean): Promise<NotificationPrefs | null> {
    const prefs: NotificationPrefs = { ...device.prefs, [type]: value }
    const { error } = await supabase
        .from('hubgames_push_subscriptions')
        .update({ prefs: prefs as unknown as Json, updated_at: new Date().toISOString() })
        .eq('id', device.id)
    if (error) {
        console.error('[Notifications] Error guardando la preferencia', error)
        return null
    }
    return prefs
}

/** Quita un dispositivo: deja de recibir avisos. Si es el actual, también se cancela la suscripción del navegador. */
export async function removeDevice(device: PushDevice): Promise<boolean> {
    const { error } = await supabase.from('hubgames_push_subscriptions').delete().eq('id', device.id)
    if (error) {
        console.error('[Notifications] Error quitando el dispositivo', error)
        return false
    }
    if (device.current) {
        try {
            const registration = await navigator.serviceWorker.getRegistration()
            await (await registration?.pushManager.getSubscription())?.unsubscribe()
        } catch (err) {
            console.error('[Notifications] Error cancelando la suscripción del navegador', err)
        }
    }
    return true
}
