// Exportar tus datos (#34): biblioteca (estados, notas, reseñas y fechas) y logros, en CSV o JSON.
// Sin acceso a la base de datos, con tests en export.test.ts.
import type { LibraryGame } from './tracker'

export const EXPORT_KINDS = ['biblioteca', 'logros', 'todo'] as const
export type ExportKind = (typeof EXPORT_KINDS)[number]

export interface ExportAchievement {
    appid: number
    game: string | null
    apiname: string
    display_name: string | null
    unlocktime: string | null
    global_percent: number | null
}

/** Columnas de la biblioteca, en el orden del CSV. Las horas en horas con un decimal, más legibles que minutos. */
export function libraryRows(games: LibraryGame[]) {
    return [...games]
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'es'))
        .map((g) => ({
            appid: g.appid,
            nombre: g.name,
            estado: g.status,
            objetivo: g.goal,
            nota: g.rating === null ? null : Number(g.rating),
            resena: g.review,
            horas: Math.round((g.playtime_forever / 60) * 10) / 10,
            logros: g.achievements_unlocked,
            logros_total: g.achievements_total,
            empezado: g.started_at,
            completado: g.completed_at,
            ultima_partida: g.rtime_last_played,
            ultimo_logro: g.last_unlock_at,
            posicion_pendientes: g.backlog_position,
            anadido: g.created_at,
        }))
}

export type LibraryRow = ReturnType<typeof libraryRows>[number]

export const LIBRARY_COLUMNS: (keyof LibraryRow)[] = [
    'appid',
    'nombre',
    'estado',
    'objetivo',
    'nota',
    'resena',
    'horas',
    'logros',
    'logros_total',
    'empezado',
    'completado',
    'ultima_partida',
    'ultimo_logro',
    'posicion_pendientes',
    'anadido',
]

export const ACHIEVEMENT_COLUMNS = ['appid', 'juego', 'logro', 'id_logro', 'desbloqueado', 'porcentaje_global'] as const

export function achievementRows(list: ExportAchievement[]) {
    return [...list]
        .sort((a, b) => (a.unlocktime ?? '').localeCompare(b.unlocktime ?? '') || a.appid - b.appid)
        .map((a) => ({
            appid: a.appid,
            juego: a.game,
            logro: a.display_name ?? a.apiname,
            id_logro: a.apiname,
            desbloqueado: a.unlocktime,
            porcentaje_global: a.global_percent,
        }))
}

function csvCell(value: unknown): string {
    if (value === null || value === undefined) return ''
    const text = typeof value === 'number' ? String(value).replace('.', ',') : String(value)
    return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * CSV para Excel en español: separador `;`, decimales con coma y BOM para que abra las tildes bien.
 * Las fechas van en ISO 8601 (UTC).
 */
export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: (keyof T & string)[]): string {
    const lines = [columns.join(';'), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(';'))]
    return '﻿' + lines.join('\r\n') + '\r\n'
}

export function exportFileName(kind: ExportKind, format: 'csv' | 'json', now: Date = new Date()): string {
    return `hubgames-${kind}-${now.toISOString().slice(0, 10)}.${format}`
}
