import Link from 'next/link'
import type { LibraryGame } from '@/lib/tracker'
import { achievementPercent } from '@/lib/library'
import GameCover from '@/components/tracker/GameCover'
import { MarkFlags, StatusChip } from '@/components/tracker/status'
import './achievements.css'

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>

interface Props {
    game: Pick<LibraryGame, 'appid' | 'name' | 'header_image' | 'achievements_total' | 'achievements_unlocked' | 'status' | 'favorite' | 'endless'>
    /** Datos tras el chip de la lista ("Te faltan 2", "hace 4 meses"...). */
    detail: React.ReactNode
    /** Posición en la entrada escalonada (`.hg-enter`, `.hg-bar--fill`). */
    index: number
}

/**
 * Juego en las vistas de cazador (#26), como una fila de la Biblioteca: franja y chip de su lista, marcas, cápsula,
 * nombre, datos y progreso de logros con barra que se rellena. Toda la fila abre sus logros.
 */
export default function GameLine({ game, detail, index }: Props) {
    const pct = achievementPercent(game) ?? 0
    const name = game.name ?? `App ${game.appid}`
    const style: CSSVars = { '--i': index }
    return (
        <li className={`hg-row lib-row game-line hg-enter st-${game.status}`} style={style}>
            <span className="hg-row__cover">
                <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes="96px" />
            </span>
            <span className="hg-row__main">
                <Link href={`/juego/${game.appid}/logros`} className="hg-row__link" title={name} data-row-link>
                    {name}
                </Link>
                <span className="hg-row__meta lib-row__meta">
                    <StatusChip status={game.status} />
                    <MarkFlags favorite={game.favorite} endless={game.endless} />
                    {detail}
                </span>
            </span>
            <span className="hg-row__prog">
                <span className="hg-row__prog-label">
                    <span>
                        <b>{game.achievements_unlocked ?? 0}</b> / {game.achievements_total}
                    </span>
                    <span>{pct} %</span>
                </span>
                <span className="hg-bar hg-bar--fill" style={style} aria-hidden>
                    <span style={{ width: `${pct}%` }} />
                </span>
            </span>
        </li>
    )
}
