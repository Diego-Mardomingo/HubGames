'use client'

import Link from 'next/link'
import Image from 'next/image'
import { type Game } from '@/lib/game-types'

interface GameCardProps {
    game: Game
    priority?: boolean
    layout?: 'grid' | 'rows'
}

export default function GameCard({ game, priority, layout = 'grid' }: GameCardProps) {
    const getScoreClass = (score: number | null) => {
        if (!score) return 'fondo_transparente'
        if (score > 80) return 'fondo_verde'
        if (score > 50) return 'fondo_naranja'
        return 'fondo_rojo'
    }

    const formatDate = (dateString: string) => {
        if (!dateString) return ''
        const [year, month, day] = dateString.split('-')
        return `${day}-${month}-${year}`
    }

    return (
        <Link href={`/juego/${game.id}`} className={`juego_card_premium ${layout === 'rows' ? 'juego_card_premium--row' : ''}`}>
            <div className="juego_card_image">
                {game.background_image && (
                    <Image
                        src={game.background_image}
                        alt={game.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="img_game"
                        priority={priority}
                    />
                )}
            </div>
            <div className="juego_card_info">
                <h3 className="juego_card_title">{game.name}</h3>
                <div className="juego_card_meta">
                    <span className="juego_card_date">
                        <i className="fa-regular fa-calendar"></i> {formatDate(game.released)}
                    </span>
                    {game.metacritic && (
                        <span className={`juego_badge_score ${getScoreClass(game.metacritic)}`}>
                            {game.metacritic}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    )
}
