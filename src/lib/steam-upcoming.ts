// «Lo más esperado en Steam» para «Sale pronto» del Inicio: la lista pública de lanzamientos más deseados de la tienda
// (search/results?filter=popularwishlist) y la fecha de cada uno (appdetails). Se pide a Steam en el momento, sin
// guardarlo en la base de datos; la caché de datos de Next evita repetir peticiones (una hora la lista, seis la ficha).
// Son endpoints de la tienda sin documentar: si fallan o cambian, la sección se queda solo con tu wishlist.

const STORE = 'https://store.steampowered.com'
/** Puestos de la lista que se miran: los más deseados suelen no tener fecha todavía. */
const CANDIDATES = 16
const TIMEOUT_MS = 4000

export interface HypedGame {
    appid: number
    name: string
    header_image: string | null
    /** YYYY-MM-DD; solo entran los que tienen día concreto. */
    release_date: string
    /** Puesto en la lista de más deseados de Steam (1 = el más deseado). */
    rank: number
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }

/**
 * Fecha de la tienda en inglés con día concreto («23 Feb, 2027» o «Feb 23, 2027») → YYYY-MM-DD.
 * «Q1 2027», «2027», «Coming soon» o «To be announced» → null: sin día no se sabe cuándo sale.
 */
export function parseReleaseDay(text: string | null | undefined): string | null {
    if (!text) return null
    const t = text.trim().toLowerCase().replace(',', '')
    const m = /^(\d{1,2}) ([a-z]{3})[a-z]* (\d{4})$/.exec(t) ?? /^([a-z]{3})[a-z]* (\d{1,2}) (\d{4})$/.exec(t)
    if (!m) return null
    const [day, mon] = /^\d/.test(m[1]) ? [Number(m[1]), m[2]] : [Number(m[2]), m[1]]
    const month = MONTHS[mon]
    if (!month || day < 1 || day > 31) return null
    return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** appid de la URL de la cápsula de un resultado de búsqueda (…/steam/apps/2769570/…). */
export function appidFromAsset(url: string): number | null {
    const m = /\/apps\/(\d+)\//.exec(url)
    return m ? Number(m[1]) : null
}

async function getJson(url: string, revalidate: number): Promise<unknown> {
    const res = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    return res.json()
}

interface StoreDetails {
    success?: boolean
    data?: { type?: string; name?: string; header_image?: string; release_date?: { coming_soon?: boolean; date?: string } }
}

/** Los más deseados de Steam que aún no han salido y tienen día de lanzamiento, en el orden de la lista. */
export async function loadMostWishlisted(): Promise<HypedGame[]> {
    try {
        const list = (await getJson(`${STORE}/search/results/?filter=popularwishlist&json=1&count=${CANDIDATES}&cc=ES&l=spanish`, 3600)) as {
            items?: { name?: string; logo?: string }[]
        }
        const ranked = (list.items ?? [])
            .map((item, i) => ({ appid: item.logo ? appidFromAsset(item.logo) : null, name: item.name ?? null, rank: i + 1 }))
            .filter((x): x is { appid: number; name: string | null; rank: number } => x.appid !== null)
        const details = await Promise.all(
            ranked.map(async (x) => {
                try {
                    const body = (await getJson(`${STORE}/api/appdetails?appids=${x.appid}&filters=basic,release_date&cc=es&l=english`, 6 * 3600)) as Record<
                        string,
                        StoreDetails
                    >
                    const d = body[String(x.appid)]
                    if (!d?.success || !d.data || d.data.type !== 'game' || d.data.release_date?.coming_soon === false) return null
                    const day = parseReleaseDay(d.data.release_date?.date)
                    if (!day) return null
                    return { appid: x.appid, name: x.name ?? d.data.name ?? `App ${x.appid}`, header_image: d.data.header_image ?? null, release_date: day, rank: x.rank }
                } catch {
                    return null
                }
            }),
        )
        return details.filter((d): d is HypedGame => d !== null)
    } catch (e) {
        console.error('steam-upcoming: lista de más deseados', e)
        return []
    }
}
