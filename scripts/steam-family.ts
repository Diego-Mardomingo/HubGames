// Grupo familiar de Steam (#86) desde tu PC: QR en la terminal → aprobar en la app de Steam → lista de prestados a Supabase.
// Va aquí y no en Vercel porque Steam rechaza por sospechoso un QR pedido desde una IP distinta de la del móvil.
// Lo abre el botón de /perfil (enlace hubgames-familia://, ver scripts/steam-family-install.ts) o `npm run steam:familia`.
// La cuenta de HubGames sale de la cuenta de Steam que aprueba. Ningún permiso de Steam se guarda ni se muestra.
import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import type { Database } from '../src/lib/supabase/database.types'
import {
    beginQrSession,
    borrowedApps,
    fetchFamilyLibrary,
    personaNames,
    pollQrSession,
    revokeRefreshToken,
    SteamFamilyError,
    tokenSteamId,
} from '../src/lib/steam-family'
import { syncFamilyLibrary } from '../src/lib/steam-sync'
import { sleep } from './steam-utils'

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`
const green = (s: string) => `\x1b[32m${s}\x1b[0m`

async function showQr(url: string) {
    // Borra la pantalla: si Steam renueva el código, el viejo no debe quedar a la vista.
    process.stdout.write('\x1b[2J\x1b[H')
    console.log(bold('HubGames · Grupo familiar de Steam\n'))
    console.log(await QRCode.toString(url, { type: 'terminal', small: true, errorCorrectionLevel: 'M' }))
    console.log('1. Abre la app de Steam en el móvil → Steam Guard → escáner de QR.')
    console.log('2. Escanea el código y pulsa «Aprobar». Verás «HubGames» como dispositivo.')
    console.log(dim('\nHubGames trae la lista de tu grupo y cierra la sesión en Steam enseguida. Ctrl+C para cancelar.'))
}

async function main() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
    const supabase = createClient<Database>(url, key, { auth: { persistSession: false } })

    let { session, challengeUrl, interval } = await beginQrSession()
    await showQr(challengeUrl)

    let scanned = false
    let poll
    for (;;) {
        await sleep(Math.min(Math.max(interval, 2), 10) * 1000)
        poll = await pollQrSession(session)
        if (poll.state === 'approved') break
        session = poll.session
        if (poll.challengeUrl && poll.challengeUrl !== challengeUrl) {
            challengeUrl = poll.challengeUrl
            await showQr(challengeUrl)
        }
        if (poll.state === 'scanned' && !scanned) {
            scanned = true
            interval = 2
            console.log(green('\nEscaneado: confírmalo en el móvil.'))
        }
    }

    let accessToken: string | null = poll.accessToken
    let refreshToken: string | null = poll.refreshToken
    try {
        console.log('\nAprobado. Trayendo los juegos de tu grupo…')
        const steamid = tokenSteamId(accessToken)
        const { data: link, error } = steamid
            ? await supabase.from('hubgames_user_steam').select('user_id').eq('steamid', steamid).maybeSingle()
            : { data: null, error: null }
        if (error) throw new Error(`No se pudo leer la vinculación: ${error.message}`)
        if (!link) throw new SteamFamilyError('Esa cuenta de Steam no está vinculada a HubGames', 'wrong_account')

        const family = await fetchFamilyLibrary(accessToken, steamid!)
        // Lo antes posible: la sesión se cierra en Steam en cuanto tenemos la lista.
        const closed = await revokeRefreshToken(refreshToken, accessToken).catch(() => false)
        accessToken = refreshToken = null

        const borrowed = borrowedApps(family.apps, steamid!)
        const owners = [...new Set([...family.memberSteamIds, ...borrowed.flatMap((a) => a.owner_steamids ?? [])])].filter((id) => id !== steamid)
        const result = await syncFamilyLibrary(
            supabase,
            link.user_id,
            borrowed.map((a) => ({ appid: a.appid, owners: a.owner_steamids ?? [], playtimeMinutes: a.rt_playtime ?? 0, lastPlayed: a.rt_last_played ?? null })),
            await personaNames(owners),
            { log: (m) => console.log(dim(m)) },
        )

        console.log(green(bold(`\n✔ Grupo familiar actualizado: ${result.total} ${result.total === 1 ? 'juego prestado' : 'juegos prestados'}.`)))
        const changes = [
            result.added + result.back && `${result.added + result.back} nuevos`,
            result.gone && `${result.gone} ya no están`,
            result.newToTray && `${result.newToTray} a la Bandeja`,
        ].filter(Boolean)
        if (changes.length) console.log(changes.join(' · '))
        if (closed) console.log(dim('Sesión de Steam cerrada.'))
        else console.log('⚠ No se pudo cerrar la sesión en Steam: quita «HubGames» en la app de Steam → Dispositivos autorizados.')
    } finally {
        if (refreshToken) await revokeRefreshToken(refreshToken, accessToken ?? undefined).catch(() => false)
    }
}

const MESSAGES: Record<SteamFamilyError['code'], string> = {
    denied: 'Rechazado en el móvil, o Steam lo ha bloqueado. No se ha cambiado nada.',
    expired: 'El código ha caducado. Vuelve a pulsar el botón en HubGames.',
    no_family: 'No estás en ningún grupo familiar de Steam.',
    wrong_account: 'Has aprobado con una cuenta de Steam que no está vinculada a HubGames. No se ha cambiado nada.',
    steam: 'Steam no ha respondido. No se ha cambiado nada.',
}

main().catch((e) => {
    // Solo el mensaje: nunca el objeto entero, por si algún día llevara un permiso dentro.
    console.error(`\n✖ ${e instanceof SteamFamilyError ? MESSAGES[e.code] : e instanceof Error ? e.message : 'Error desconocido'}`)
    process.exit(1)
})
