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

/** Juego en las vistas de cazador (#26): cabecera, nombre, progreso de logros y enlace a sus logros. */
export default function GameLine({ game, detail }: Props) {
    const pct = achievementPercent(game) ?? 0
    return (
        <li>
            <Link href={`/juego/${game.appid}/logros`} className="game-line">
                <span className="game-line__cover">
                    <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes="96px" />
                </span>
                <span className="game-line__body">
                    <span className="game-line__name">{game.name ?? `App ${game.appid}`}</span>
                    <span className="game-line__detail">{detail}</span>
                    <span className="lib-progress" aria-hidden>
                        <span style={{ width: `${pct}%` }} />
                    </span>
                </span>
                <span className="game-line__pct">
                    {game.achievements_unlocked ?? 0}/{game.achievements_total}
                    <small>{pct} %</small>
                </span>
            </Link>
        </li>
    )
}
