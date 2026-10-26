'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { ACHIEVEMENT_COLUMNS, type Achievement } from '@/lib/achievements'
import { RARITY_TIERS, RARITY_TIER_LABELS, rarityColor, rarityTier, type RarityTier } from '@/lib/rarity'
import AchievementItem from '@/components/achievements/AchievementItem'
import { useGame } from './GameContext'
import '@/components/achievements/achievements.css'

type CSSVars = CSSProperties & Record<`--${string}`, string>

const SHOWN = 3

/** Tus logros conseguidos por rareza, de común a legendaria (solo las que tienes). */
function unlockedByRarity(list: Achievement[]): { tier: RarityTier; count: number }[] {
    const counts = new Map<RarityTier, number>()
    for (const a of list) {
        const tier = a.achieved ? rarityTier(a.global_percent) : null
        if (tier) counts.set(tier, (counts.get(tier) ?? 0) + 1)
    }
    return RARITY_TIERS.flatMap((tier) => (counts.get(tier) ? [{ tier, count: counts.get(tier)! }] : []))
}

/**
 * Logros en la ficha: anillo de progreso, lo conseguido por rareza, los siguientes más fáciles (los que más jugadores
 * tienen y tú no) y los últimos desbloqueados. La lista completa sigue en /juego/[appid]/logros.
 */
export default function GameAchievementsSummary() {
    const { appid, name, state } = useGame()
    const total = state.kind === 'ok' ? (state.game.achievements_total ?? 0) : 0
    const [list, setList] = useState<Achievement[] | null>(null)

    useEffect(() => {
        if (total === 0) return
        let cancelled = false
        supabase
            .from('hubgames_achievements')
            .select(ACHIEVEMENT_COLUMNS)
            .eq('appid', appid)
            .then(({ data }) => !cancelled && setList((data ?? []) as Achievement[]))
        return () => {
            cancelled = true
        }
    }, [appid, total])

    if (state.kind !== 'ok' || total === 0) return null

    const unlocked = state.game.achievements_unlocked ?? 0
    const pct = Math.floor((unlocked / total) * 100)
    const all = list ?? []
    const rarity = unlockedByRarity(all)
    const next = all
        .filter((a) => !a.achieved && a.global_percent !== null)
        .sort((a, b) => (b.global_percent ?? 0) - (a.global_percent ?? 0))
        .slice(0, SHOWN)
    const recent = all
        .filter((a) => a.achieved && a.unlocktime)
        .sort((a, b) => Date.parse(b.unlocktime!) - Date.parse(a.unlocktime!))
        .slice(0, SHOWN)
    // Anillo: circunferencia de r = 15,5 en un viewBox de 36.
    const circumference = 2 * Math.PI * 15.5

    return (
        <section id="juego-logros" className="juego-ach glass" aria-labelledby="juego-ach-title">
            <div className="juego-ach__summary">
                <h2 id="juego-ach-title" className="juego__section-title">
                    <Trophy size={17} className="juego-ach__trophy" aria-hidden /> Logros
                </h2>
                <div className="juego-ach__ring" role="img" aria-label={`${unlocked} de ${total} logros, ${pct} %`}>
                    <svg viewBox="0 0 36 36" aria-hidden>
                        <circle cx="18" cy="18" r="15.5" className="juego-ach__ring-track" />
                        <circle
                            cx="18"
                            cy="18"
                            r="15.5"
                            className={`juego-ach__ring-fill${unlocked >= total ? ' is-done' : ''}`}
                            strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
                        />
                    </svg>
                    <span className="juego-ach__ring-text">
                        <b>{pct} %</b>
                        <span>
                            {unlocked} de {total}
                        </span>
                    </span>
                </div>
                {rarity.length > 0 && (
                    <>
                        <div className="juego-ach__stack" aria-hidden>
                            {rarity.map((r) => (
                                <span key={r.tier} style={{ flex: r.count, '--c': rarityColor(r.tier) } as CSSVars} />
                            ))}
                        </div>
                        <ul className="juego-ach__legend" aria-label="Tus logros por rareza">
                            {rarity.map((r) => (
                                <li key={r.tier} style={{ '--c': rarityColor(r.tier) } as CSSVars}>
                                    {RARITY_TIER_LABELS[r.tier]} <b>{r.count}</b>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>

            <div className="juego-ach__cols">
                <div className="juego-ach__col">
                    <h3>
                        Los siguientes más fáciles <small>por % de jugadores</small>
                    </h3>
                    {list === null ? null : next.length > 0 ? (
                        <ul className="hg-achs">
                            {next.map((a) => (
                                <AchievementItem key={a.apiname} achievement={a} gameName={name} />
                            ))}
                        </ul>
                    ) : (
                        <p className="juego-panel__note">{unlocked >= total ? '¡Los tienes todos!' : 'Sin datos de rareza.'}</p>
                    )}
                </div>
                <div className="juego-ach__col">
                    <h3>
                        Últimos desbloqueados
                        <Link href={`/juego/${appid}/logros`} className="juego-ach__all">
                            Ver los {total}
                        </Link>
                    </h3>
                    {list === null ? null : recent.length > 0 ? (
                        <ul className="hg-achs">
                            {recent.map((a) => (
                                <AchievementItem key={a.apiname} achievement={a} gameName={name} />
                            ))}
                        </ul>
                    ) : (
                        <p className="juego-panel__note">Aún no has desbloqueado ninguno.</p>
                    )}
                </div>
            </div>
        </section>
    )
}
