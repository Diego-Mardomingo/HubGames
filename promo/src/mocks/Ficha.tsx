import { ArrowLeft, Calendar, Clock, ExternalLink, Flag, Hourglass, Play, Star, ThumbsUp, Trophy } from 'lucide-react'
import { Img } from 'remotion'
import { hero } from '../data'
import { C, ease, pop, rise, tint } from '../theme'
import { Bar, Button, LISTS, Panel, Score, Tile, type ListKey } from '../ui/kit'
import { count } from './count'

const GRID: ListKey[] = ['bandeja', 'pendiente', 'jugando', 'pausado', 'rejugable', 'completado', 'abandonado', 'yajugado', 'descartado', 'otros']

const MetaChip = ({ children }: { children: React.ReactNode }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, fontSize: 13, color: C.muted, whiteSpace: 'nowrap' }}>
        {children}
    </span>
)

/** Ficha de un juego: arte grande, acciones, selector de estado, marcas, tiles que cuentan y objetivo con HowLongToBeat. */
export const FichaMock = ({ f, compact = false }: { f: number; compact?: boolean }) => {
    const fav = f >= 46
    const beat = fav ? pop(f, 46, 10) : 1
    const fill = ease(f, 10, 22)
    const hours = 31
    const goals = [
        { label: 'Historia', h: 40 },
        { label: 'Extras', h: 58 },
        { label: '100 %', h: 80 },
    ]
    const max = 80
    return (
        <div style={{ padding: '22px 30px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.muted, fontSize: 13.5, ...rise(f, 0) }}>
                <ArrowLeft size={14} /> Biblioteca
            </div>
            <div style={{ display: 'flex', gap: 22, ...rise(f, 1) }}>
                <Img src={hero(1030300)} style={{ width: compact ? 400 : 470, height: compact ? 170 : 196, objectFit: 'cover', borderRadius: 14, flex: 'none' }} />
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>Hollow Knight: Silksong</div>
                    <div style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>Team Cherry</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                        <Button variant="primary">
                            <Play size={14} /> Jugar
                        </Button>
                        <Button>
                            <Flag size={14} /> Completar
                        </Button>
                        <Button>
                            <ExternalLink size={14} /> Ver en Steam
                        </Button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                        <MetaChip>
                            <Score value="91" tier="top" /> <b style={{ color: C.fg }}>Metacritic</b> · Aclamado
                        </MetaChip>
                        <MetaChip>
                            <ThumbsUp size={13} color={C.sc.top} /> <b style={{ color: C.fg }}>93 %</b> · Muy positivas
                        </MetaChip>
                        <MetaChip>
                            <Hourglass size={13} /> Historia <b style={{ color: C.fg }}>40 h</b>
                        </MetaChip>
                    </div>
                </div>
            </div>

            <Panel style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, ...rise(f, 3) }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, padding: 3, borderRadius: 10, background: C.surface2 }}>
                    {GRID.map((k) => {
                        const L = LISTS[k]
                        const on = k === 'jugando'
                        return (
                            <div
                                key={k}
                                style={{
                                    height: 32,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    borderRadius: 7,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: on ? L.color : C.muted,
                                    background: on ? C.surface : undefined,
                                    border: on ? `1.5px solid ${L.color}` : '1.5px solid transparent',
                                }}
                            >
                                <L.Icon size={13} color={L.color} strokeWidth={2.3} /> {L.label}
                            </div>
                        )
                    })}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {(['favorito', 'sinfinal'] as const).map((k) => {
                        const L = LISTS[k]
                        const on = k === 'favorito' && fav
                        return (
                            <span
                                key={k}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    height: 32,
                                    padding: '0 12px',
                                    borderRadius: 8,
                                    fontSize: 13.5,
                                    fontWeight: 600,
                                    color: on ? L.color : C.fg,
                                    background: on ? tint(L.color) : C.surface,
                                    border: `1px solid ${on ? L.color : C.border}`,
                                }}
                            >
                                <L.Icon size={14} color={L.color} fill={on ? L.color : 'none'} strokeWidth={2.3} style={{ scale: String(on ? 1 + Math.sin(Math.min(1, beat) * Math.PI) * 0.4 : 1) }} />
                                {L.label}
                            </span>
                        )
                    })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    <Tile Icon={Clock} color={C.st.jugando} label="Horas" value={`${count(f, 6, hours)} h`} note="6,5 h esta semana" />
                    <Tile Icon={Calendar} color={C.st.pendiente} label="Última partida" value="ayer" note="Jugando desde el 4 sept" />
                    <Tile Icon={Star} color={C.sc.top} label="Tu nota" value="—" note="Se pone al completarlo" />
                    <Tile Icon={Trophy} color={C.st.sinfinal} label="Logros" value={<>{count(f, 6, 24)}<span style={{ fontSize: 16, color: C.muted }}> /47</span></>} note="51 %" />
                </div>
                <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 14, marginBottom: 10 }}>
                        <b>Objetivo: historia</b>
                        <span style={{ color: C.muted }}>te faltan ~9 h</span>
                        <span style={{ flex: 1 }} />
                        <span style={{ color: C.muted, fontSize: 12.5 }}>HowLongToBeat</span>
                    </div>
                    <div style={{ position: 'relative', height: 30 }}>
                        <Bar value={(fill * hours) / max} height={8} style={{ position: 'absolute', left: 0, right: 0, top: 0 }} />
                        {goals.map((g) => {
                            const reached = (fill * hours) / max >= g.h / max
                            const isTarget = g.label === 'Historia'
                            const last = g.h === max
                            return (
                                <div key={g.label} style={{ position: 'absolute', left: `${(g.h / max) * 100}%`, top: -3, translate: last ? '-100% 0' : '-50% 0', display: 'flex', flexDirection: 'column', alignItems: last ? 'flex-end' : 'center' }}>
                                    <span style={{ width: 3, height: 14, borderRadius: 2, background: reached ? C.primary : isTarget ? C.fg : C.borderHover }} />
                                    <span style={{ fontSize: 11.5, color: isTarget ? C.fg : C.muted, fontWeight: isTarget ? 700 : 500, marginTop: 3, whiteSpace: 'nowrap' }}>
                                        {g.label} {g.h} h
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </Panel>
        </div>
    )
}
