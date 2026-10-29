import { Bell, BellRing, Calendar, Check, ExternalLink, Hourglass, Percent, Search, TrendingDown, TriangleAlert } from 'lucide-react'
import { G, header, type Game } from '../data'
import { C, ease, lerp, mix, nf, pop, rise, tint } from '../theme'
import { Button, Cover, Deal, Score, Seg, StatusChip, Tinted, type ListKey } from '../ui/kit'
import { jump } from './count'

type Row = {
    g: Game
    from: number
    price: number
    min: number
    lowest?: number
    hltb: number
    mc: number
    rev: number
    revLabel: string
    list?: ListKey
    alert?: string
    since: string
}

const ROWS: Row[] = [
    { g: G.eldenRing, from: 59.99, price: 23.99, min: 23.99, hltb: 59, mc: 94, rev: 92, revLabel: 'Muy positivas', alert: 'Aviso si baja de 25,00 €', since: 'Wishlist de Steam · 3 mar 2023' },
    { g: G.rdr2, from: 59.99, price: 14.99, min: 14.99, hltb: 50, mc: 93, rev: 92, revLabel: 'Muy positivas', since: 'Wishlist de Steam · 20 dic 2023' },
    { g: G.liesOfP, from: 59.99, price: 35.99, min: 29.99, hltb: 34, mc: 80, rev: 89, revLabel: 'Muy positivas', list: 'pendiente', since: 'Añadido en HubGames · 30 sept 2026' },
    { g: G.cyberpunk, from: 59.99, price: 20.99, min: 17.99, hltb: 25, mc: 86, rev: 82, revLabel: 'Muy positivas', since: 'Wishlist de Steam · 2 nov 2024' },
    { g: G.itTakesTwo, from: 39.99, price: 39.99, min: 7.99, hltb: 13, mc: 88, rev: 95, revLabel: 'Extremadamente positivas', alert: 'Aviso con -70 % o más', since: 'Wishlist de Steam · 14 feb 2025' },
    { g: G.sekiro, from: 59.99, price: 59.99, min: 23.99, hltb: 30, mc: 90, rev: 95, revLabel: 'Extremadamente positivas', since: 'Wishlist de Steam · 1 abr 2022' },
]

const perHour = (p: number, h: number) => p / h
const hourTier = (v: number) => (v <= 1 ? 'top' : v <= 2 ? 'good' : v <= 4 ? 'mid' : 'bad') as 'top' | 'good' | 'mid' | 'bad'

export const WISH_T = { drop: 34, hit: 52 }

/** Wishlist: filtros con color y contador, filas con veredicto de precio, regla mínimo–normal y avisos. */
export const WishlistMock = ({ f, rows = 6 }: { f: number; rows?: number }) => {
    const drop = ease(f, WISH_T.drop, 18)
    const hit = f >= WISH_T.hit
    const flash = hit ? Math.max(0, 1 - (f - WISH_T.hit) / 18) : 0
    const counter = jump(f, WISH_T.hit)
    const bell = hit ? Math.sin((f - WISH_T.hit) * 0.9) * 18 * Math.max(0, 1 - (f - WISH_T.hit) / 24) : 0
    return (
        <div style={{ padding: '24px 30px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', ...rise(f, 0) }}>
                <div>
                    <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>Wishlist</div>
                    <div style={{ color: C.muted, fontSize: 14.5, marginTop: 4 }}>
                        13 juegos · <b style={{ color: C.fg }}>{hit ? 4 : 3} en mínimo histórico</b> · 8 en oferta. Precios del 28 oct 2026.
                    </div>
                </div>
                <span style={{ flex: 1 }} />
                <Button>
                    <Search size={14} /> Añadir un juego
                </Button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', ...rise(f, 2) }}>
                <Seg
                    at={0}
                    options={[
                        <>Todos <CountPill c={C.muted}>13</CountPill></>,
                        <>
                            <TrendingDown size={14} color={C.dealFg} style={{ background: C.deal, borderRadius: 4, padding: 1 }} /> En mínimo histórico{' '}
                            <span style={{ display: 'inline-block', scale: String(counter.scale) }}>
                                <CountPill c={C.dealFg} bg={C.deal}>
                                    {hit ? 4 : 3}
                                </CountPill>
                            </span>
                        </>,
                        <>
                            <Percent size={13} color={C.sc.top} /> En oferta <CountPill c={C.sc.top}>8</CountPill>
                        </>,
                        <>
                            <Bell size={13} color={C.primary} /> Con aviso <CountPill c={C.primary}>3</CountPill>
                        </>,
                        <>
                            <Calendar size={13} /> Próximamente <CountPill c={C.muted}>1</CountPill>
                        </>,
                    ]}
                />
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 13, color: C.muted }}>
                    Ordenar <b style={{ color: C.fg, marginLeft: 6 }}>Mayor descuento</b>
                </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {ROWS.slice(0, rows).map((r, i) => {
                    const first = i === 0
                    const price = first ? lerp(r.from, r.price, drop) : r.price
                    const disc = Math.round((1 - price / r.from) * 100)
                    const atMin = first ? hit : price <= r.min + 0.001
                    const cheaper = !atMin && price < r.from
                    const stripe = atMin ? C.deal : cheaper ? C.sc.mid : 'transparent'
                    const pos = (price - r.min) / (r.from - r.min)
                    const eph = perHour(price, r.hltb)
                    const t = ease(f, 4 + i, 10)
                    return (
                        <div
                            key={r.g.id}
                            style={{
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 14,
                                padding: '9px 12px 9px 16px',
                                borderRadius: 10,
                                background: C.surface,
                                border: `1px solid ${C.border}`,
                                overflow: 'hidden',
                                opacity: t,
                                translate: `0 ${(1 - t) * 10}px`,
                                boxShadow: first && flash > 0 ? `0 0 0 ${3 * flash}px ${tint(C.deal, `${Math.round(60 * flash)}%`)}` : undefined,
                            }}
                        >
                            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: first ? mix(C.sc.mid, C.deal, hit ? 1 : 0) : stripe, opacity: first && !hit && disc === 0 ? 0 : 1 }} />
                            <Cover src={header(r.g)} style={{ width: 112, height: 52 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 15 }}>
                                    {r.g.name}
                                    {r.list && <StatusChip list={r.list} size={11.5} />}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4, fontSize: 12.5, color: C.muted }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                        <Hourglass size={12} /> {r.hltb} h
                                    </span>
                                    <span style={{ fontWeight: 700, color: C.fg, fontSize: 11.5 }}>Metacritic</span>
                                    <Score value={String(r.mc)} tier={r.mc >= 75 ? 'top' : 'mid'} />
                                    <Score value={`${r.rev} %`} tier="top" icon />
                                    <Tinted color={C.sc[hourTier(eph)]}>{nf(eph, 2)} €/h</Tinted>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 12, color: C.muted }}>
                                    {r.since}
                                    {r.alert &&
                                        (first && hit ? (
                                            <Tinted color={C.success} style={{ fontSize: 11.5, scale: String(pop(f, WISH_T.hit + 2, 10)) }}>
                                                <Check size={11} strokeWidth={3} /> Cumple tu aviso · ≤ 25,00 €
                                            </Tinted>
                                        ) : (
                                            <Tinted color={C.primary} style={{ fontSize: 11.5 }}>
                                                <Bell size={11} /> {r.alert}
                                            </Tinted>
                                        ))}
                                </div>
                            </div>
                            <div style={{ width: 236, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                                    {disc > 0 && <Tinted color={C.sc.top}>-{disc} %</Tinted>}
                                    <span style={{ fontSize: 18, fontWeight: 700 }}>{nf(price, 2)} €</span>
                                    {disc > 0 && <span style={{ fontSize: 12, color: C.muted, textDecoration: 'line-through' }}>{nf(r.from, 2)} €</span>}
                                </div>
                                {atMin ? (
                                    <Deal style={{ scale: first ? String(lerp(1.25, 1, ease(f, WISH_T.hit, 8))) : undefined }}>
                                        <TrendingDown size={12} /> Mínimo histórico
                                    </Deal>
                                ) : cheaper ? (
                                    <Tinted color={C.sc.mid}>
                                        <TriangleAlert size={11} /> Ha estado a {nf(r.min, 2)} €
                                    </Tinted>
                                ) : (
                                    <span style={{ padding: '2px 8px', borderRadius: 6, background: C.surface2, color: C.muted, fontSize: 12, fontWeight: 600 }}>Precio normal</span>
                                )}
                                <div style={{ width: '100%', position: 'relative', height: 6, borderRadius: 999, background: C.surface2, marginTop: 4 }}>
                                    <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(4, pos * 100)}%`, borderRadius: 999, background: atMin ? C.deal : tint(C.fg, '25%') }} />
                                    <span
                                        style={{
                                            position: 'absolute',
                                            left: `${pos * 100}%`,
                                            top: '50%',
                                            width: 11,
                                            height: 11,
                                            translate: '-50% -50%',
                                            borderRadius: 99,
                                            background: atMin ? C.deal : C.fg,
                                            border: `2px solid ${C.surface}`,
                                            boxShadow: `0 0 0 1px ${atMin ? C.dealFg : C.fg}`,
                                        }}
                                    />
                                </div>
                                <div style={{ width: '100%', display: 'flex', fontSize: 11, color: C.muted }}>
                                    <span>
                                        Mín. <b style={{ color: C.fg }}>{nf(r.min, 2)} €</b>
                                    </span>
                                    <span style={{ flex: 1 }} />
                                    <span>
                                        Normal <b style={{ color: C.fg }}>{nf(r.from, 2)} €</b>
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 4, color: C.muted }}>
                                <span style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, color: r.alert ? C.primary : C.muted, rotate: first ? `${bell}deg` : undefined, transformOrigin: '50% 20%' }}>
                                    {r.alert ? <BellRing size={17} /> : <Bell size={17} />}
                                </span>
                                <span style={{ display: 'grid', placeItems: 'center', width: 32, height: 32 }}>
                                    <ExternalLink size={16} />
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

const CountPill = ({ children, c, bg }: { children: React.ReactNode; c: string; bg?: string }) => (
    <span style={{ display: 'inline-grid', placeItems: 'center', minWidth: 20, height: 18, padding: '0 5px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: c, background: bg ?? tint(c === C.muted ? C.fg : c, '14%') }}>{children}</span>
)
