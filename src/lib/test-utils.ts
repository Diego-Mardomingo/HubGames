// Utilidades compartidas por los tests (*.test.ts). No se usa en la app.
import type { LibraryGame } from './tracker'

let nextAppid = 1000

/** Fila de hubgames_library con valores neutros; `overrides` cambia lo que importe en cada test. */
export function libraryGame(overrides: Partial<LibraryGame> = {}): LibraryGame {
    return {
        user_id: 'u',
        appid: nextAppid++,
        status: 'pendiente',
        status_source: 'manual',
        rating: null,
        started_at: null,
        completed_at: null,
        review: null,
        backlog_position: null,
        goal: 'historia',
        created_at: '2026-10-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
        playtime_forever: 0,
        playtime_2weeks: 0,
        rtime_last_played: null,
        achievements_total: null,
        achievements_unlocked: null,
        last_unlock_at: null,
        name: 'Juego',
        header_image: null,
        steamspy_userscore: null,
        status_changed_at: '2026-10-01T00:00:00Z',
        suggestion: null,
        suggestion_dismissed_at: null,
        genres: null,
        release_date: null,
        steamspy_median_forever: null,
        hltb_main: null,
        hltb_main_extra: null,
        hltb_completionist: null,
        ...overrides,
    }
}
