// Ficha /juego (#22): lectura segura de los campos de la ficha de Steam. Sin acceso a la base de datos, con tests.
import type { Json } from './supabase/database.types'

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodeEntities(text: string): string {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
        if (code[0] === '#') {
            const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
            return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole
        }
        return ENTITIES[code.toLowerCase()] ?? whole
    })
}

/**
 * Convierte el HTML de Steam ("Acerca de este juego") en párrafos de texto plano. Se pinta como texto, nunca como
 * HTML, así que no hace falta sanear: se pierden imágenes y formato a cambio de no inyectar nada.
 */
export function htmlToParagraphs(html: string | null): string[] {
    if (!html) return []
    const text = html
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h\d|li|ul|ol)>/gi, '\n\n')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<[^>]+>/g, '')
    return decodeEntities(text)
        .split(/\n\s*\n/)
        .map((p) =>
            p
                .split('\n')
                .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
                .filter(Boolean)
                .join('\n'),
        )
        .filter(Boolean)
}

function isObject(value: Json | undefined): value is { [key: string]: Json | undefined } {
    return !!value && typeof value === 'object' && !Array.isArray(value)
}

function str(value: Json | undefined): string | null {
    return typeof value === 'string' && value ? value : null
}

export interface Screenshot {
    thumb: string
    full: string
}

export function parseScreenshots(value: Json | null): Screenshot[] {
    if (!Array.isArray(value)) return []
    return value.flatMap((s) => {
        if (!isObject(s)) return []
        const full = str(s.path_full)
        const thumb = str(s.path_thumbnail) ?? full
        return full && thumb ? [{ thumb, full }] : []
    })
}

export interface Trailer {
    name: string
    poster: string | null
    /** mp4/webm directos (fichas antiguas) o HLS (las de ahora), que necesita hls.js fuera de Safari. */
    mp4: string | null
    webm: string | null
    hls: string | null
}

/** Tráileres de la ficha, con el destacado primero. Los que no traen ningún vídeo reproducible se descartan. */
export function parseTrailers(value: Json | null): Trailer[] {
    if (!Array.isArray(value)) return []
    const out = value.flatMap((m) => {
        if (!isObject(m)) return []
        const mp4 = isObject(m.mp4) ? str(m.mp4.max) ?? str(m.mp4['480']) : null
        const webm = isObject(m.webm) ? str(m.webm.max) ?? str(m.webm['480']) : null
        const hls = str(m.hls_h264)
        if (!mp4 && !webm && !hls) return []
        return [{ trailer: { name: str(m.name) ?? 'Tráiler', poster: str(m.thumbnail), mp4, webm, hls }, highlight: m.highlight === true }]
    })
    return out.sort((a, b) => Number(b.highlight) - Number(a.highlight)).map((t) => t.trailer)
}

export function parseGenres(value: Json | null): string[] {
    if (!Array.isArray(value)) return []
    return value.flatMap((g) => (isObject(g) && str(g.description) ? [g.description as string] : []))
}
