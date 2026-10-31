import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCatalogGame, parseAppid } from '@/lib/catalog'
import GameAchievements from './GameAchievements'

interface Props {
    params: Promise<{ appid: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const appid = parseAppid((await params).appid)
    const game = appid ? await getCatalogGame(appid) : null
    if (!game) return { title: 'Juego no encontrado' }
    return {
        title: `Logros de ${game.name}`,
        description: `Todos los logros de ${game.name} en Steam, con su rareza: cuáles tienes y cuáles te faltan.`,
        alternates: { canonical: `/juego/${game.steam_appid}/logros` },
    }
}

/** Logros de un juego (#25). El nombre viene del catálogo; tus logros se cargan en el cliente (RLS). */
export default async function LogrosJuegoPage({ params }: Props) {
    const appid = parseAppid((await params).appid)
    if (!appid) notFound()
    const game = await getCatalogGame(appid)
    if (!game) notFound()
    return <GameAchievements appid={appid} name={game.name} headerImage={game.header_image} />
}
