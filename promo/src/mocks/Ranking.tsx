import { ArrowUp, Check, Medal, Ruler, Trophy } from 'lucide-react'
import { USER } from '../data'
import { C, ease, medalInk, rise, tint } from '../theme'
import { IconBox } from '../ui/kit'
import { count } from './count'

type P = { rank: number; name: string; pts: number; hits: number; pct: number; avg: string; trend: number; me?: boolean }

const PODIUM: P[] = [
    { rank: 2, name: USER, pts: 607, hits: 138, pct: 81, avg: '2,6', trend: 40, me: true },
    { rank: 1, name: 'Marta', pts: 618, hits: 121, pct: 81, avg: '2,1', trend: 60 },
    { rank: 3, name: 'Dani', pts: 522, hits: 98, pct: 80, avg: '2,9', trend: 0 },
]

const REST: P[] = [
    { rank: 4, name: 'Lucía', pts: 431, hits: 84, pct: 76, avg: '3,0', trend: 22 },
    { rank: 5, name: 'Pablo', pts: 298, hits: 61, pct: 70, avg: '3,4', trend: 8 },
]

const HEIGHT: Record<number, number> = { 1: 96, 2: 66, 3: 44 }

/** Ranking de JUDI: puntos por intento, tiles y podio con medallas que sube 3.º, 2.º y 1.º. */
export const RankingMock = ({ f }: { f: number }) => (
    <div style={{ padding: '24px 30px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={rise(f, 0)}>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>Ranking</div>
            <div style={{ color: C.muted, fontSize: 14.5, marginTop: 4 }}>Cuanto antes aciertes el juego del día, más puntos sumas.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 12.5, color: C.muted }}>
                Puntos por intento
                {[6, 5, 4, 3, 2, 1].map((p, i) => (
                    <span key={p} style={{ padding: '1px 6px', borderRadius: 5, fontWeight: 700, fontSize: 11.5, color: i === 0 ? C.onDone : C.fg, background: i === 0 ? C.success : C.surface2 }}>
                        +{p}
                    </span>
                ))}
                · fallar no suma
            </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, ...rise(f, 2) }}>
            {[
                { Icon: Medal, color: C.medal[1], label: 'Tu puesto', value: <>2.º <span style={{ fontSize: 14, color: C.muted, fontWeight: 500 }}>de 6</span></>, note: 'Superas al 83 %' },
                { Icon: Trophy, color: C.primary, label: 'Puntos', value: count(f, 4, 607), note: '+40 en 30 días' },
                { Icon: Ruler, color: C.primary, label: 'Distancia', value: <>11 <span style={{ fontSize: 14, color: C.muted, fontWeight: 500 }}>pts</span></>, note: 'te faltan para pasar a Marta' },
                { Icon: Check, color: C.success, label: 'Acertados', value: <>{count(f, 4, 138)} <span style={{ fontSize: 14, color: C.muted, fontWeight: 500 }}>81 %</span></>, note: 'de 170 · media 2,6 intentos' },
            ].map((t, i) => (
                <div key={i} style={{ padding: 14, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, fontSize: 13 }}>
                        <IconBox Icon={t.Icon} color={t.color} size={24} icon={13} />
                        {t.label}
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6, whiteSpace: 'nowrap', color: i === 0 ? medalInk(C.medal[1]) : undefined }}>{t.value}</div>
                    <div style={{ color: C.muted, fontSize: 12.5, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.note}</div>
                </div>
            ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, height: 330 }}>
            {PODIUM.map((p) => {
                const order = { 3: 0, 2: 1, 1: 2 }[p.rank] ?? 0
                const t = ease(f, 10 + order * 6, 12)
                const medal = C.medal[p.rank - 1]
                return (
                    <div key={p.rank} style={{ width: 250, display: 'flex', flexDirection: 'column', opacity: t, translate: `0 ${(1 - t) * 60}px` }}>
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '14px 12px 12px',
                                borderRadius: '12px 12px 0 0',
                                background: p.me ? C.primaryGlow : C.surface,
                                border: `1px solid ${p.me ? C.primary : C.border}`,
                                borderBottom: 'none',
                            }}
                        >
                            <span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 99, border: `2.5px solid ${medal}`, background: tint(medal), color: medalInk(medal), fontWeight: 700, fontSize: 14 }}>{p.rank}</span>
                            <span style={{ display: 'grid', placeItems: 'center', width: 46, height: 46, borderRadius: 99, marginTop: 8, background: p.me ? C.primary : C.surface2, color: p.me ? C.primaryFg : C.fg, fontWeight: 700, fontSize: 19 }}>
                                {p.name[0].toUpperCase()}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontWeight: 700, fontSize: 15 }}>
                                {p.name}
                                {p.me && <span style={{ padding: '1px 7px', borderRadius: 999, fontSize: 11, background: C.primary, color: C.primaryFg }}>Tú</span>}
                            </div>
                            <div style={{ marginTop: 4, fontSize: 26, fontWeight: 800 }}>
                                {count(f, 12 + order * 6, p.pts, 14)} <span style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>puntos</span>
                            </div>
                            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                                {p.hits} acertados · {p.pct} % · media {p.avg}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, marginTop: 4, color: p.trend ? C.success : C.muted, fontWeight: 600 }}>
                                {p.trend ? <ArrowUp size={12} strokeWidth={2.6} /> : '='} {p.trend ? `+${p.trend}` : '+0'} <span style={{ color: C.muted, fontWeight: 500 }}>en 30 días</span>
                            </div>
                        </div>
                        <div
                            style={{
                                height: HEIGHT[p.rank],
                                display: 'grid',
                                placeItems: 'center',
                                borderRadius: '0 0 12px 12px',
                                background: tint(medal, '22%'),
                                borderTop: `3px solid ${medal}`,
                                fontSize: 30,
                                fontWeight: 800,
                                color: medalInk(medal),
                            }}
                        >
                            {p.rank}
                        </div>
                    </div>
                )
            })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...rise(f, 30) }}>
            {REST.map((p) => (
                <div key={p.rank} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, fontSize: 14 }}>
                    <span style={{ width: 22, fontWeight: 700, color: C.muted }}>{p.rank}</span>
                    <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 99, background: C.surface2, fontWeight: 700, fontSize: 13 }}>{p.name[0]}</span>
                    <b>{p.name}</b>
                    <span style={{ color: C.muted, fontSize: 12.5 }}>
                        {p.hits} acertados · media {p.avg}
                    </span>
                    <span style={{ flex: 1 }} />
                    <span style={{ color: C.success, fontSize: 12.5, fontWeight: 600 }}>+{p.trend}</span>
                    <b style={{ width: 70, textAlign: 'right' }}>{p.pts} pts</b>
                </div>
            ))}
        </div>
    </div>
)
