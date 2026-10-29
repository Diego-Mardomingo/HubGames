import { ArrowLeft, Check, Clock, Lock, Search, SkipForward, Trophy, X } from 'lucide-react'
import { Img } from 'remotion'
import { hero } from '../data'
import { C, ease, lerp, pop, rise } from '../theme'
import { Panel, Score } from '../ui/kit'

type Result = 'fail' | 'skip' | 'hit'

/** Recortes de la misma imagen como las 6 capturas: cada fase enseña un poco más. */
const SHOTS = [
    { pos: '12% 62%', scale: 2.6 },
    { pos: '82% 30%', scale: 2.2 },
    { pos: '30% 80%', scale: 1.9 },
    { pos: '58% 42%', scale: 1.45 },
    { pos: '50% 50%', scale: 1.2 },
    { pos: '50% 50%', scale: 1 },
]

const HINTS = [
    { label: 'Géneros', value: 'Acción · Aventura · Indie' },
    { label: 'Pico de jugadores (Steam)', value: '73.892' },
    { label: 'Reseñas positivas (Steam)', value: '97 %', score: true },
    { label: 'Año de lanzamiento', value: '2017' },
    { label: 'Estudio', value: 'Team Cherry' },
]

/** Línea de tiempo: dos fallos y un salto; acierta en la fase 4. */
export const JUDI_T = { fail1: 26, skip: 46, fail2: 66, hit: 100 }
const T = JUDI_T

const ANSWER = 'Hollow Knight'

const resultsAt = (f: number): Result[] => {
    const r: Result[] = []
    if (f >= T.fail1) r.push('fail')
    if (f >= T.skip) r.push('skip')
    if (f >= T.fail2) r.push('fail')
    if (f >= T.hit) r.push('hit')
    return r
}

const RES = {
    fail: { color: C.danger, ink: C.dangerFg, Icon: X },
    skip: { color: C.surface3, ink: C.muted, Icon: SkipForward },
    hit: { color: C.success, ink: C.onDone, Icon: Check },
}

/** Intentos como pips (`AttemptPips`). */
export const AttemptPips = ({ results, size = 22 }: { results: Result[]; size?: number }) => (
    <div style={{ display: 'flex', gap: 5 }}>
        {Array.from({ length: 6 }).map((_, i) => {
            const r = results[i]
            const R = r ? RES[r] : null
            return (
                <span key={i} style={{ display: 'grid', placeItems: 'center', width: size, height: size, borderRadius: 5, background: R ? R.color : C.surface2, color: R ? R.ink : C.muted }}>
                    {R && <R.Icon size={size * 0.6} strokeWidth={3} />}
                </span>
            )
        })}
    </div>
)

/** JUDI: tira de capturas con el resultado de cada intento, pistas que se abren y acierto con confeti. */
export const JudiMock = ({ f }: { f: number }) => {
    const results = resultsAt(f)
    const phase = Math.min(5, results.length)
    const solved = f >= T.hit
    const shot = solved ? { pos: '50% 50%', scale: lerp(SHOTS[3].scale, 1, ease(f, T.hit, 18)) } : SHOTS[phase]
    const phaseIn = ease(f, [0, T.fail1, T.skip, T.fail2][phase] ?? 0, 8)
    const shake = (at: number) => (f >= at && f < at + 10 ? Math.sin((f - at) * 2.4) * (1 - (f - at) / 10) * 8 : 0)
    const typing = (start: number, text: string, end: number) => (f >= start && f < end ? text.slice(0, Math.max(0, Math.floor((f - start) / 1.3))) : null)
    const typed = typing(12, 'Dead Cells', T.fail1) ?? typing(52, 'Celeste', T.fail2) ?? typing(76, ANSWER, T.hit) ?? (solved ? ANSWER : '')
    const suggest = f >= 86 && f < T.hit
    const opened = solved ? 5 : phase
    const left = 6 - results.length
    const gone = ease(f, T.hit, 5)
    const win = ease(f, T.hit + 6, 9)
    return (
        <div style={{ padding: '22px 30px', display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...rise(f, 0) }}>
                <span style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface }}>
                    <ArrowLeft size={16} />
                </span>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em' }}>JUDI #812</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: C.primary, background: C.primaryGlow }}>
                            <Clock size={12} /> Juego de hoy
                        </span>
                    </div>
                    <div style={{ fontSize: 13, color: C.muted }}>miércoles, 28 de octubre de 2026</div>
                </div>
                <span style={{ flex: 1 }} />
                {solved ? (
                    <AttemptPips results={results} />
                ) : (
                    <span style={{ fontSize: 14, color: C.muted }}>
                        Quedan <b style={{ color: C.fg }}>{left}</b> intentos
                    </span>
                )}
            </div>

            <div style={{ display: 'flex', gap: 18, flex: 1, minHeight: 0 }}>
                <div style={{ width: 556, flex: 'none', ...rise(f, 2) }}>
                    <div style={{ position: 'relative', width: 556, height: 313, borderRadius: 14, overflow: 'hidden', background: '#000' }}>
                        <Img
                            src={hero(367520)}
                            style={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                objectPosition: shot.pos,
                                scale: String(shot.scale),
                                transformOrigin: shot.pos,
                                opacity: solved ? 1 : phaseIn,
                                translate: solved ? undefined : `${(1 - phaseIn) * 30}px 0`,
                            }}
                        />
                        <span style={{ position: 'absolute', left: 12, top: 12, padding: '4px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
                            {solved ? 'Hollow Knight' : `Captura ${phase + 1} de 6`}
                        </span>
                        {solved && <Confetti f={f - T.hit} />}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 7, marginTop: 9 }}>
                        {SHOTS.map((s, i) => {
                            const r = results[i]
                            const current = !solved && i === phase
                            const R = r ? RES[r] : null
                            const locked = !r && !current
                            const sh = i === 0 ? shake(T.fail1) : i === 2 ? shake(T.fail2) : 0
                            return (
                                <div
                                    key={i}
                                    style={{
                                        position: 'relative',
                                        height: 50,
                                        borderRadius: 8,
                                        overflow: 'hidden',
                                        border: locked ? `1.5px dashed ${C.borderHover}` : `2px solid ${current ? C.primary : R ? R.color : C.border}`,
                                        background: locked ? C.surface : '#000',
                                        translate: `${sh}px 0`,
                                    }}
                                >
                                    {!locked && <Img src={hero(367520)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: s.pos, scale: String(s.scale), transformOrigin: s.pos, opacity: r === 'skip' ? 0.5 : 1 }} />}
                                    {locked && (
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, color: C.muted, fontSize: 11 }}>
                                            <Lock size={12} /> Fase {i + 1}
                                        </div>
                                    )}
                                    {(R || current) && (
                                        <span
                                            style={{
                                                position: 'absolute',
                                                left: 4,
                                                top: 4,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 2,
                                                padding: '1px 5px',
                                                borderRadius: 5,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                background: R ? R.color : 'rgba(0,0,0,0.6)',
                                                color: R ? R.ink : '#fff',
                                                scale: r ? String(pop(f, [T.fail1, T.skip, T.fail2, T.hit][i] ?? 0, 8)) : undefined,
                                            }}
                                        >
                                            {R && <R.Icon size={10} strokeWidth={3} />} {i + 1}
                                        </span>
                                    )}
                                    {R && <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, background: R.color }} />}
                                </div>
                            )
                        })}
                    </div>
                    <div style={{ display: 'flex', fontSize: 12.5, color: C.muted, marginTop: 8 }}>
                        Intento <b style={{ color: C.fg, margin: '0 4px' }}>{Math.min(6, results.length + (solved ? 0 : 1))}</b> de 6
                    </div>
                </div>

                <Panel style={{ flex: 1, minWidth: 0, padding: 16, position: 'relative', overflow: 'hidden', ...rise(f, 4) }}>
                    {gone < 1 ? (
                        <div style={{ opacity: 1 - gone }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ fontWeight: 700, fontSize: 15.5 }}>¿Qué juego es?</span>
                                <span style={{ flex: 1 }} />
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: C.primary, background: C.primaryGlow }}>
                                    <Trophy size={11} /> +{6 - results.length} si aciertas
                                </span>
                            </div>
                            <div
                                style={{
                                    position: 'relative',
                                    marginTop: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    height: 40,
                                    padding: '0 12px',
                                    borderRadius: 8,
                                    border: `1px solid ${typed ? C.primary : C.border}`,
                                    boxShadow: typed ? `0 0 0 3px ${C.primaryGlow}` : undefined,
                                    fontSize: 14,
                                    translate: `${shake(T.fail1) + shake(T.fail2)}px 0`,
                                }}
                            >
                                <Search size={15} color={C.muted} />
                                <span style={{ color: typed ? C.fg : C.muted }}>{typed || 'Escribe el nombre del juego'}</span>
                            </div>
                            {suggest && (
                                <div style={{ marginTop: 4, padding: 4, borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, boxShadow: C.shadowLg, fontSize: 13.5 }}>
                                    <div style={{ padding: '6px 8px', borderRadius: 6, background: C.primaryGlow, color: C.primary, fontWeight: 600 }}>Hollow Knight</div>
                                    <div style={{ padding: '6px 8px', color: C.muted }}>Hollow Knight: Silksong</div>
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', marginTop: 8, fontSize: 12.5, color: C.muted }}>
                                Cada fallo o salto abre otra captura y una pista.
                                <span style={{ flex: 1 }} />
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: C.fg, scale: f >= T.skip - 3 && f < T.skip + 3 ? '0.94' : undefined }}>
                                    <SkipForward size={13} /> Saltar
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', marginTop: 14, marginBottom: 8 }}>
                                <span style={{ fontWeight: 700, fontSize: 14.5 }}>Pistas</span>
                                <span style={{ flex: 1 }} />
                                <span style={{ fontSize: 12.5, color: C.muted }}>{opened} de 5</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {HINTS.map((h, i) => {
                                    const open = i < opened
                                    const isNew = open && i === opened - 1 && !solved
                                    const at = [T.fail1, T.skip, T.fail2, T.hit, T.hit][i] ?? 0
                                    const t = open ? ease(f, at, 8) : 0
                                    return (
                                        <div
                                            key={h.label}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                                minHeight: 40,
                                                padding: '5px 10px',
                                                borderRadius: 8,
                                                border: open ? `1px solid ${isNew ? C.primary : C.border}` : `1px dashed ${C.border}`,
                                                background: isNew ? C.primaryGlow : open ? C.surface : 'transparent',
                                            }}
                                        >
                                            {!open && <Lock size={13} color={C.muted} />}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 11.5, color: C.muted }}>{h.label}</div>
                                                <div style={{ fontSize: 13.5, fontWeight: open ? 600 : 400, color: open ? C.fg : C.muted, opacity: open ? t : 1 }}>
                                                    {open ? h.score ? <Score value={h.value} tier="top" icon style={{ fontSize: 12.5 }} /> : h.value : `Se abre en la fase ${i + 2}`}
                                                </div>
                                            </div>
                                            {isNew && <span style={{ fontSize: 11, fontWeight: 700, color: C.primary }}>Nueva</span>}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : null}
                    {win > 0 && (
                        <div style={{ position: 'absolute', inset: 16, opacity: win, translate: `0 ${(1 - win) * 14}px` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 99, background: C.success, color: C.onDone, scale: String(pop(f, T.hit + 4, 10)) }}>
                                    <Check size={24} strokeWidth={3} />
                                </span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: 17 }}>¡Acertado en la fase 4!</div>
                                    <div style={{ fontSize: 13, color: C.muted }}>Tras 2 fallos y 1 salto</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 26, fontWeight: 800, color: C.primary }}>+3</div>
                                    <div style={{ fontSize: 11.5, color: C.muted }}>puntos</div>
                                </div>
                            </div>
                            <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: C.surface2 }}>
                                <div style={{ fontSize: 12, color: C.muted }}>Era</div>
                                <div style={{ fontWeight: 700, fontSize: 18 }}>Hollow Knight</div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, fontSize: 12.5, color: C.muted }}>
                                    <Score value="87" tier="top" /> Metacritic · Aclamado
                                </div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, fontSize: 12.5, color: C.muted }}>
                                    <Score value="97 %" tier="top" icon /> Extremadamente positivas
                                </div>
                            </div>
                            <div style={{ marginTop: 14, fontWeight: 700, fontSize: 14 }}>Tus intentos</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                                {[
                                    { r: 'fail' as const, t: 'Dead Cells' },
                                    { r: 'skip' as const, t: 'Saltado' },
                                    { r: 'fail' as const, t: 'Celeste' },
                                    { r: 'hit' as const, t: 'Hollow Knight' },
                                ].map((a, i) => {
                                    const R = RES[a.r]
                                    return (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: a.r === 'skip' ? C.muted : C.fg, fontWeight: a.r === 'hit' ? 700 : 500 }}>
                                            <span style={{ display: 'grid', placeItems: 'center', width: 18, height: 18, borderRadius: 4, background: R.color, color: R.ink }}>
                                                <R.Icon size={11} strokeWidth={3} />
                                            </span>
                                            {a.t}
                                        </div>
                                    )
                                })}
                            </div>
                            <div style={{ marginTop: 14, fontSize: 13, color: C.muted }}>Racha de 5 días · nuevo JUDI en 6 h 12 min</div>
                            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13.5 }}>
                                <span style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 99, border: `2px solid ${C.medal[1]}`, fontWeight: 700, fontSize: 12, color: C.fg }}>2</span>
                                Vas <b>2.º</b> en el ranking
                            </div>
                        </div>
                    )}
                </Panel>
            </div>
        </div>
    )
}

/** Confeti determinista (como el de JUDI en la app). */
export const Confetti = ({ f, count = 50, originX = 50, originY = 60 }: { f: number; count?: number; originX?: number; originY?: number }) => {
    const colors = [C.primary, C.success, C.deal, C.st.favorito, C.st.pendiente, C.rar.epica]
    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {Array.from({ length: count }).map((_, i) => {
                const a = ((i * 137.5) % 360) * (Math.PI / 180)
                const v = 7 + ((i * 53) % 8)
                const t = f
                const x = Math.cos(a) * v * t * 1.5
                const y = Math.sin(a) * v * t * 0.9 - 5 * t + 0.3 * t * t
                return (
                    <span
                        key={i}
                        style={{
                            position: 'absolute',
                            left: `${originX}%`,
                            top: `${originY}%`,
                            width: 7,
                            height: 11,
                            borderRadius: 2,
                            background: colors[i % colors.length],
                            translate: `${x}px ${y}px`,
                            rotate: `${i * 40 + t * (8 + (i % 5) * 4)}deg`,
                            opacity: Math.max(0, 1 - t / 40),
                        }}
                    />
                )
            })}
        </div>
    )
}

