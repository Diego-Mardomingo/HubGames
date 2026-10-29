import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    agoLabel,
    durationLabel,
    fuenteLabel,
    genLogState,
    ingestTone,
    isFutureJudi,
    isoDayShort,
    judiDayShort,
    madridHour,
    parseDailyLog,
    parsePoolLog,
    poolState,
    recentFailures,
    relevanceShare,
    reserveTone,
    sharePercent,
    steamHealth,
    syncFacts,
    syncState,
    syncStats,
    tomorrowJudiDay,
    tomorrowStatus,
} from './admin'

const WEEKLY = 'Pool semanal 2026-10-25 → 2026-10-31 | +40/40 filas nuevas | elegibles 5 | no elegibles 35 | fallos 2 | intentos 42 | cola restante 184 | SteamSpy págs. 1 [tiered_then_steamspy_all]'

describe('administración', () => {
    it('nombre de la fuente, también la del relleno inicial', () => {
        assert.equal(fuenteLabel('steam_pool_daily_pick'), 'Juego del día')
        assert.equal(fuenteLabel('steam_weekly_pool'), 'Ingesta del pool')
        assert.equal(fuenteLabel('steam_pool_backfill'), 'Relleno inicial')
        assert.equal(fuenteLabel('otra_cosa'), 'otra_cosa')
        assert.equal(fuenteLabel(null), '—')
    })

    it('cifras de una ingesta semanal desde su texto', () => {
        assert.deepEqual(parsePoolLog(WEEKLY), {
            inserted: 40, target: 40, eligible: 5, ineligible: 35, failed: 2, attempts: 42, queue: 184,
            from: '2026-10-25', to: '2026-10-31', strategy: 'tiered_then_steamspy_all',
        })
        assert.equal(parsePoolLog('Pool semanal: error durante ejecución (2026-10-25)'), null)
        assert.equal(parsePoolLog(null), null)
    })

    it('juego de un log del pick diario', () => {
        assert.deepEqual(parseDailyLog('Juego del día asignado: Noita (Steam 881100)'), { game: 'Noita', same: false })
        assert.deepEqual(parseDailyLog('Juego del día asignado: Middle-earth™: Shadow of War™ (Steam 356190)'), { game: 'Middle-earth™: Shadow of War™', same: false })
        assert.deepEqual(parseDailyLog('Sin cambios: ya había juego para 25-10-2026 — Brick Rigs'), { game: 'Brick Rigs', same: true })
        assert.deepEqual(parseDailyLog('Fallo en la elección del juego del día'), { game: null, same: false })
    })

    it('estado de un log: parcial si la ingesta metió filas, sin cambios si ya había juego', () => {
        assert.equal(genLogState({ exito: true, fuente: 'steam_pool_daily_pick', nombre_juego: 'Juego del día asignado: Noita (Steam 881100)' }), 'ok')
        assert.equal(genLogState({ exito: true, fuente: 'steam_pool_daily_pick', nombre_juego: 'Sin cambios: ya había juego para 25-10-2026 — Brick Rigs' }), 'same')
        assert.equal(genLogState({ exito: false, fuente: 'steam_weekly_pool', nombre_juego: WEEKLY }), 'partial')
        assert.equal(genLogState({ exito: false, fuente: 'steam_weekly_pool', nombre_juego: WEEKLY.replace('+40/40', '+0/40') }), 'ko')
        assert.equal(genLogState({ exito: false, fuente: 'steam_weekly_pool', nombre_juego: 'Pool semanal: error durante ejecución (2026-10-25)' }), 'ko')
        assert.equal(genLogState({ exito: false, fuente: 'steam_pool_daily_pick', nombre_juego: 'Fallo en la elección del juego del día' }), 'ko')
    })

    it('estado de una sincronización: colgada a partir de 15 minutos en curso', () => {
        const now = new Date('2026-10-29T12:00:00Z')
        assert.equal(syncState({ status: 'ok', started_at: '2026-10-29T06:00:00Z' }, now), 'ok')
        assert.equal(syncState({ status: 'parcial', started_at: '2026-10-29T06:00:00Z' }, now), 'partial')
        assert.equal(syncState({ status: 'error', started_at: '2026-10-29T06:00:00Z' }, now), 'ko')
        assert.equal(syncState({ status: 'en_curso', started_at: '2026-10-29T11:50:00Z' }, now), 'run')
        assert.equal(syncState({ status: 'en_curso', started_at: '2026-10-29T11:44:00Z' }, now), 'stale')
        assert.equal(durationLabel('2026-10-25T11:33:06Z', '2026-10-25T11:36:03Z'), '2 min 57 s')
        assert.equal(durationLabel('2026-10-29T06:45:58Z', '2026-10-29T06:46:06Z'), '8 s')
        assert.equal(durationLabel('2026-10-29T06:45:58Z', null), '—')
    })

    it('estadísticas de una sincronización y su resumen', () => {
        const stats = syncStats({
            library: { newToTray: 0, ownedGames: 106, catalogFetched: 0, catalogPending: 0 },
            tracker: { toPlaying: 0, suggestions: 4 },
            wishlist: { prices: { snapshots: 5, itadMatched: 0, lowsUpdated: 105, pricesUpdated: 105 }, steamItems: 105, pricesError: null },
            achievements: { apiCalls: 2, gamesDue: 2, gamesFailed: 0, gamesSynced: 2 },
            snapshotRows: 2,
            wishlistError: null,
        })
        assert.deepEqual(syncFacts(stats).map((f) => f.text), ['106 juegos', '2 con logros', '4 sugerencias', '105 precios'])
        assert.equal(stats?.wishlistMissing, false)
        // Anterior a la wishlist, con la wishlist fallida y un juego sin logros
        const old = syncStats({ library: { ownedGames: 106 }, achievements: { gamesDue: 3, gamesSynced: 2, gamesFailed: 1 }, snapshotRows: 0 })
        assert.equal(old?.wishlistMissing, true)
        assert.equal(old?.tracker, null)
        const failed = syncStats({ library: { ownedGames: 106 }, wishlist: null, wishlistError: '429', achievements: { gamesFailed: 1 } })
        assert.deepEqual(syncFacts(failed).map((f) => [f.text, f.tone]), [['106 juegos', undefined], ['Wishlist: 429', 'dash-warn'], ['1 juego sin logros', 'dash-warn']])
        assert.equal(syncStats(null), null)
        assert.deepEqual(syncFacts(null), [])
    })

    it('estado de una fila del pool', () => {
        assert.equal(poolState({ is_eligible: true, selected_for_daily: false, discarded: false }), 'unused')
        assert.equal(poolState({ is_eligible: true, selected_for_daily: true, discarded: false }), 'used')
        assert.equal(poolState({ is_eligible: false, selected_for_daily: false, discarded: false }), 'inel')
        assert.equal(poolState({ is_eligible: true, selected_for_daily: false, discarded: true }), 'disc')
        assert.equal(sharePercent(2, 1643), '< 1')
        assert.equal(sharePercent(409, 1643), '25')
        assert.equal(sharePercent(0, 1643), '0')
        assert.equal(relevanceShare(11440, 11440), 1)
        assert.equal(relevanceShare(0, 11440), 0)
        assert.ok(relevanceShare(1, 11440) > 0 && relevanceShare(1, 11440) < 0.1)
    })

    it('JUDI de mañana: listo, falló, pendiente hasta las 20:00 de Madrid y falta después', () => {
        const morning = new Date('2026-10-29T11:40:00Z') // 12:40 en Madrid (CET)
        const night = new Date('2026-10-29T19:30:00Z') // 20:30
        assert.equal(madridHour(morning), 12)
        assert.equal(tomorrowJudiDay(morning), '30-10-2026')
        assert.equal(tomorrowJudiDay(new Date('2026-10-31T23:30:00Z')), '02-11-2026') // ya es 1 de noviembre en Madrid
        assert.deepEqual(tomorrowStatus({ game: 'Bloons TD 6', pickLog: null }, morning), { state: 'ready', fecha: '30-10-2026', game: 'Bloons TD 6', error: null })
        assert.equal(tomorrowStatus({ game: null, pickLog: null }, morning).state, 'pending')
        assert.equal(tomorrowStatus({ game: null, pickLog: null }, night).state, 'missing')
        const failed = tomorrowStatus({ game: null, pickLog: { exito: false, fecha_judi: '30-10-2026', error_mensaje: 'Falta la entrada del catálogo Steam para 960090' } }, morning)
        assert.deepEqual([failed.state, failed.error], ['failed', 'Falta la entrada del catálogo Steam para 960090'])
        // Un fallo de otro día no cuenta
        assert.equal(tomorrowStatus({ game: null, pickLog: { exito: false, fecha_judi: '29-10-2026', error_mensaje: 'x' } }, morning).state, 'pending')
    })

    it('umbrales: reserva 30/7 y la ingesta 8/15 días', () => {
        assert.equal(reserveTone(409), 'dash-ok')
        assert.equal(reserveTone(30), 'dash-ok')
        assert.equal(reserveTone(29), 'dash-warn')
        assert.equal(reserveTone(7), 'dash-warn')
        assert.equal(reserveTone(6), 'dash-ko')
        assert.equal(ingestTone(3, 'partial'), 'dash-ok')
        assert.equal(ingestTone(8, 'ok'), 'dash-warn')
        assert.equal(ingestTone(15, 'ok'), 'dash-ko')
        assert.equal(ingestTone(1, 'ko'), 'dash-ko')
        assert.equal(ingestTone(null, null), 'dash-warn')
    })

    it('Steam: rojo a las 36 h sin una correcta, ámbar con problemas en 24 h', () => {
        const now = new Date('2026-10-29T12:00:00Z')
        const ok = { id: 1, source: 'cron', status: 'ok', started_at: '2026-10-29T06:45:00Z', finished_at: '2026-10-29T06:45:08Z', error: null }
        assert.equal(steamHealth([ok], now).tone, 'dash-ok')
        assert.equal(steamHealth([ok], now).inDay, 1)
        const err = { id: 2, source: 'manual', status: 'error', started_at: '2026-10-29T10:00:00Z', finished_at: '2026-10-29T10:00:03Z', error: 'x' }
        const h = steamHealth([err, ok], now)
        assert.deepEqual([h.tone, h.problemsInDay, h.errorsInDay], ['dash-warn', 1, 1])
        const old = { ...ok, started_at: '2026-10-27T20:00:00Z', finished_at: '2026-10-27T23:59:00Z' }
        assert.equal(steamHealth([old], now).tone, 'dash-ko')
        assert.equal(steamHealth([], now).tone, 'neutral')
        assert.equal(steamHealth([{ ...err, started_at: '2026-10-29T11:00:00Z' }], now).tone, 'dash-ko')
    })

    it('fallos recientes: sin parciales, con colgadas, del más reciente al más antiguo', () => {
        const now = new Date('2026-10-29T15:20:00Z')
        const gen = [
            { id: 330, exito: false, fuente: 'steam_pool_daily_pick', nombre_juego: 'Fallo en la elección del juego del día', fecha_ejecucion: '2026-10-29T15:12:41Z', error_mensaje: 'Falta la entrada del catálogo Steam para 960090' },
            { id: 326, exito: false, fuente: 'steam_weekly_pool', nombre_juego: WEEKLY, fecha_ejecucion: '2026-10-25T20:05:31Z', error_mensaje: '2 candidatos fallaron al procesar' },
            { id: 100, exito: false, fuente: 'steam_pool_daily_pick', nombre_juego: 'Fallo', fecha_ejecucion: '2026-10-01T10:00:00Z', error_mensaje: 'viejo' },
        ]
        const sync = [
            { id: 15, status: 'en_curso', started_at: '2026-10-29T02:10:00Z', finished_at: null, error: null },
            { id: 16, status: 'error', started_at: '2026-10-29T06:46:10Z', finished_at: '2026-10-29T06:46:13Z', error: 'Steam no devuelve juegos' },
            { id: 17, status: 'en_curso', started_at: '2026-10-29T15:18:40Z', finished_at: null, error: null },
        ]
        assert.deepEqual(recentFailures(gen, sync, now).map((f) => [f.kind, f.id, f.title]), [
            ['gen', 330, 'Juego del día'],
            ['sync', 16, 'Sincronización con Steam'],
            ['sync', 15, 'Sincronización sin terminar'],
        ])
    })

    it('fechas cortas y «hace…»', () => {
        const now = new Date('2026-10-29T11:40:00Z')
        assert.equal(agoLabel('2026-10-29T11:39:40Z', now), 'ahora')
        assert.equal(agoLabel('2026-10-29T11:28:00Z', now), 'hace 12 min')
        assert.equal(agoLabel('2026-10-29T06:46:06Z', now), 'hace 5 h')
        assert.equal(agoLabel('2026-10-28T06:00:00Z', now), 'hace 1 día')
        assert.equal(agoLabel('2026-10-25T20:05:31Z', now), 'hace 3 días')
        assert.equal(judiDayShort('29-10-2026'), 'jue 29 oct')
        assert.equal(isoDayShort('2026-10-25'), '25 oct')
        assert.equal(isFutureJudi('30-10-2026', now), true)
        assert.equal(isFutureJudi('29-10-2026', now), false)
    })
})
