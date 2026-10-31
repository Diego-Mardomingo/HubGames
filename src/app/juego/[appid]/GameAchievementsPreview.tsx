'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import CountUp from '@/components/CountUp'
import { formatPercent, type Achievement } from '@/lib/achievements'
import { RARITY_TIERS, RARITY_TIER_LABELS, rarityColor, rarityTier, type RarityTier } from '@/lib/rarity'
import { fetchSteamAchievements, rarestPercent } from '@/lib/steam-achievements'
import AchievementItem from '@/components/achievements/AchievementItem'
import '@/components/achievements/achievements.css'

type CSSVars = CSSProperties & Record<`--${string}`, string>

const SHOWN = 3

/** Todos los logros del juego por rareza, de común a legendaria (solo las que tiene). */
function byRarity(list: Achievement[]): { tier: RarityTier; count: number }[] {
    const counts = new Map<RarityTier, number>()
    for (const a of list) {
        const tier = rarityTier(a.global_percent)
        if (tier) counts.set(tier, (counts.get(tier) ?? 0) + 1)
    }
    return RARITY_TIERS.flatMap((tier) => (counts.get(tier) ? [{ tier, count: counts.get(tier)! }] : []))
}

/**
 * Logros en la ficha de un juego que no tienes (#104), pedidos a Steam en el momento: cuántos hay, el más raro,
 * el reparto por rareza y los más raros y más comunes, para decidir antes de comprar. Sin logros, no se pinta.
 */
export default function GameAchievementsPreview({ appid, name }: { appid: number; name: string }) {
    const [list, setList] = useState<Achievement[] | null>(null)

    useEffect(() => {
        let cancelled = false
        fetchSteamAchievements(appid)
            .catch(() => [])
            .then((l) => !cancelled && setList(l))
        return () => {
            cancelled = true
        }
    }, [appid])

    if (!list || list.length === 0) return null

    const total = list.length
    const rarest = rarestPercent(list)
    const rarity = byRarity(list)
    const withPct = list.filter((a) => a.global_percent !== null)
    const hardest = [...withPct].sort((a, b) => a.global_percent! - b.global_percent!).slice(0, SHOWN)
    // Sin repetir: en juegos con pocos logros, los más comunes son los que no han salido entre los más raros.
    const shownRare = new Set(hardest.map((a) => a.apiname))
    const easiest = withPct
        .filter((a) => !shownRare.has(a.apiname))
        .sort((a, b) => b.global_percent! - a.global_percent!)
        .slice(0, SHOWN)

    return (
        <section id="juego-logros" className="juego-ach glass" aria-labelledby="juego-ach-title">
            <div className="juego-ach__summary">
                <h2 id="juego-ach-title" className="juego__section-title">
                    <Trophy size={17} className="juego-ach__trophy" aria-hidden /> Logros
                </h2>
                <div className="hg-ring juego-ach__ring" role="img" aria-label={`${total} ${total === 1 ? 'logro' : 'logros'}`}>
                    <svg viewBox="0 0 36 36" aria-hidden>
                        <circle cx="18" cy="18" r="15.5" className="hg-ring__track" />
                    </svg>
                    <span className="hg-ring__text" aria-hidden>
                        <b>
                            <CountUp value={total} />
                        </b>
                        <span>{total === 1 ? 'logro' : 'logros'}</span>
                    </span>
                </div>
                {rarity.length > 0 && (
                    <>
                        <div className="juego-ach__stack" aria-hidden>
                            {rarity.map((r) => (
                                <span key={r.tier} style={{ flex: r.count, '--c': rarityColor(r.tier) } as CSSVars} />
                            ))}
                        </div>
                        <ul className="juego-ach__legend" aria-label="Logros por rareza">
                            {rarity.map((r, i) => (
                                <li key={r.tier} style={{ '--c': rarityColor(r.tier), '--i': String(i) } as CSSVars}>
                                    {RARITY_TIER_LABELS[r.tier]} <b>{r.count}</b>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>

            <div className="juego-ach__main">
                <p className="juego-ach__lead">
                    Este juego tiene <b>{total.toLocaleString('es-ES')}</b> {total === 1 ? 'logro' : 'logros'}
                    {rarest !== null && (
                        <>
                            {' '}
                            · el más raro lo tiene el <b>{formatPercent(rarest)}</b> de los jugadores
                        </>
                    )}
                    .{' '}
                    <Link href={`/juego/${appid}/logros`} className="juego-ach__all">
                        Ver los {total}
                    </Link>
                </p>
                {withPct.length > 0 && (
                    <div className="juego-ach__cols">
                        <div className="juego-ach__col">
                            <h3>
                                Los más raros <small>por % de jugadores</small>
                            </h3>
                            <ul className="hg-achs">
                                {hardest.map((a, i) => (
                                    <AchievementItem key={a.apiname} achievement={a} gameName={name} index={i} />
                                ))}
                            </ul>
                        </div>
                        {easiest.length > 0 && (
                            <div className="juego-ach__col">
                                <h3>Los más comunes</h3>
                                <ul className="hg-achs">
                                    {easiest.map((a, i) => (
                                        <AchievementItem key={a.apiname} achievement={a} gameName={name} index={i + SHOWN} />
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    )
}
