import { Bookmark, Clock, Ellipsis, Gamepad2, Hourglass, TrendingDown } from 'lucide-react'
import { G, header, type Game } from '../data'
import { C, ease, tint } from '../theme'
import { Bar, Cover, LISTS, MarkFlag, Score, type ListKey } from '../ui/kit'
import { LogoMark } from '../ui/Logo'

const STRIP: { k: ListKey; n: number }[] = [
    { k: 'jugando', n: 5 },
    { k: 'pendiente', n: 37 },
    { k: 'pausado', n: 10 },
    { k: 'completado', n: 58 },
]

const ROWS: { g: Game; list: ListKey; h: number; mc: number; ach: [number, number]; fav?: boolean }[] = [
    { g: G.balatro, list: 'jugando', h: 57, mc: 90, ach: [24, 30] },
    { g: G.hollowKnight, list: 'jugando', h: 46, mc: 87, ach: [48, 63], fav: true },
    { g: G.silksong, list: 'jugando', h: 31, mc: 91, ach: [17, 47] },
]

/** Biblioteca a 390 px: tira de listas con el indicador tintado de la activa y filas compactas. */
export const LibraryMobile = ({ f = 400 }: { f?: number }) => (
    <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Biblioteca</div>
            <div style={{ color: C.muted, fontSize: 13.5, marginTop: 2 }}>412 juegos · 5 en curso</div>
        </div>
        <div style={{ display: 'flex', gap: 6, overflow: 'hidden' }}>
            {STRIP.map(({ k, n }) => {
                const L = LISTS[k]
                const on = k === 'jugando'
                return (
                    <span
                        key={k}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            height: 36,
                            padding: '0 11px',
                            borderRadius: 999,
                            fontSize: 13.5,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            flex: 'none',
                            color: on ? L.color : C.fg,
                            background: on ? tint(L.color) : C.surface,
                            border: `1px solid ${on ? L.color : C.border}`,
                        }}
                    >
                        <L.Icon size={14} color={L.color} strokeWidth={2.3} /> {L.plural} <span style={{ color: on ? L.color : C.muted }}>{n}</span>
                    </span>
                )
            })}
        </div>
        <div style={{ fontSize: 13, color: C.muted }}>
            <b style={{ color: C.fg }}>5</b> de 6 juegos a la vez
        </div>
        {ROWS.map((r, i) => {
            const t = ease(f, 4 + i * 2, 16)
            return (
                <div key={r.g.id} style={{ position: 'relative', padding: '10px 10px 10px 14px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                    <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: LISTS[r.list].color }} />
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <Cover src={header(r.g)} style={{ width: 96, height: 45 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, fontSize: 14.5 }}>
                                {r.g.name} {r.fav && <MarkFlag list="favorito" />}
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: C.muted, fontSize: 12.5, marginTop: 4 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <Clock size={12} /> {r.h} h
                                </span>
                                <Score value={String(r.mc)} tier="top" />
                            </div>
                        </div>
                        <Ellipsis size={18} color={C.muted} />
                    </div>
                    <div style={{ display: 'flex', fontSize: 12, color: C.muted, margin: '9px 0 5px' }}>
                        <span>
                            <b style={{ color: C.fg }}>{Math.round(r.ach[0] * t)}</b> / {r.ach[1]} logros
                        </span>
                        <span style={{ flex: 1 }} />
                        {Math.round((100 * r.ach[0] * t) / r.ach[1])} %
                    </div>
                    <Bar value={(r.ach[0] * t) / r.ach[1]} />
                </div>
            )
        })}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 6, background: tint(C.st.pendiente), color: C.st.pendiente }}>
                <Bookmark size={14} strokeWidth={2.3} />
            </span>
            <b style={{ fontSize: 15 }}>Siguientes en la cola</b>
            <span style={{ color: C.muted, fontSize: 12.5 }}>37</span>
        </div>
        {[G.celeste, G.outerWilds].map((g, i) => (
            <div key={g.id} style={{ position: 'relative', display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px 8px 14px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: C.st.pendiente }} />
                <span style={{ width: 16, fontWeight: 700, color: C.muted, fontSize: 13 }}>{i + 1}</span>
                <Cover src={header(g)} style={{ width: 80, height: 37 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: C.muted, fontSize: 12, marginTop: 2 }}>
                        <Hourglass size={11} /> {i ? '17 h' : '8 h'} <Score value={i ? '85' : '92'} tier="top" />
                    </div>
                </div>
            </div>
        ))}
    </div>
)

/** Notificación push de HubGames (en la pantalla de bloqueo del móvil). */
export const PushCard = ({ title, body, icon, when = 'ahora', style }: { title: string; body: string; icon?: 'deal' | 'judi'; when?: string; style?: React.CSSProperties }) => (
    <div
        style={{
            display: 'flex',
            gap: 11,
            padding: '12px 13px',
            borderRadius: 20,
            background: 'rgba(40,44,54,0.92)',
            color: '#e8eaee',
            boxShadow: '0 20px 40px -16px rgba(0,0,0,0.6)',
            ...style,
        }}
    >
        <span style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 10, background: '#15171c', flex: 'none' }}>
            <LogoMark size={13} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', fontSize: 12.5, color: '#9aa1ae' }}>
                <b style={{ color: '#e8eaee', fontWeight: 600 }}>HubGames</b>
                <span style={{ flex: 1 }} />
                {when}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 14, marginTop: 1 }}>
                {icon === 'deal' && <TrendingDown size={14} color="#ffd43b" />}
                {icon === 'judi' && <Gamepad2 size={14} color="#7b9bff" />}
                {title}
            </div>
            <div style={{ fontSize: 13, color: '#c9ced6', marginTop: 1 }}>{body}</div>
        </div>
    </div>
)

/** Pantalla de bloqueo con los avisos de precio y del JUDI del día. `t1`, `t2`: 0→1 de cada aviso. */
export const LockScreen = ({ t1 = 1, t2 = 1 }: { t1?: number; t2?: number }) => (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #1b2236 0%, #15171c 70%)', color: '#e8eaee' }}>
        <div style={{ textAlign: 'center', marginTop: 40, fontSize: 17, fontWeight: 500, color: '#c9ced6' }}>miércoles, 28 de octubre</div>
        <div style={{ textAlign: 'center', fontSize: 84, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05 }}>21:30</div>
        <div style={{ position: 'absolute', left: 12, right: 12, top: 250, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <PushCard
                icon="deal"
                title="ELDEN RING, en su mínimo histórico"
                body="23,99 € en Steam (-60 %). Cumple tu aviso."
                style={{ opacity: t1, translate: `0 ${(1 - t1) * -40}px`, scale: String(0.94 + 0.06 * t1) }}
            />
            <PushCard
                icon="judi"
                title="Ya está el JUDI #812"
                body="¿Qué juego es hoy? Tu racha va por 5 días."
                when="hace 2 h"
                style={{ opacity: t2, translate: `0 ${(1 - t2) * -40}px`, scale: String(0.94 + 0.06 * t2) }}
            />
        </div>
    </div>
)
