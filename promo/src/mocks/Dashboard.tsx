import { Calendar, Check, Clock, Dices, Hourglass, Play, RefreshCw, Shuffle, Target } from 'lucide-react'
import { G, USER, header, type Game } from '../data'
import { C, ease, rise, tint } from '../theme'
import { Bar, Button, Cover, LISTS, Panel, Row, Score, SectionHead, Seg, StatusChip, type ListKey } from '../ui/kit'
import { count } from './count'

const CHIPS: { list: ListKey; n: number; of?: number }[] = [
    { list: 'jugando', n: 5, of: 6 },
    { list: 'pendiente', n: 37 },
    { list: 'pausado', n: 9 },
    { list: 'completado', n: 58 },
    { list: 'bandeja', n: 14 },
]

const PLAYING: { g: Game; h: number; when: string; left: string; ach: [number, number] }[] = [
    { g: G.silksong, h: 31, when: 'ayer', left: 'faltan ~9 h', ach: [24, 47] },
    { g: G.bg3, h: 88, when: 'hoy', left: 'historia al 75 %', ach: [31, 54] },
    { g: G.balatro, h: 42, when: 'hace 2 días', left: 'sin final', ach: [18, 30] },
]

type Pick = { g: Game; list: ListKey; reason: string; extra: string; hltb: string; mc: string; rev: string }

const PICKS_A: Pick[] = [
    { g: G.silksong, list: 'jugando', reason: 'Te faltan ~9 h para la historia', extra: 'Lo jugaste ayer', hltb: '40 h', mc: '91', rev: '93 %' },
    { g: G.celeste, list: 'pendiente', reason: 'Es corto: ~8 h en total', extra: 'Primero de tu cola', hltb: '8 h', mc: '92', rev: '97 %' },
]
const PICKS_B: Pick[] = [
    { g: G.outerWilds, list: 'pendiente', reason: 'Empezar algo nuevo: ~17 h', extra: 'Lo tienes desde 2022', hltb: '17 h', mc: '85', rev: '95 %' },
    { g: G.disco, list: 'pendiente', reason: 'Lo añadiste hace un año', extra: 'Muy bien valorado', hltb: '24 h', mc: '91', rev: '92 %' },
]

const PickRow = ({ p, f, i, inAt }: { p: Pick; f: number; i: number; inAt: number }) => {
    const t = ease(f, inAt + i * 3, 9)
    return (
        <Row color={LISTS[p.list].color} style={{ padding: '10px 14px 10px 16px', opacity: t, translate: `0 ${(1 - t) * 10}px` }}>
            <Cover src={header(p.g)} style={{ width: 112, height: 52 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{p.g.name}</div>
                <div style={{ fontSize: 13, marginTop: 2 }}>
                    {p.reason} <span style={{ color: C.muted, marginLeft: 6 }}>{p.extra}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, fontSize: 12.5, color: C.muted }}>
                    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                        <Hourglass size={12} /> {p.hltb}
                    </span>
                    <Score value={p.mc} tier="top" />
                    <Score value={p.rev} tier="top" icon />
                </div>
            </div>
            <StatusChip list={p.list} />
            <Button variant="primary" style={{ height: 32 }}>
                <Play size={14} /> Jugar
            </Button>
            <Button style={{ height: 32 }}>
                <RefreshCw size={13} /> Otra
            </Button>
        </Row>
    )
}

/** Inicio: chips de listas, En curso, metas del mes y «¿Qué juego hoy?» con el segmentado que se desliza. */
export const DashboardMock = ({ f }: { f: number }) => {
    const time = 0 + ease(f, 46, 7)
    const want = 0 + ease(f, 70, 7)
    const swapped = f >= 78
    const out = swapped ? 1 : 1 - ease(f, 72, 5)
    return (
        <div style={{ padding: '26px 30px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', ...rise(f, 0) }}>
                <div>
                    <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>Hola, {USER}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.muted, fontSize: 14, marginTop: 4 }}>
                        <Check size={14} color={C.success} strokeWidth={2.6} /> Sincronizado con Steam hace 2 h
                    </div>
                </div>
                <span style={{ flex: 1 }} />
                <Button variant="primary">
                    <RefreshCw size={14} /> Sincronizar
                </Button>
            </div>

            <div style={{ display: 'flex', gap: 8, ...rise(f, 2) }}>
                {CHIPS.map(({ list, n, of }) => {
                    const L = LISTS[list]
                    return (
                        <div
                            key={list}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '4px 12px 4px 4px',
                                borderRadius: 999,
                                background: C.surface,
                                border: `1px ${list === 'bandeja' ? 'dashed' : 'solid'} ${list === 'bandeja' ? L.color : C.border}`,
                                fontSize: 13.5,
                                fontWeight: 500,
                            }}
                        >
                            <span style={{ display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: 999, background: tint(L.color), color: L.color }}>
                                <L.Icon size={12} strokeWidth={2.4} />
                            </span>
                            {L.label}
                            <b style={{ color: L.color }}>
                                {count(f, 4, n)}
                                {of ? `/${of}` : ''}
                            </b>
                        </div>
                    )
                })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 16 }}>
                <div style={rise(f, 6)}>
                    <SectionHead Icon={LISTS.jugando.Icon} color={C.st.jugando} title="En curso" meta="5 de 6 a la vez" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {PLAYING.map((p, i) => {
                            const fill = ease(f, 10 + i * 2, 16)
                            return (
                                <Row key={p.g.id} color={C.st.jugando} style={{ padding: '8px 12px 8px 14px', gap: 12 }}>
                                    <Cover src={header(p.g)} style={{ width: 96, height: 45 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.g.name}</div>
                                        <div style={{ display: 'flex', gap: 10, color: C.muted, fontSize: 12.5, marginTop: 3 }}>
                                            <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                                                <Clock size={12} /> {p.h} h
                                            </span>
                                            <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                                                <Calendar size={12} /> {p.when}
                                            </span>
                                            <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', color: C.fg }}>
                                                <Hourglass size={12} /> {p.left}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ width: 150 }}>
                                        <div style={{ display: 'flex', fontSize: 12, color: C.muted, marginBottom: 5 }}>
                                            <span>
                                                <b style={{ color: C.fg }}>{Math.round(p.ach[0] * fill)}</b> / {p.ach[1]} logros
                                            </span>
                                            <span style={{ flex: 1 }} />
                                            {Math.round((100 * p.ach[0] * fill) / p.ach[1])} %
                                        </div>
                                        <Bar value={(fill * p.ach[0]) / p.ach[1]} />
                                    </div>
                                </Row>
                            )
                        })}
                    </div>
                </div>
                <Panel style={{ padding: 16, ...rise(f, 9) }}>
                    <SectionHead Icon={Target} color={C.primary} title="Metas de octubre" />
                    {[
                        { label: 'Completar 3 juegos', v: 2, of: 3 },
                        { label: 'Desbloquear 40 logros', v: 34, of: 40 },
                        { label: '1 juego al 100 %', v: 1, of: 1 },
                    ].map((m, i) => {
                        const t = ease(f, 14 + i * 3, 16)
                        const done = m.v === m.of
                        return (
                            <div key={m.label} style={{ marginTop: i ? 14 : 4 }}>
                                <div style={{ display: 'flex', fontSize: 13.5, marginBottom: 6, alignItems: 'center' }}>
                                    <span>{m.label}</span>
                                    <span style={{ flex: 1 }} />
                                    {done && t > 0.95 ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: C.success, fontWeight: 700, fontSize: 12.5 }}>
                                            <Check size={13} strokeWidth={2.8} /> Hecho
                                        </span>
                                    ) : (
                                        <span style={{ color: C.muted, fontSize: 12.5 }}>
                                            <b style={{ color: C.fg }}>{Math.round(m.v * t)}</b> / {m.of}
                                        </span>
                                    )}
                                </div>
                                <Bar value={(m.v / m.of) * t} color={done ? C.success : C.primary} />
                            </div>
                        )
                    })}
                </Panel>
            </div>

            <Panel style={{ padding: 16, ...rise(f, 12) }}>
                <SectionHead
                    Icon={Dices}
                    color={C.primary}
                    title="¿Qué juego hoy?"
                    meta="De tus Jugando y Pendientes"
                    right={
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.muted, fontSize: 13, fontWeight: 600 }}>
                            <Shuffle size={14} /> Barajar
                        </span>
                    }
                />
                <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 12, fontSize: 13, color: C.muted }}>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        Tiempo <Seg at={time} options={['Menos de 1 h', '1-3 h', 'Sesión larga']} />
                    </span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        Ganas <Seg at={want} options={['Terminar algo', 'Empezar algo nuevo', 'Cazar logros', 'Sorpréndeme']} />
                    </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: out }}>
                    {(swapped ? PICKS_B : PICKS_A).map((p, i) => (
                        <PickRow key={p.g.id} p={p} f={f} i={i} inAt={swapped ? 78 : 14} />
                    ))}
                </div>
            </Panel>
        </div>
    )
}
