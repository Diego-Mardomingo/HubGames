'use client'

import Link from 'next/link'
import Image from 'next/image'
import { type Game } from '@/lib/rawg'

interface GameCardProps {
    game: Game
    priority?: boolean
}

export default function GameCard({ game, priority }: GameCardProps) {
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
        <Link href={`/juego/${game.id}`} className="juego">
            <div className="nombre">
                {game.name}
            </div>
            <div className="imagen">
                {game.background_image && (
                    <Image
                        src={game.background_image}
                        alt={`Imagen ${game.name}`}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        style={{ objectFit: 'cover' }}
                        priority={priority}
                    />
                )}
            </div>
            <div className="footer_juego">
                <div className="released">{formatDate(game.released)}</div>
                <div className={`nota ${getScoreClass(game.metacritic)}`}>
                    {game.metacritic || ''}
                </div>
            </div>
        </Link>
    )
}
