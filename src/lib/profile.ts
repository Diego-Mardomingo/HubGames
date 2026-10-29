import { parseJudiDate } from './dashboard'
import { getPointsForRecord, type JudiProgressRecord } from './judi-ranking'
import { fuenteLabel, genLogState, parseDailyLog, RUN_STATE_META, TOMORROW_META, type RunState, type Tomorrow } from './admin'

// ── Perfil (/perfil): lógica pura de la tarjeta de usuario, Steam, JUDI y la tarjeta de administración ──

const TZ = 'Europe/Madrid'

/** «marzo de 2025»: el mes en que se creó la cuenta (`session.user.created_at`), para «En HubGames desde…». */
export function memberSince(iso: string | null | undefined): string | null {
    if (!iso) return null
    const t = Date.parse(iso)
    if (Number.isNaN(t)) return null
    return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: TZ }).format(t)
}

export type SteamState = 'ok' | 'privado' | 'detalles' | 'desconocida' | 'none'

/** Estado de la cuenta de Steam a partir de `hubgames_user_steam.visibility` (null = sin vincular). */
export function steamState(link: { visibility: string } | null | undefined): SteamState {
    if (!link) return 'none'
    switch (link.visibility) {
        case 'privado':
            return 'privado'
        case 'detalles_privados':
            return 'detalles'
        case 'desconocida':
            return 'desconocida'
        default:
            return 'ok'
    }
}

/** Color (clase de tono) y nombre de cada estado: verde conectada, ámbar si hay que arreglar algo, neutro sin vincular. */
export const STEAM_STATE_META: Record<SteamState, { tone: 'dash-ok' | 'dash-warn' | 'neutral'; label: string }> = {
    ok: { tone: 'dash-ok', label: 'Conectada' },
    privado: { tone: 'dash-warn', label: 'Perfil privado' },
    detalles: { tone: 'dash-warn', label: 'Detalles de juego privados' },
    desconocida: { tone: 'dash-warn', label: 'No se pudo leer el perfil' },
    none: { tone: 'neutral', label: 'Sin conectar' },
}

/** El perfil o los detalles de juego son privados: se enseñan los pasos y no se puede sincronizar. */
export function steamNeedsFix(state: SteamState): boolean {
    return state === 'privado' || state === 'detalles'
}

const RELATIVE = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' })

/** «hace 5 minutos», «ayer»… Solo pasado: con relojes desfasados, nunca «dentro de…». */
export function timeAgo(iso: string, now: number = Date.now()): string {
    const seconds = Math.min(0, Math.round((Date.parse(iso) - now) / 1000))
    const units: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86400], ['hour', 3600], ['minute', 60]]
    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit)
    }
    return 'hace un momento'
}

// ── JUDI ──

export type JudiStats = { aciertos: number; fallos: number; total: number; precision: number; puntos: number }

/** Tus cifras de JUDI a partir de tus filas de `hubgames_judi_fases_usuario` (las mismas reglas que el ranking). */
export function judiStats(rows: JudiProgressRecord[]): JudiStats {
    const aciertos = rows.filter((f) => f.completado).length
    const fallos = rows.filter((f) => f.fase6 && !f.completado).length
    const total = aciertos + fallos
    const puntos = rows.reduce((sum, f) => sum + (getPointsForRecord(f) || 0), 0)
    return { aciertos, fallos, total, precision: total > 0 ? Math.round((aciertos / total) * 100) : 0, puntos }
}

/** «Superas al N % de los jugadores»: null si no estás en el ranking o eres el único. */
export function beatPercent(rank: number | null, total: number): number | null {
    if (rank === null || total < 2) return null
    return Math.round(((total - rank) / (total - 1)) * 100)
}

/** Los `size` primeros del ranking y, si estás fuera de ellos, tu entrada con su puesto (para la fila tras «···»). */
export function topWithSelf<T extends { userId: string; rank?: number }>(
    ranking: T[],
    userId: string | null,
    size = 5,
): { top: T[]; self: { entry: T; rank: number } | null; rank: number | null } {
    const pos = userId ? ranking.findIndex((e) => e.userId === userId) : -1
    // El puesto de buildRanking (empates compartidos) si lo trae; si no, el orden.
    const rankAt = (i: number) => ranking[i].rank ?? i + 1
    const rank = pos === -1 ? null : rankAt(pos)
    return {
        top: ranking.slice(0, size),
        self: pos >= size ? { entry: ranking[pos], rank: rankAt(pos) } : null,
        rank,
    }
}

// ── Administración ──

export type AdminTone = 'dash-ok' | 'dash-warn' | 'dash-ko'

/** Hoy en Madrid como DD-MM-YYYY (el formato de las fechas de JUDI). */
export function judiDay(now: Date = new Date()): string {
    const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).split('-')
    return `${d}-${m}-${y}`
}

/** «3 de noviembre» a partir de DD-MM-YYYY. */
export function judiDateLong(fecha: string): string {
    const t = parseJudiDate(fecha)
    if (t === null) return fecha
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(t)
}

/** «hoy, 06:00», «ayer, 06:00» o «26 oct, 06:00» (hora de Madrid). */
export function adminWhen(iso: string, now: Date = new Date()): string {
    const t = new Date(iso)
    if (Number.isNaN(t.getTime())) return '—'
    const time = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(t)
    const day = judiDay(t)
    if (day === judiDay(now)) return `hoy, ${time}`
    if (day === judiDay(new Date(now.getTime() - 86_400_000))) return `ayer, ${time}`
    const date = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: TZ }).format(t).replace('.', '')
    return `${date}, ${time}`
}

export type AdminLine = { key: 'gen' | 'tomorrow' | 'sync'; tone: AdminTone; title: string; value: string; detail?: string }

export type AdminInput = {
    lastGen: { exito: boolean; fuente: string | null; fecha_ejecucion: string | null; nombre_juego: string | null; error_mensaje: string | null } | null
    /** El JUDI de mañana (`tomorrowStatus` de `src/lib/admin.ts`, la misma regla que /admin y el health check). */
    tomorrow: Tomorrow
    syncErrors: number
}

/** Las tres líneas de estado de la tarjeta de administración, con su color (las mismas reglas que /admin). */
export function adminLines(input: AdminInput, now: Date = new Date()): AdminLine[] {
    const { lastGen, tomorrow, syncErrors } = input
    const genState = lastGen ? genLogState(lastGen) : null
    const genTone: Record<RunState, AdminTone> = { ok: 'dash-ok', same: 'dash-ok', partial: 'dash-warn', stale: 'dash-warn', run: 'dash-warn', ko: 'dash-ko' }
    const gen: AdminLine =
        !lastGen || !genState
            ? { key: 'gen', tone: 'dash-warn', title: 'Último JUDI generado', value: 'Sin registros' }
            : {
                  key: 'gen',
                  tone: genTone[genState],
                  title: 'Último JUDI generado',
                  value: RUN_STATE_META[genState].label,
                  detail: [
                      lastGen.fecha_ejecucion ? adminWhen(lastGen.fecha_ejecucion, now) : null,
                      genState === 'ok' || genState === 'same' ? (parseDailyLog(lastGen.nombre_juego).game ?? fuenteLabel(lastGen.fuente)) : lastGen.error_mensaje,
                  ]
                      .filter(Boolean)
                      .join(' · '),
              }
    const meta = TOMORROW_META[tomorrow.state]
    const day = judiDateLong(tomorrow.fecha)
    const tomorrowLine: AdminLine = {
        key: 'tomorrow',
        tone: meta.tone as AdminTone,
        title: 'JUDI de mañana',
        value: meta.label,
        detail:
            tomorrow.state === 'ready'
                ? `${day} · ${tomorrow.game}`
                : tomorrow.state === 'pending'
                  ? `${day} · suele llegar entre las 15:00 y las 18:00`
                  : tomorrow.state === 'failed'
                    ? `${day} · ${tomorrow.error ?? 'el pick falló'}`
                    : `${day} · el pick de hoy no ha dejado ningún log`,
    }
    const sync: AdminLine = {
        key: 'sync',
        tone: syncErrors > 0 ? 'dash-ko' : 'dash-ok',
        title: 'Sincronizaciones con Steam (24 h)',
        value: syncErrors > 0 ? `${syncErrors.toLocaleString('es-ES')} con error` : 'Ninguna con error',
    }
    return [gen, tomorrowLine, sync]
}
