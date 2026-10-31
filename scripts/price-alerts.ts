// Avisos push de precio de la wishlist (#37). Se ejecuta a diario justo después de la sincronización (steam-sync.yml),
// cuando los precios y los mínimos ya están al día.
// - Por defecto avisa cuando un juego llega a su mínimo histórico en Steam; cada juego puede tener su propio criterio
//   (precio objetivo, descuento mínimo o sin avisos) en hubgames_price_alerts.
// - No repite: guarda el precio avisado y solo vuelve a avisar si baja más o en la siguiente oferta (decideAlert).
// - Se envía a todos los dispositivos del usuario con las notificaciones y «Bajadas de precio» activadas (#90). Las
//   suscripciones caducadas (404/410) se desactivan una a una.
// Uso: npx tsx scripts/price-alerts.ts [--dry-run] [--user <uuid>]
//   --dry-run: imprime qué avisaría (también a usuarios sin notificaciones) y no envía ni escribe nada.
import { createClient } from '@supabase/supabase-js'
import webpush, { type PushSubscription } from 'web-push'
import type { Database } from '../src/lib/supabase/database.types'
import {
    MAX_ALERTS_PER_DAY,
    alertPayload,
    decideAlert,
    summaryPayload,
    type AlertGame,
    type AlertMode,
    type PriceAlert,
    type PushPayload,
} from '../src/lib/price-alerts'
import { wantsType } from '../src/lib/notification-prefs'

type Client = ReturnType<typeof createClient<Database>>
type Device = { id: string; subscription: PushSubscription }

function arg(name: string): string | null {
    const i = process.argv.indexOf(name)
    return i > -1 ? (process.argv[i + 1] ?? null) : null
}

async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
    const out: T[] = []
    for (let from = 0; ; from += 1000) {
        const { data, error } = await page(from, from + 999)
        if (error) throw new Error(error.message)
        out.push(...(data ?? []))
        if (!data || data.length < 1000) return out
    }
}

/** Envía y devuelve false si la suscripción ya no existe (hay que desactivarla). */
async function send(subscription: PushSubscription, payload: PushPayload): Promise<boolean> {
    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload))
        return true
    } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) return false
        throw e
    }
}

async function processUser(supabase: Client, userId: string, devices: Device[], dryRun: boolean) {
    const [games, alerts] = await Promise.all([
        all((from, to) =>
            supabase
                .from('hubgames_wishlist')
                .select('appid, name, price_initial, price_final, discount_percent, steam_low')
                .eq('user_id', userId)
                .order('appid')
                .range(from, to),
        ),
        all((from, to) => supabase.from('hubgames_price_alerts').select('*').eq('user_id', userId).order('appid').range(from, to)),
    ])
    const byAppid = new Map(alerts.map((a) => [a.appid, { ...a, mode: a.mode as AlertMode } satisfies PriceAlert]))

    const toNotify: { game: AlertGame; alert: PriceAlert | null; price: number }[] = []
    const toReset: number[] = []
    for (const row of games) {
        if (row.appid === null) continue
        const game = row as AlertGame
        const alert = byAppid.get(game.appid) ?? null
        const decision = decideAlert(game, alert)
        if (decision.action === 'notify') toNotify.push({ game, alert, price: decision.price })
        else if (decision.action === 'reset') toReset.push(game.appid)
    }

    console.log(`${games.length} juegos en la wishlist, ${alerts.length} con criterio propio. Avisos: ${toNotify.length}, ofertas terminadas: ${toReset.length}`)
    const payloads =
        toNotify.length > MAX_ALERTS_PER_DAY ? [summaryPayload(toNotify.length)] : toNotify.map(({ game, alert }) => alertPayload(game, alert))
    for (const { game, alert } of toNotify) console.log(`  - ${alertPayload(game, alert).title}`)
    for (const p of payloads) console.log(`  ${dryRun ? '[seco] ' : ''}Notificación: ${p.title} · ${p.body} → ${p.url}`)
    if (dryRun) return

    if (!devices.length) return
    // Basta con que llegue a un dispositivo para darlo por avisado; si no llega a ninguno, se reintenta mañana.
    if (payloads.length) {
        let delivered = 0
        let lastError: unknown = null
        for (const device of devices) {
            try {
                let alive = true
                for (const p of payloads) {
                    if (!(await send(device.subscription, p))) {
                        alive = false
                        break
                    }
                }
                if (alive) delivered++
                else {
                    console.log(`La suscripción ${device.id} ya no existe: se desactiva.`)
                    await supabase.from('hubgames_push_subscriptions').update({ enabled: false }).eq('id', device.id)
                }
            } catch (e) {
                lastError = e
                console.error(`  Error enviando a ${device.id}: ${e instanceof Error ? e.message : e}`)
            }
        }
        console.log(`  Enviado a ${delivered} de ${devices.length} dispositivos.`)
        if (!delivered) {
            if (lastError) throw lastError
            return
        }
    }

    // Se apunta lo avisado solo después de enviar, para que un fallo de envío se reintente mañana.
    const now = new Date().toISOString()
    if (toNotify.length) {
        const { error } = await supabase.from('hubgames_price_alerts').upsert(
            toNotify.map(({ game, alert, price }) => ({
                user_id: userId,
                appid: game.appid,
                mode: alert?.mode ?? 'minimo',
                target_price: alert?.target_price ?? null,
                target_discount: alert?.target_discount ?? null,
                last_notified_price: price,
                last_notified_at: now,
            })),
            { onConflict: 'user_id,appid' },
        )
        if (error) throw new Error(`No se pudo guardar lo avisado: ${error.message}`)
    }
    if (toReset.length) {
        const { error } = await supabase
            .from('hubgames_price_alerts')
            .update({ last_notified_price: null, last_notified_at: null })
            .eq('user_id', userId)
            .in('appid', toReset)
        if (error) throw new Error(`No se pudieron reiniciar los avisos: ${error.message}`)
    }
}

async function main() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient<Database>(url, key, { auth: { persistSession: false } })
    const dryRun = process.argv.includes('--dry-run')
    const onlyUser = arg('--user')

    if (!dryRun) {
        const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY
        const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY
        if (!publicKey || !privateKey) throw new Error('Faltan WEB_PUSH_VAPID_PUBLIC_KEY o WEB_PUSH_VAPID_PRIVATE_KEY')
        webpush.setVapidDetails(process.env.WEB_PUSH_VAPID_SUBJECT || 'mailto:support@hubgames.app', publicKey, privateKey)
    }

    const { data: subs, error } = await supabase.from('hubgames_push_subscriptions').select('id, user_id, subscription, prefs').eq('enabled', true)
    if (error) throw new Error(`No se pudieron leer las suscripciones: ${error.message}`)
    const subByUser = new Map<string, Device[]>()
    for (const s of subs) {
        if (!wantsType(s.prefs, 'price')) continue
        const list = subByUser.get(s.user_id) ?? []
        list.push({ id: s.id, subscription: s.subscription as unknown as PushSubscription })
        subByUser.set(s.user_id, list)
    }

    // En seco se revisan todos los que tienen wishlist, para ver qué se avisaría aunque no haya notificaciones activas.
    let users: string[]
    if (dryRun) {
        const rows = await all((from, to) => supabase.from('hubgames_user_wishlist').select('user_id').order('user_id').range(from, to))
        users = [...new Set(rows.map((r) => r.user_id))]
    } else {
        users = [...subByUser.keys()]
    }
    if (onlyUser) users = users.filter((u) => u === onlyUser)
    const deviceCount = [...subByUser.values()].reduce((n, l) => n + l.length, 0)
    console.log(`${dryRun ? 'Modo seco. ' : ''}${deviceCount} dispositivos con avisos de precio (${subByUser.size} usuarios); ${users.length} usuarios a revisar.`)

    let failed = 0
    for (const userId of users) {
        console.log(`::group::Usuario ${userId}${subByUser.has(userId) ? '' : ' (sin notificaciones activas)'}`)
        try {
            await processUser(supabase, userId, subByUser.get(userId) ?? [], dryRun)
        } catch (e) {
            failed++
            console.error(`::error::Usuario ${userId}: ${e instanceof Error ? e.message : e}`)
        }
        console.log('::endgroup::')
    }
    if (failed) process.exit(1)
}

main().catch((e) => {
    console.error(`::error::${e instanceof Error ? e.message : e}`)
    process.exit(1)
})
