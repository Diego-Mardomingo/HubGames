// Grupo familiar de Steam (#86): login por QR a demanda, lista de juegos compartidos y anulación del permiso.
// Valve no ofrece otra vía: IFamilyGroupsService pide el permiso de la sesión del usuario (la clave de la Web API da 401).
// Reglas: el permiso no sale de la función del servidor, no se guarda ni se escribe en logs, y se anula en Steam al
// terminar. Se pide con la plataforma «navegador web», la de menos alcance (solo la web, no se puede renovar).
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

const STEAM_API = 'https://api.steampowered.com'
const PLATFORM_WEB_BROWSER = 2
const REVOKE_PERMANENT = 1
const DEVICE_NAME = 'HubGames'
/** Steam caduca el QR a los ~2-3 min; cortamos antes para no dejar sesiones a medias. */
export const QR_TTL_MS = 150_000

export class SteamFamilyError extends Error {
    constructor(
        message: string,
        readonly code: 'steam' | 'denied' | 'expired' | 'no_family' | 'wrong_account',
    ) {
        super(message)
    }
}

// ─── Protobuf mínimo (solo los campos que usamos) ────────────────────────────

// Sin literales 0n: el tsconfig apunta a ES2017.
const B0 = BigInt(0)
const B7 = BigInt(7)
const B7F = BigInt(0x7f)

function varint(value: number | bigint): number[] {
    let n = BigInt(value)
    const out: number[] = []
    do {
        let b = Number(n & B7F)
        n >>= B7
        if (n) b |= 0x80
        out.push(b)
    } while (n)
    return out
}
const fieldVarint = (field: number, value: number | bigint) => [...varint((field << 3) | 0), ...varint(value)]
const fieldBytes = (field: number, bytes: Uint8Array | number[]) => [...varint((field << 3) | 2), ...varint(bytes.length), ...bytes]
const fieldString = (field: number, s: string) => fieldBytes(field, [...Buffer.from(s, 'utf8')])

type Decoded = Record<number, bigint | Buffer | number>

export function decodeProto(buf: Buffer): Decoded {
    const out: Decoded = {}
    let i = 0
    const readVarint = () => {
        let result = B0
        let shift = B0
        let b: number
        do {
            if (i >= buf.length) throw new Error('protobuf truncado')
            b = buf[i++]
            result |= BigInt(b & 0x7f) << shift
            shift += B7
        } while (b & 0x80)
        return result
    }
    while (i < buf.length) {
        const key = Number(readVarint())
        const field = key >> 3
        const wire = key & 7
        if (wire === 0) out[field] = readVarint()
        else if (wire === 2) {
            const len = Number(readVarint())
            out[field] = buf.subarray(i, i + len)
            i += len
        } else if (wire === 5) {
            out[field] = buf.readFloatLE(i)
            i += 4
        } else if (wire === 1) {
            out[field] = buf.readBigUInt64LE(i)
            i += 8
        } else throw new Error(`protobuf: tipo ${wire} no soportado`)
    }
    return out
}

export const encodeProto = { varint: fieldVarint, bytes: fieldBytes, string: fieldString }

async function authCall(method: string, body: number[], accessToken?: string): Promise<{ eresult: number; msg: Decoded }> {
    const url = new URL(`${STEAM_API}/IAuthenticationService/${method}/v1/`)
    // El permiso va en la URL porque así lo pide la Web API; la URL no se registra en ningún sitio nuestro.
    if (accessToken) url.searchParams.set('access_token', accessToken)
    const form = new FormData()
    form.set('input_protobuf_encoded', Buffer.from(body).toString('base64'))
    const res = await fetch(url, { method: 'POST', body: form, cache: 'no-store' })
    if (!res.ok) throw new SteamFamilyError(`Steam respondió ${res.status} en ${method}`, 'steam')
    const eresult = Number(res.headers.get('x-eresult') ?? 1)
    return { eresult, msg: decodeProto(Buffer.from(await res.arrayBuffer())) }
}

const str = (v: Decoded[number] | undefined) => (Buffer.isBuffer(v) ? v.toString('utf8') : undefined)

// ─── Sesión del QR ───────────────────────────────────────────────────────────

/** Lo que hace falta para preguntar a Steam si ya se aprobó. Viaja cifrado en una cookie httpOnly, nunca en claro. */
export interface QrSession {
    userId: string
    clientId: string
    requestId: string
    expiresAt: number
}

export async function beginQrSession(userId: string): Promise<{ session: QrSession; challengeUrl: string; interval: number }> {
    const { eresult, msg } = await authCall('BeginAuthSessionViaQR', [
        ...fieldString(1, DEVICE_NAME),
        ...fieldVarint(2, PLATFORM_WEB_BROWSER),
        ...fieldBytes(3, [...fieldString(1, DEVICE_NAME), ...fieldVarint(2, PLATFORM_WEB_BROWSER)]),
    ])
    const challengeUrl = str(msg[2])
    if (eresult !== 1 || typeof msg[1] !== 'bigint' || !Buffer.isBuffer(msg[3]) || !challengeUrl) {
        throw new SteamFamilyError(`Steam no ha dado el código QR (eresult ${eresult})`, 'steam')
    }
    return {
        session: { userId, clientId: msg[1].toString(), requestId: msg[3].toString('base64'), expiresAt: Date.now() + QR_TTL_MS },
        challengeUrl,
        interval: typeof msg[4] === 'number' && msg[4] > 0 ? msg[4] : 5,
    }
}

export type PollResult =
    | { state: 'waiting' | 'scanned'; session: QrSession; challengeUrl?: string }
    | { state: 'approved'; accessToken: string; refreshToken: string }

/** Una consulta a Steam. Si ya se aprobó, devuelve los permisos: hay que usarlos y anularlos enseguida. */
export async function pollQrSession(session: QrSession): Promise<PollResult> {
    if (Date.now() > session.expiresAt) throw new SteamFamilyError('El código ha caducado', 'expired')
    const { eresult, msg } = await authCall('PollAuthSessionStatus', [
        ...fieldVarint(1, BigInt(session.clientId)),
        ...fieldBytes(2, Buffer.from(session.requestId, 'base64')),
    ])
    // 9 (FileNotFound): rechazado en el móvil, o Steam ya ha cerrado la sesión del QR.
    if (eresult === 9) throw new SteamFamilyError('Lo has rechazado en el móvil', 'denied')
    if (eresult !== 1) throw new SteamFamilyError(`Steam respondió eresult ${eresult}`, 'steam')

    const refreshToken = str(msg[3])
    const accessToken = str(msg[4])
    if (refreshToken && accessToken) return { state: 'approved', accessToken, refreshToken }
    if (refreshToken) {
        // Sin permiso corto no podemos consultar nada: se anula el largo y se avisa.
        await revokeRefreshToken(refreshToken).catch(() => {})
        throw new SteamFamilyError('Steam no ha dado el permiso de acceso', 'steam')
    }

    // Steam puede renovar el QR (nuevo client_id y URL) mientras se espera.
    const next = typeof msg[1] === 'bigint' ? { ...session, clientId: msg[1].toString() } : session
    return { state: msg[5] ? 'scanned' : 'waiting', session: next, challengeUrl: str(msg[2]) }
}

/**
 * Anula la sesión en Steam: desaparece de «Dispositivos autorizados» y el permiso largo deja de valer. El corto
 * (24 h) no se puede anular, por eso nunca sale de esta función ni se guarda.
 */
export async function revokeRefreshToken(refreshToken: string, accessToken?: string): Promise<boolean> {
    const { eresult } = await authCall('RevokeToken', [...fieldString(1, refreshToken), ...fieldVarint(2, REVOKE_PERMANENT)], accessToken)
    return eresult === 1
}

/** SteamID64 del permiso (campo `sub` del JWT). No se verifica la firma: solo se compara con la cuenta vinculada. */
export function tokenSteamId(token: string): string | null {
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
        return typeof payload.sub === 'string' && /^\d{17}$/.test(payload.sub) ? payload.sub : null
    } catch {
        return null
    }
}

// ─── Grupo familiar ──────────────────────────────────────────────────────────

export interface SharedApp {
    appid: number
    name?: string
    owner_steamids?: string[]
    exclude_reason?: number
    rt_playtime?: number
    rt_last_played?: number
}

export interface FamilyLibrary {
    memberSteamIds: string[]
    apps: SharedApp[]
}

async function familyGet<T>(path: string, accessToken: string): Promise<T> {
    const res = await fetch(`${STEAM_API}/IFamilyGroupsService/${path}&access_token=${encodeURIComponent(accessToken)}`, { cache: 'no-store' })
    if (!res.ok) throw new SteamFamilyError(`Steam respondió ${res.status} al pedir el grupo familiar`, 'steam')
    return ((await res.json()) as { response: T }).response
}

export async function fetchFamilyLibrary(accessToken: string, steamid: string): Promise<FamilyLibrary> {
    const group = await familyGet<{ family_groupid?: string; family_group?: { members?: { steamid?: string }[] } }>(
        `GetFamilyGroupForUser/v1/?steamid=${steamid}&include_family_group_response=1`,
        accessToken,
    )
    if (!group.family_groupid || group.family_groupid === '0') throw new SteamFamilyError('No estás en ningún grupo familiar de Steam', 'no_family')
    const shared = await familyGet<{ apps?: SharedApp[] }>(
        `GetSharedLibraryApps/v1/?family_groupid=${group.family_groupid}&include_own=1&include_excluded=1&steamid=${steamid}`,
        accessToken,
    )
    return {
        memberSteamIds: (group.family_group?.members ?? []).flatMap((m) => (m.steamid ? [m.steamid] : [])),
        apps: shared.apps ?? [],
    }
}

/** Los que te prestan: de otro miembro, que Steam deja compartir (sin exclude_reason) y que no tienes tú. */
export function borrowedApps(apps: SharedApp[], steamid: string): SharedApp[] {
    return apps.filter((a) => Number.isInteger(a.appid) && !a.exclude_reason && !(a.owner_steamids ?? []).includes(steamid) && (a.owner_steamids ?? []).length > 0)
}

// ─── Cookie cifrada con la sesión del QR ─────────────────────────────────────

export const FAMILY_QR_COOKIE = 'hubgames_family_qr'

function sealKey(): Buffer {
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!secret) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')
    return Buffer.from(hkdfSync('sha256', secret, 'hubgames', 'steam-family-qr-cookie', 32))
}

/** AES-256-GCM: el navegador guarda la sesión del QR sin poder leerla ni cambiarla. */
export function sealSession(session: QrSession): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', sealKey(), iv)
    const data = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url')
}

export function openSession(sealed: string | undefined, userId: string): QrSession | null {
    if (!sealed) return null
    try {
        const raw = Buffer.from(sealed, 'base64url')
        const decipher = createDecipheriv('aes-256-gcm', sealKey(), raw.subarray(0, 12))
        decipher.setAuthTag(raw.subarray(12, 28))
        const session = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')) as QrSession
        return session.userId === userId ? session : null
    } catch {
        return null
    }
}
