import { ArrowLeft } from 'lucide-react'
import GameCover from '@/components/tracker/GameCover'
import { Skeleton, SkeletonZone } from '@/components/ui/skeleton'
import { AchievementSkeleton } from '@/components/skeletons'
import '@/styles/lists.css'
import '@/components/achievements/achievements.css'
import './logros-juego.css'

/**
 * Esqueleto de los logros de un juego. Con `name` (el cliente ya lo sabe: viene del catálogo) la cabecera sale de
 * verdad, con la cápsula y el título; sin él (`loading.tsx`, antes de tener el catálogo), también en hueso.
 */
export default function GameAchievementsSkeleton({ appid, name, headerImage }: { appid?: number; name?: string; headerImage?: string | null }) {
    return (
        <SkeletonZone label="Cargando los logros">
            <div className="logros gl">
                <span className="logros__back gl-back">
                    <ArrowLeft size={14} aria-hidden /> {name ?? <Skeleton shape="text" w="10ch" />}
                </span>
                <header className="gl-head">
                    {appid && name ? (
                        <span className="gl-cap">
                            <GameCover appid={appid} name={name} headerImage={headerImage ?? null} variant="header" sizes="184px" priority />
                        </span>
                    ) : (
                        <Skeleton className="gl-cap" />
                    )}
                    <h1 className="page-title">{name ? `Logros de ${name}` : <Skeleton shape="text" w="14ch" />}</h1>
                    <p className="gl-meta">
                        <Skeleton shape="text" w="30ch" />
                    </p>
                    <div className="gl-head__act">
                        <Skeleton w={150} h={40} style={{ borderRadius: 'var(--radius-sm)' }} />
                    </div>
                </header>
                <section className="gl-sum" aria-hidden>
                    <div className="gl-ringbox">
                        <Skeleton shape="circle" className="gl-ring" />
                    </div>
                    <div className="gl-sum__main">
                        <div className="gl-sum__top">
                            <p className="gl-pts">
                                <Skeleton shape="text" w="12ch" style={{ fontSize: '1.75rem' }} />
                                <Skeleton shape="text" w="18ch" />
                            </p>
                        </div>
                        <ul className="gl-tiers">
                            {[0, 1, 2, 3, 4].map((i) => (
                                <li key={i}>
                                    <Skeleton h={78} style={{ borderRadius: 10 }} />
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
                <div className="gl-bar">
                    <Skeleton w={380} h={38} style={{ borderRadius: 'var(--radius-sm)', maxWidth: '100%' }} />
                    <Skeleton w={240} h={38} style={{ borderRadius: 'var(--radius-sm)', maxWidth: '100%' }} />
                </div>
                <ul className="ach-list gl-list">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <AchievementSkeleton key={i} i={i} />
                    ))}
                </ul>
            </div>
        </SkeletonZone>
    )
}
