import { Award, Check, Flag, Flame, History, Lock, Sparkles, Target, Trophy, Zap } from 'lucide-react'
import { G, header, type Game } from '../data'
import { C, ease, lerp, nf, pop, rarInk, rise, tint } from '../theme'
import { Bar, Button, Cover, IconBox, LISTS, Panel, SectionHead, StatusChip, type ListKey } from '../ui/kit'
import { count } from './count'

type Rar = keyof typeof C.rar

const RARITIES: { k: Rar; label: string; n: number; pts: number; rule: string }[] = [
    { k: 'comun', label: 'Común', n: 812, pts: 1624, rule: '≥ 40 %' },
    { k: 'poco', label: 'Poco común', n: 604, pts: 3624, rule: '< 40 %' },
    { k: 'rara', label: 'Rara', n: 291, pts: 3201, rule: '< 15 %' },
    { k: 'epica', label: 'Épica', n: 129, pts: 2064, rule: '< 5 %' },
    { k: 'leg', label: 'Legendaria', n: 37, pts: 814, rule: '< 1 %' },
]

const NEAR: { g: Game; list: ListKey; have: number; of: number }[] = [
    { g: G.outerWilds, list: 'completado', have: 30, of: 31 },
    { g: G.portal2, list: 'completado', have: 48, of: 51 },
]

const EASY: { name: string; game: string; pct: string }[] = [
    { name: 'Viajero intrépido', game: 'Hollow Knight', pct: '71,4 %' },
    { name: 'Cazador de cabezas', game: 'ELDEN RING', pct: '58,9 %' },
]

/** Mapa de actividad determinista (26 semanas × 7 días), con la racha al final. */
const HEAT = Array.from({ length: 26 * 7 }, (_, i) => {
    const x = Math.sin(i * 12.9898) * 43758.5453
    const r = x - Math.floor(x)
    const week = Math.floor(i / 7)
    const base = r < 0.38 ? 0 : r < 0.62 ? 1 : r < 0.82 ? 2 : r < 0.94 ? 3 : 4
    return i >= 26 * 7 - 7 ? Math.max(1, base) : week % 9 === 4 ? 0 : base
})

export const ACH_T = { unlock: 92 }

/** Resumen de logros: tiles, puntuación por rareza, tu año en un mapa con racha, cerca del 100 % y logros fáciles. */
export const AchievementsMock = ({ f }: { f: number }) => {
    const grow = ease(f, 14, 20)
    const weeks = (f - 10) / 1.1
    const unlocked = f >= ACH_T.unlock
    const toast = ease(f, ACH_T.unlock, 9)
    const flash = unlocked ? Math.max(0, 1 - (f - ACH_T.unlock) / 24) : 0
    const total = RARITIES.reduce((a, r) => a + r.pts, 0)
    return (
        <div style={{ padding: '24px 30px', display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', ...rise(f, 0) }}>
                <div>
                    <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>Logros</div>
                    <div style={{ color: C.muted, fontSize: 14.5, marginTop: 4 }}>1.873 logros desbloqueados en 86 juegos, 14 al 100 %.</div>
                </div>
                <span style={{ flex: 1 }} />
                <Button>
                    <History size={14} /> Ver historial
                </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, ...rise(f, 2) }}>
                {[
                    { Icon: Zap, color: C.primary, label: 'Puntos de cazador', value: count(f, 4, 11327, 16), note: <><b style={{ color: C.fg }}>+212</b> este mes</> },
                    { Icon: Award, color: C.st.sinfinal, label: 'Logros', value: count(f, 4, unlocked ? 1874 : 1873, 16), note: <>en 86 juegos · <b style={{ color: C.fg }}>+38</b> este mes</> },
                    { Icon: Flag, color: C.st.completado, label: 'Juegos al 100 %', value: unlocked ? '15' : count(f, 4, 14, 16), note: unlocked ? <>el último, <b style={{ color: C.fg }}>Outer Wilds</b></> : <>el último, <b style={{ color: C.fg }}>Celeste</b></> },
                    { Icon: Trophy, color: C.rar.leg, label: 'Tu logro más raro', value: <span style={{ color: rarInk(C.rar.leg) }}>0,4 % <span style={{ fontSize: 14, fontWeight: 600 }}>Legendaria</span></span>, note: <><b style={{ color: C.fg }}>Calor extremo</b> · Hades</> },
                ].map((t, i) => (
                    <div key={i} style={{ padding: 14, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, fontSize: 13 }}>
                            <IconBox Icon={t.Icon} color={t.color} size={24} icon={13} />
                            {t.label}
                        </div>
                        <div style={{ fontSize: 27, fontWeight: 700, marginTop: 6, whiteSpace: 'nowrap', scale: i === 2 && unlocked ? String(1 + Math.sin(Math.min(1, (f - ACH_T.unlock) / 9) * Math.PI) * 0.12) : undefined, transformOrigin: 'left center' }}>
                            {t.value}
                        </div>
                        <div style={{ color: C.muted, fontSize: 12.5, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.note}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
                <Panel style={{ padding: 16, ...rise(f, 5) }}>
                    <SectionHead Icon={Zap} color={C.primary} title="Puntuación de cazador" meta={`${nf(11327)} puntos`} />
                    <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.45, marginBottom: 12 }}>Cada logro vale más cuanto menos gente lo tiene: 3 puntos uno del 50 %, 20 uno del 1 %.</div>
                    <div style={{ display: 'flex', gap: 2, height: 10, borderRadius: 999, overflow: 'hidden', clipPath: `inset(0 ${(1 - grow) * 100}% 0 0)` }}>
                        {RARITIES.map((r) => (
                            <span key={r.k} style={{ flex: r.pts / total, background: C.rar[r.k] }} />
                        ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginTop: 12 }}>
                        {RARITIES.map((r, i) => {
                            const t = ease(f, 16 + i * 2, 10)
                            return (
                                <div key={r.k} style={{ padding: '8px 9px', borderRadius: 9, background: tint(C.rar[r.k], '9%'), borderTop: `3px solid ${C.rar[r.k]}`, opacity: t, translate: `0 ${(1 - t) * 8}px` }}>
                                    <div style={{ fontSize: 11.5, fontWeight: 600, color: rarInk(C.rar[r.k]), whiteSpace: 'nowrap' }}>{r.label}</div>
                                    <div style={{ fontSize: 19, fontWeight: 700, marginTop: 2 }}>{count(f, 16, r.n, 14)}</div>
                                    <div style={{ fontSize: 11, color: C.muted }}>{nf(r.pts)} pts</div>
                                    <div style={{ fontSize: 10.5, color: C.muted }}>{r.rule}</div>
                                </div>
                            )
                        })}
                    </div>
                </Panel>
                <Panel style={{ padding: 16, ...rise(f, 7) }}>
                    <SectionHead Icon={Sparkles} color={C.primary} title="Tu año" meta="1.873 logros" />
                    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                        <div style={{ flex: 1, padding: '8px 10px', borderRadius: 10, background: C.surface2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted }}>
                                <Flame size={13} color={C.primary} fill={f > 40 ? C.primary : 'none'} /> Racha actual
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 700, color: C.primary }}>
                                {count(f, 20, 7)} <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>días</span>
                            </div>
                        </div>
                        <div style={{ flex: 1, padding: '8px 10px', borderRadius: 10, background: C.surface2 }}>
                            <div style={{ fontSize: 12, color: C.muted }}>Mejor racha</div>
                            <div style={{ fontSize: 20, fontWeight: 700 }}>
                                {count(f, 20, 21)} <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>días · marzo</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(26, 1fr)', gridAutoFlow: 'column', gridTemplateRows: 'repeat(7, 1fr)', gap: 3 }}>
                        {HEAT.map((lv, i) => {
                            const w = Math.floor(i / 7)
                            const on = w < weeks
                            const streak = i >= HEAT.length - 7
                            const color = lv === 0 ? C.surface2 : `color-mix(in srgb, ${C.primary} ${[0, 30, 55, 78, 100][lv]}%, ${C.surface2})`
                            return (
                                <span
                                    key={i}
                                    style={{
                                        aspectRatio: '1',
                                        borderRadius: 3,
                                        background: on ? color : C.surface2,
                                        outline: streak && f > 50 ? `1.5px solid ${C.primary}` : undefined,
                                        outlineOffset: 1,
                                    }}
                                />
                            )
                        })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted, marginTop: 6 }}>
                        {['may', 'jun', 'jul', 'ago', 'sept', 'oct'].map((m) => (
                            <span key={m}>{m}</span>
                        ))}
                    </div>
                </Panel>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
                <div style={rise(f, 9)}>
                    <SectionHead Icon={Target} color={C.st.completado} title="Cerca del 100 %" meta="23" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {NEAR.map((n, i) => {
                            const done = i === 0 && unlocked
                            const have = done ? n.of : n.have
                            const t = ease(f, 14 + i * 2, 16)
                            return (
                                <div key={n.g.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px 8px 14px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                                    <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: LISTS[n.list].color }} />
                                    <Cover src={header(n.g)} style={{ width: 92, height: 43 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: 14.5 }}>{n.g.name}</div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, fontSize: 12.5 }}>
                                            <StatusChip list={n.list} size={11.5} />
                                            {done ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700, color: C.onDone, background: C.st.completado, padding: '1px 7px', borderRadius: 6, scale: String(pop(f, ACH_T.unlock + 4, 10)) }}>
                                                    <Check size={12} strokeWidth={3} /> 100 %
                                                </span>
                                            ) : (
                                                <span>Te {n.of - n.have === 1 ? 'falta' : 'faltan'} {n.of - n.have}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ width: 130 }}>
                                        <div style={{ display: 'flex', fontSize: 12, color: C.muted, marginBottom: 5 }}>
                                            <span>
                                                <b style={{ color: C.fg }}>{Math.round(have * t)}</b> / {n.of}
                                            </span>
                                            <span style={{ flex: 1 }} />
                                            {Math.round((100 * have * t) / n.of)} %
                                        </div>
                                        <Bar value={(have * t) / n.of} color={done ? C.success : C.primary} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div style={rise(f, 11)}>
                    <SectionHead Icon={Target} color={C.primary} title="Logros fáciles que te faltan" meta="47" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {EASY.map((e) => (
                            <div key={e.name} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px 9px 14px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: C.rar.comun }} />
                                <span style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 8, background: C.surface2, color: C.muted }}>
                                    <Lock size={16} />
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{e.name}</div>
                                    <div style={{ fontSize: 12.5, color: C.muted }}>{e.game}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{e.pct}</div>
                                    <div style={{ fontSize: 11.5, color: rarInk(C.rar.comun) }}>Común</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Logro épico desbloqueado: destello del color de su rareza */}
            {unlocked && (
                <div
                    style={{
                        position: 'absolute',
                        right: 30,
                        top: 24,
                        width: 380,
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        padding: 12,
                        borderRadius: 14,
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderLeft: `4px solid ${C.rar.epica}`,
                        boxShadow: `${C.shadowLg}, 0 0 0 ${lerp(0, 6, flash)}px ${tint(C.rar.epica, `${Math.round(flash * 30)}%`)}`,
                        opacity: toast,
                        translate: `0 ${(1 - toast) * -24}px`,
                        zIndex: 10,
                    }}
                >
                    <span style={{ display: 'grid', placeItems: 'center', width: 48, height: 48, borderRadius: 10, background: tint(C.rar.epica), color: rarInk(C.rar.epica), scale: String(lerp(0.6, 1, pop(f, ACH_T.unlock, 12))) }}>
                        <Trophy size={24} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Logro desbloqueado · Outer Wilds</div>
                        <div style={{ fontWeight: 700, fontSize: 15.5 }}>Arqueólogo</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 12.5, alignItems: 'center' }}>
                            <span style={{ color: rarInk(C.rar.epica), fontWeight: 700 }}>Épica · 4,1 %</span>
                            <span style={{ color: C.muted }}>+20 pts</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
