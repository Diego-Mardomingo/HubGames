// Imagen para compartir del resumen anual (#33): el diseño, separado de la ruta (que solo carga los datos).
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { formatPercent } from '@/lib/achievements'
import { RARITY_TIER_LABELS, rarityTier, type RarityTier } from '@/lib/rarity'
import { ratingLabel, ratingTier, type ScoreTier } from '@/lib/scores'
import { dayLong, formatRating, type WrappedView } from '@/lib/wrapped'

const NUMBER = new Intl.NumberFormat('es-ES')

/**
 * Tokens del tema oscuro (globals.css) escritos a mano: Satori no entiende variables CSS. La imagen es siempre oscura
 * (destaca en redes y los colores de rareza y nota lucen más). Solo flexbox, como exige ImageResponse.
 */
const C = {
    bg: '#15171c',
    surface: '#1e2129',
    text: '#e8eaee',
    muted: '#9aa1ae',
    primary: '#7b9bff',
    sinfinal: '#b197fc',
    done: '#4cc97e',
}
const SCORE: Record<ScoreTier, string> = { top: '#4cc97e', good: '#a9d15b', mid: '#f2b53a', bad: '#f26b7e' }
const RARITY: Record<RarityTier, string> = { comun: '#9aa0aa', poco: '#4cc97e', rara: '#5b93ff', epica: '#b07cff', leg: '#f2b53a' }

/** Tinte (fondo al ~14 %) de un color escrito, como .hg-tint en oscuro. */
function tint(hex: string, alpha = 0.14): string {
    const n = parseInt(hex.slice(1), 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

function clip(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** Iconos de lucide (los mismos de la web) como SVG en línea. */
const ICONS = {
    award: ['M15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526'],
    flag: ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22V15'],
    check: ['M20 6 9 17l-5-5'],
    flame: [
        'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
    ],
    star: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'],
    trophy: [
        'M6 9H4.5a2.5 2.5 0 0 1 0-5H6',
        'M18 9h1.5a2.5 2.5 0 0 0 0-5H18',
        'M4 22h16',
        'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22',
        'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22',
        'M18 2H6v7a6 6 0 0 0 12 0V2Z',
    ],
}

function Icon({ name, color, size }: { name: keyof typeof ICONS; color: string; size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            {ICONS[name].map((d) => (
                <path key={d} d={d} />
            ))}
            {name === 'award' && <circle cx={12} cy={8} r={6} />}
        </svg>
    )
}

function Stat({ icon, color, label, value }: { icon: keyof typeof ICONS; color: string; label: string; value: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, padding: '16px 18px', borderRadius: 14, background: C.surface }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, color: C.muted }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: tint(color) }}>
                    <Icon name={icon} color={color} size={17} />
                </div>
                {label}
            </div>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, letterSpacing: -1, color: C.text }}>{value}</div>
        </div>
    )
}

// Onest (OFL, src/assets/fonts/onest) en los tres pesos que usa la imagen; se lee una vez por instancia.
const FONT_DIR = join(process.cwd(), 'src/assets/fonts/onest')
const fonts = Promise.all(
    ([
        ['Onest-Regular.ttf', 400],
        ['Onest-Bold.ttf', 700],
        ['Onest-ExtraBold.ttf', 800],
    ] as const).map(async ([file, weight]) => ({ name: 'Onest', data: await readFile(join(FONT_DIR, file)), weight, style: 'normal' as const })),
)

/** Imagen de 1200×630 del resumen de un año, siempre en oscuro. */
export async function wrappedImage(w: WrappedView, headers?: Record<string, string>): Promise<ImageResponse> {
    const year = w.year
    const best = w.top[0]
    const approx = w.hoursMeasured ? '' : '≈ '
    const rare = w.rarest
    const tier = rare ? rarityTier(rare.global_percent) : null
    const rc = tier ? RARITY[tier] : C.muted
    const sc = best && best.rating !== null ? SCORE[ratingTier(best.rating)] : null
    const lead = `${NUMBER.format(w.activeGames)} ${w.activeGames === 1 ? 'juego' : 'juegos'} con actividad${w.topGenre ? `, sobre todo ${w.topGenre.toLowerCase()}` : ''}`

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '52px 56px',
                    background: C.bg,
                    color: C.text,
                    fontFamily: 'Onest',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>
                        <span>Hub</span>
                        <span style={{ color: C.primary }}>Games</span>
                    </div>
                    <div style={{ display: 'flex', fontSize: 22, color: C.muted }}>
                        {w.through ? `Mi resumen de ${year} · hasta el ${dayLong(w.through)}` : `Mi resumen de ${year}`}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 40, alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div style={{ display: 'flex', fontSize: 26, color: C.muted }}>Horas jugadas</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 132, fontWeight: 800, letterSpacing: -6, lineHeight: 1, color: C.text }}>
                            <span>{`${approx}${NUMBER.format(Math.round(w.minutes / 60))}`}</span>
                            <span style={{ fontSize: 56, letterSpacing: -1, marginLeft: 10, color: C.muted }}>h</span>
                        </div>
                        <div style={{ display: 'flex', fontSize: 24, marginTop: 10, color: C.muted }}>{lead}</div>
                    </div>

                    {(best || rare) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 440 }}>
                            {best && (
                                <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 12, borderRadius: 14, background: C.surface }}>
                                    {best.header_image && (
                                        // eslint-disable-next-line @next/next/no-img-element -- Satori solo entiende <img>
                                        <img src={best.header_image} alt="" width={150} height={70} style={{ width: 150, height: 70, borderRadius: 8, objectFit: 'cover' }} />
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', fontSize: 17, color: C.muted }}>
                                            {`Juego del año · ${approx}${NUMBER.format(Math.round(best.minutes / 60))} h`}
                                        </div>
                                        <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.1 }}>
                                            {clip(best.name ?? `App ${best.appid}`, 38)}
                                        </div>
                                        {sc && best.rating !== null && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 18, fontWeight: 700, color: sc }}>
                                                <Icon name="star" color={sc} size={16} />
                                                {`${formatRating(best.rating)} · ${ratingLabel(best.rating)}`}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {rare && (
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: 14,
                                        alignItems: 'center',
                                        padding: '12px 14px 12px 12px',
                                        borderRadius: 14,
                                        background: C.surface,
                                        borderLeft: `5px solid ${rc}`,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 12, background: tint(rc) }}>
                                        <Icon name="trophy" color={rc} size={28} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', fontSize: 17, color: C.muted }}>{clip(`Logro más raro · ${rare.game ?? `App ${rare.appid}`}`, 34)}</div>
                                        <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1.15 }}>{clip(rare.display_name ?? 'Logro', 40)}</div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: rc }}>{formatPercent(rare.global_percent)}</div>
                                        {tier && <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: rc }}>{RARITY_TIER_LABELS[tier]}</div>}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 14 }}>
                    <Stat icon="award" color={C.sinfinal} label="Logros" value={NUMBER.format(w.unlocks)} />
                    <Stat icon="flag" color={C.done} label="Completados" value={NUMBER.format(w.completed)} />
                    <Stat icon="check" color={C.done} label="Al 100 %" value={NUMBER.format(w.perfect)} />
                    <Stat icon="flame" color={C.primary} label="Mejor racha" value={`${w.streak.length} ${w.streak.length === 1 ? 'día' : 'días'}`} />
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
            fonts: await fonts,
            headers,
        },
    )
}
