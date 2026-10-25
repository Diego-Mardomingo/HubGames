import Link from 'next/link'
import type { LibraryGame } from '@/lib/tracker'
import { achievementPercent } from '@/lib/library'
import GameCover from '@/components/tracker/GameCover'
import './achievements.css'

interface Props {
    game: Pick<LibraryGame, 'appid' | 'name' | 'header_image' | 'achievements_total' | 'achievements_unlocked'>
    /** Texto bajo el nombre ("faltan 2", "hace 4 meses"...). */
    detail: React.ReactNode
}

/** Juego en las vistas de cazador (#26): cápsula, nombre, progreso de logros con barra fina y enlace a sus logros. */
export default function GameLine({ game, detail }: Props) {
    const pct = achievementPercent(game) ?? 0
    return (
        <li className="hg-row game-line">
            <span className="hg-row__cover">
                <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes="112px" />
            </span>
            <span className="hg-row__main">
                <Link href={`/juego/${game.appid}/logros`} className="hg-row__link" data-row-link>
                    {game.name ?? `App ${game.appid}`}
                </Link>
                <span className="hg-row__meta">{detail}</span>
            </span>
            <span className="hg-row__prog">
                <span className="hg-row__prog-label">
                    <span>
                        <b>{game.achievements_unlocked ?? 0}</b> / {game.achievements_total}
                    </span>
                    <span>{pct} %</span>
                </span>
                <span className="hg-bar" aria-hidden>
                    <span style={{ width: `${pct}%` }} />
                </span>
            </span>
        </li>
    )
}
