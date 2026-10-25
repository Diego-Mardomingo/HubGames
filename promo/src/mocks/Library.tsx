import { Check, Flag, LayoutGrid, Library, List } from 'lucide-react'
import { G, cover, type Game } from '../data'
import { C, F, ease, lerp, pop, rise } from '../theme'
import { Badge, Cover, Cursor, Kicker, Pill } from '../ui/kit'

const STATUS = {
    jugando: { label: 'Jugando', color: C.accent },
    pendiente: { label: 'Pendiente', color: C.primary },
    completado: { label: 'Completado', color: C.success },
    pausado: { label: 'Pausado', color: C.warning },
    cien: { label: '100 %', color: C.gold },
}

const GRID: { g: Game; s: keyof typeof STATUS }[] = [
    { g: G.silksong, s: 'jugando' },
    { g: G.bg3, s: 'jugando' },
    { g: G.celeste, s: 'jugando' },
    { g: G.hades, s: 'cien' },
    { g: G.outerWilds, s: 'completado' },
    { g: G.eldenRing, s: 'pendiente' },
    { g: G.disco, s: 'pendiente' },
    { g: G.sekiro, s: 'pausado' },
    { g: G.hollowKnight, s: 'cien' },
    { g: G.cyberpunk, s: 'completado' },
    { g: G.liesOfP, s: 'pendiente' },
    { g: G.slayTheSpire, s: 'completado' },
    { g: G.witcher3, s: 'completado' },
    { g: G.rdr2, s: 'pendiente' },
]

/** Celeste (índice 2) pasa de "Jugando" a "Completado" con el aviso "¿Lo has terminado?". */
export const LibraryMock = ({ f, cursor = true }: { f: number; cursor?: boolean }) => {
    const ask = ease(f, 62, 14)
    const click = f >= 98
    const press = Math.max(0, 1 - Math.abs(f - 98) / 6)
    const cx = lerp(900, 420, ease(f, 72, 24))
    const cy = lerp(700, 474, ease(f, 72, 24))
    return (
        <div style={{ padding: '26px 34px', position: 'relative', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', ...rise(f, 0) }}>
                <div>
                    <Kicker icon={<Library size={13} />}>Tu colección</Kicker>
                    <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 40, letterSpacing: '-0.03em', marginTop: 6 }}>Biblioteca</div>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                    <Pill active>
                        <LayoutGrid size={14} />
                    </Pill>
                    <Pill>
                        <List size={14} />
                    </Pill>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8, margin: '16px 0 20px', ...rise(f, 4) }}>
                <Pill active>Todos · 412</Pill>
                <Pill>Jugando · 3</Pill>
                <Pill>Pendientes · 27</Pill>
                <Pill>Completados · 64</Pill>
                <Pill>Al 100 % · 9</Pill>
                <Pill>Bandeja · 5</Pill>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 14 }}>
                {GRID.map((it, i) => {
                    const s = 8 + (i % 7) * 3 + Math.floor(i / 7) * 6
                    const t = pop(f, s, 20)
                    const status = i === 2 && click ? STATUS.completado : STATUS[it.s]
                    return (
                        <div
                            key={it.g.id}
                            style={{
                                position: 'relative',
                                borderRadius: 12,
                                overflow: 'hidden',
                                border: `1px solid ${i === 2 && f > 62 ? 'rgba(154,134,255,0.7)' : C.border}`,
                                boxShadow: i === 2 && f > 62 ? '0 0 30px -4px rgba(154,134,255,0.7)' : undefined,
                                opacity: t,
                                scale: String(lerp(0.7, 1, t)),
                                translate: `0 ${(1 - t) * 30}px`,
                            }}
                        >
                            <Cover src={cover(it.g)} style={{ width: '100%', aspectRatio: '2 / 3' }} />
                            <div style={{ position: 'absolute', left: 8, bottom: 8, scale: i === 2 && click ? String(lerp(1.4, 1, ease(f, 98, 12))) : undefined, transformOrigin: 'left bottom' }}>
                                <Badge color={status.color} style={{ background: 'rgba(8,8,14,0.85)' }}>
                                    {i === 2 && click && <Check size={12} />}
                                    {status.label}
                                </Badge>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Aviso "¿Lo has terminado?" sobre la carátula de Celeste */}
            <div
                style={{
                    position: 'absolute',
                    left: 330,
                    top: 360,
                    width: 330,
                    padding: 16,
                    borderRadius: 14,
                    background: 'rgba(16,15,28,0.96)',
                    border: '1px solid rgba(154,134,255,0.45)',
                    boxShadow: '0 20px 60px -10px rgba(0,0,0,0.8)',
                    opacity: ask * (1 - ease(f, 108, 10)),
                    translate: `0 ${(1 - ask) * 16}px`,
                    zIndex: 10,
                }}
            >
                <div style={{ color: C.accent, fontSize: 13, fontWeight: 700 }}>¿Lo has terminado?</div>
                <div style={{ fontWeight: 700, fontSize: 17, margin: '2px 0 4px' }}>Celeste</div>
                <div style={{ color: C.mutedLight, fontSize: 13, marginBottom: 12 }}>Has visto los créditos: logro «Cumbre» desbloqueado.</div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Pill active style={{ scale: String(1 - press * 0.08) }}>
                        <Flag size={14} /> Sí, completado
                    </Pill>
                    <Pill>Todavía no</Pill>
                </div>
            </div>
            {cursor && <Cursor x={cx} y={cy} press={press} opacity={ease(f, 66, 8) * (1 - ease(f, 112, 8))} />}
        </div>
    )
}
