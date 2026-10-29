import { Check, Clock, Ellipsis, LayoutGrid, List, Undo2 } from 'lucide-react'
import { G, header, type Game } from '../data'
import { C, ease, lerp, mix, nf, pop, rise, tint } from '../theme'
import { Bar, Cover, Cursor, IconBox, LISTS, MarkFlag, Score, Seg, StatusChip, type ListKey } from '../ui/kit'
import { jump } from './count'

type RailItem = { key: ListKey | 'todos'; n: number } | { label: string }

const RAIL: RailItem[] = [
    { key: 'todos', n: 412 },
    { label: 'Estados' },
    { key: 'jugando', n: 6 },
    { key: 'pendiente', n: 37 },
    { key: 'pausado', n: 9 },
    { key: 'rejugable', n: 3 },
    { key: 'completado', n: 58 },
    { key: 'abandonado', n: 6 },
    { key: 'yajugado', n: 41 },
    { key: 'descartado', n: 12 },
    { key: 'otros', n: 5 },
    { label: 'Marcas' },
    { key: 'favorito', n: 11 },
    { key: 'sinfinal', n: 6 },
    { key: 'bandeja', n: 14 },
]

const ROWS: { g: Game; h: number; mc: number; ach: [number, number]; fav?: boolean; inf?: boolean }[] = [
    { g: G.balatro, h: 57, mc: 90, ach: [24, 30], inf: true },
    { g: G.hades, h: 22, mc: 93, ach: [31, 49] },
    { g: G.hollowKnight, h: 46, mc: 87, ach: [48, 63], fav: true },
    { g: G.silksong, h: 31, mc: 91, ach: [17, 47] },
    { g: G.eldenRing, h: 142, mc: 94, ach: [31, 42], fav: true },
    { g: G.bg3, h: 88, mc: 96, ach: [29, 54] },
]

/* Geometría (px dentro del contenido de la ventana), para el vuelo de la ficha y el cursor. */
const PAD_X = 30
const TOP = 112
const RAIL_W = 196
const ITEM_H = 34
const LABEL_H = 26
const MAIN_X = PAD_X + RAIL_W + 22
const ROWS_Y = TOP + 116
const ROW_H = 70
const ROW_GAP = 8
const MAIN_W = 972 - MAIN_X - PAD_X

const railY = (key: string) => {
    let y = TOP
    for (const it of RAIL) {
        if ('label' in it) y += LABEL_H
        else {
            if (it.key === key) return y
            y += ITEM_H + 2
        }
    }
    return y
}

/** Línea de tiempo (frames locales de la maqueta). */
export const LIB_T = { menuClick: 40, pick: 60, out: 66, land: 82, toast: 86 }
const T = LIB_T
const MOVED = 1 // Hades pasa de Jugando a Pausado

const MENU: ListKey[] = ['pendiente', 'jugando', 'pausado', 'rejugable', 'completado', 'abandonado']

/**
 * Biblioteca (lista «Jugando»): se abre el menú ··· de Hades y pasa a Pausado. La fila se tiñe del destino, sale y se
 * pliega, una ficha vuela al raíl, los contadores saltan y aparece «Deshacer».
 */
export const LibraryMock = ({ f, cursor = true }: { f: number; cursor?: boolean }) => {
    const menu = ease(f, T.menuClick + 2, 6) * (1 - ease(f, T.pick + 2, 5))
    const tintT = ease(f, T.pick, 6)
    const outT = ease(f, T.out, 8)
    const fold = ease(f, T.out + 6, 9)
    const fly = ease(f, T.out, T.land - T.out)
    const landed = jump(f, T.land)
    const toast = ease(f, T.toast, 9)

    const rowY = (i: number) => ROWS_Y + i * (ROW_H + ROW_GAP) - (i > MOVED ? fold * (ROW_H + ROW_GAP) : 0)
    const dotsX = MAIN_X + MAIN_W - 34
    const pickY = rowY(MOVED) + 60 + 6 + 26 + MENU.indexOf('pausado') * 30 + 15

    // Cursor: entra, pulsa ··· de Hades, baja a «Pausado» y pulsa
    const toDots = ease(f, 22, 16)
    const toPick = ease(f, T.menuClick + 6, 12)
    const cx = lerp(lerp(900, dotsX + 2, toDots), dotsX - 150, toPick)
    const cy = lerp(lerp(720, rowY(MOVED) + 30, toDots), pickY, toPick)
    const press = Math.max(0, 1 - Math.abs(f - T.menuClick) / 4) + Math.max(0, 1 - Math.abs(f - T.pick) / 4)

    // Ficha que vuela desde la fila hasta «Pausados» en el raíl
    const fromX = MAIN_X + 140
    const fromY = rowY(MOVED) + 26
    const toX = PAD_X + 40
    const toY = railY('pausado') + 6
    const fx = lerp(fromX, toX, fly)
    const fy = lerp(fromY, toY, fly) - Math.sin(fly * Math.PI) * 80

    const n = (key: string, base: number) => {
        if (key === 'jugando') return landed.changed ? base - 1 : base
        if (key === 'pausado') return landed.changed ? base + 1 : base
        return base
    }

    return (
        <div style={{ position: 'relative', height: '100%' }}>
            <div style={{ position: 'absolute', left: PAD_X, top: 26, right: PAD_X, display: 'flex', alignItems: 'flex-start', ...rise(f, 0) }}>
                <div>
                    <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>Biblioteca</div>
                    <div style={{ color: C.muted, fontSize: 14.5, marginTop: 4 }}>
                        412 juegos clasificados ·{' '}
                        <span style={{ display: 'inline-block', translate: `0 ${landed.changed ? landed.dy : 0}px` }}>{landed.changed ? 5 : 6}</span> en curso · 1 pendiente sin comprar
                    </div>
                </div>
            </div>

            {/* Raíl de listas */}
            <div style={{ position: 'absolute', left: PAD_X, top: TOP, width: RAIL_W, ...rise(f, 2) }}>
                {RAIL.map((it, k) => {
                    if ('label' in it)
                        return (
                            <div key={it.label} style={{ height: LABEL_H, display: 'flex', alignItems: 'flex-end', paddingBottom: 5, paddingLeft: 8, fontSize: 11.5, fontWeight: 600, color: C.muted }}>
                                {it.label}
                            </div>
                        )
                    const isTodos = it.key === 'todos'
                    const L = isTodos ? null : LISTS[it.key as ListKey]
                    const color = L ? L.color : C.primary
                    const on = it.key === 'jugando'
                    const hit = it.key === 'pausado' || it.key === 'jugando'
                    const sc = hit ? landed.scale : 1
                    const val = n(it.key, it.n)
                    return (
                        <div
                            key={k}
                            style={{
                                position: 'relative',
                                height: ITEM_H,
                                marginBottom: 2,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '0 10px 0 6px',
                                borderRadius: 8,
                                fontSize: 13.5,
                                fontWeight: on ? 600 : 500,
                                background: on ? C.surface : undefined,
                                border: it.key === 'bandeja' ? `1px dashed ${C.borderHover}` : on ? `1px solid ${C.border}` : '1px solid transparent',
                                boxShadow: on ? C.shadowSm : undefined,
                                marginTop: it.key === 'bandeja' ? 10 : 0,
                            }}
                        >
                            <IconBox Icon={L ? L.Icon : List} color={color} size={24} icon={13} dashed={it.key === 'bandeja'} />
                            {L ? L.plural : 'Todos'}
                            <span style={{ flex: 1 }} />
                            <span
                                style={{
                                    display: 'inline-block',
                                    fontSize: 12.5,
                                    fontWeight: 600,
                                    color: on ? color : C.muted,
                                    scale: String(sc),
                                    translate: `0 ${hit && landed.changed ? landed.dy : 0}px`,
                                }}
                            >
                                {nf(val)}
                            </span>
                        </div>
                    )
                })}
            </div>

            {/* Cabecera de la lista */}
            <div style={{ position: 'absolute', left: MAIN_X, top: TOP, width: MAIN_W, ...rise(f, 3) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <IconBox Icon={LISTS.jugando.Icon} color={C.st.jugando} size={38} icon={18} />
                    <div>
                        <div style={{ fontSize: 19, fontWeight: 700 }}>Jugando</div>
                        <div style={{ color: C.muted, fontSize: 13 }}>Lo que juegas ahora</div>
                    </div>
                    <span style={{ flex: 1 }} />
                    <Seg at={0} options={[<List key="l" size={15} />, <LayoutGrid key="g" size={15} />]} />
                </div>
                <div
                    style={{
                        marginTop: 14,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '9px 14px',
                        borderRadius: 10,
                        border: `1px solid ${C.border}`,
                        background: C.surface,
                        fontSize: 13.5,
                    }}
                >
                    <b style={{ display: 'inline-block', marginRight: 4, scale: String(landed.scale), translate: `0 ${landed.changed ? landed.dy : 0}px` }}>{landed.changed ? 5 : 6}</b>
                    de 6 juegos a la vez.
                    <span style={{ flex: 1 }} />
                    <span style={{ color: C.muted }}>
                        Límite: <b style={{ color: C.fg }}>6</b>
                    </span>
                </div>
            </div>

            {/* Filas */}
            {ROWS.map((r, i) => {
                const moving = i === MOVED
                if (moving && fold >= 1) return null
                const t = ease(f, 5 + i * 1, 10)
                const stripe = moving ? mix(C.st.jugando, C.st.pausado, tintT) : C.st.jugando
                const fill = ease(f, 8, 18)
                return (
                    <div
                        key={r.g.id}
                        style={{
                            position: 'absolute',
                            left: MAIN_X,
                            top: rowY(i),
                            width: MAIN_W,
                            height: ROW_H,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            padding: '0 12px 0 16px',
                            borderRadius: 10,
                            background: moving ? mix(C.surface, `color-mix(in srgb, ${C.st.pausado} var(--tint), ${C.surface})`, tintT) : C.surface,
                            border: `1px solid ${moving && f > T.menuClick - 2 && f < T.pick ? C.primary : C.border}`,
                            boxShadow: moving && f > T.menuClick - 2 && f < T.pick ? `0 0 0 3px ${C.primaryGlow}` : undefined,
                            overflow: 'hidden',
                            opacity: t * (moving ? 1 - outT : 1),
                            translate: `${moving ? outT * 60 : 0}px ${(1 - t) * 10}px`,
                        }}
                    >
                        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: stripe }} />
                        <Cover src={header(r.g)} style={{ width: 112, height: 52 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 15 }}>
                                {r.g.name}
                                {r.fav && <MarkFlag list="favorito" />}
                                {r.inf && <MarkFlag list="sinfinal" />}
                                {moving && f >= T.pick && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 6, scale: String(pop(f, T.pick, 8)), transformOrigin: 'left center' }}>
                                        <span style={{ color: C.muted, fontWeight: 500, fontSize: 13 }}>→</span>
                                        <StatusChip list="pausado" />
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, fontSize: 12.5, marginTop: 5 }}>
                                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                                    <Clock size={12} /> {r.h} h
                                </span>
                                <Score value={String(r.mc)} tier="top" />
                            </div>
                        </div>
                        <div style={{ width: 190 }}>
                            <div style={{ display: 'flex', fontSize: 12, color: C.muted, marginBottom: 6 }}>
                                <span>
                                    <b style={{ color: C.fg }}>{Math.round(r.ach[0] * fill)}</b> / {r.ach[1]} logros
                                </span>
                                <span style={{ flex: 1 }} />
                                {Math.round((100 * r.ach[0] * fill) / r.ach[1])} %
                            </div>
                            <Bar value={(fill * r.ach[0]) / r.ach[1]} />
                        </div>
                        <span
                            style={{
                                display: 'grid',
                                placeItems: 'center',
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                color: C.muted,
                                background: moving && menu > 0 ? C.surface2 : undefined,
                            }}
                        >
                            <Ellipsis size={18} />
                        </span>
                    </div>
                )
            })}

            {/* Menú de estado y marcas (GameMenu) */}
            {menu > 0 && (
                <div
                    style={{
                        position: 'absolute',
                        left: dotsX - 196,
                        top: rowY(MOVED) + 60,
                        width: 210,
                        padding: 6,
                        borderRadius: 12,
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        boxShadow: C.shadowLg,
                        opacity: menu,
                        scale: String(lerp(0.96, 1, menu)),
                        transformOrigin: 'top right',
                        zIndex: 20,
                    }}
                >
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: C.muted, padding: '4px 8px 6px' }}>Mover a</div>
                    {MENU.map((k) => {
                        const L = LISTS[k]
                        const hover = k === 'pausado' && toPick > 0.9
                        return (
                            <div
                                key={k}
                                style={{
                                    height: 30,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '0 8px',
                                    borderRadius: 7,
                                    fontSize: 13.5,
                                    background: hover ? tint(L.color) : undefined,
                                    color: hover ? L.color : C.fg,
                                    fontWeight: hover ? 600 : 500,
                                }}
                            >
                                <L.Icon size={14} color={L.color} strokeWidth={2.3} />
                                {L.label}
                                <span style={{ flex: 1 }} />
                                {k === 'jugando' && <Check size={14} color={C.muted} />}
                            </div>
                        )
                    })}
                    <div style={{ height: 1, background: C.border, margin: '5px 4px' }} />
                    {(['favorito', 'sinfinal'] as const).map((k) => (
                        <div key={k} style={{ height: 30, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', fontSize: 13.5 }}>
                            {(() => {
                                const L = LISTS[k]
                                return <L.Icon size={14} color={L.color} strokeWidth={2.3} />
                            })()}
                            {LISTS[k].label}
                        </div>
                    ))}
                </div>
            )}

            {/* Ficha que vuela al raíl */}
            {f >= T.out && f < T.land + 2 && (
                <div
                    style={{
                        position: 'absolute',
                        left: fx,
                        top: fy,
                        zIndex: 30,
                        opacity: 1 - ease(f, T.land - 2, 4),
                        scale: String(lerp(1.1, 0.8, fly)),
                        boxShadow: C.shadowLg,
                        borderRadius: 999,
                    }}
                >
                    <StatusChip list="pausado" size={13} style={{ background: `color-mix(in srgb, ${C.st.pausado} var(--tint), ${C.surface})` }} />
                </div>
            )}

            {/* Aviso con Deshacer */}
            {f >= T.toast && (
                <div
                    style={{
                        position: 'absolute',
                        left: MAIN_X + MAIN_W / 2,
                        bottom: 28,
                        translate: `-50% ${(1 - toast) * 30}px`,
                        opacity: toast,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 10px 9px 16px',
                        borderRadius: 12,
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        boxShadow: C.shadowLg,
                        fontSize: 14,
                        whiteSpace: 'nowrap',
                    }}
                >
                    <b>Hades</b>
                    <span style={{ color: C.muted }}>→</span>
                    <StatusChip list="pausado" />
                    <span style={{ width: 1, height: 20, background: C.border, margin: '0 4px' }} />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: C.primary, padding: '4px 8px', borderRadius: 7 }}>
                        <Undo2 size={14} /> Deshacer
                    </span>
                    <span style={{ fontSize: 11, color: C.muted, padding: '2px 6px', borderRadius: 4, background: C.surface2 }}>Ctrl + Z</span>
                </div>
            )}

            {cursor && <Cursor x={cx} y={cy} press={Math.min(1, press)} opacity={ease(f, 20, 6) * (1 - ease(f, T.pick + 8, 6))} />}
        </div>
    )
}
