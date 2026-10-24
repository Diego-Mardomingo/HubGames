'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Gamepad2 } from 'lucide-react'
import { verticalCover } from '@/lib/library'
import './tracker.css'

interface Props {
    appid: number
    name: string | null
    headerImage: string | null
    /** vertical: portada 600×900 de la biblioteca de Steam; si no existe, la cabecera recortada. */
    variant: 'vertical' | 'header'
    sizes: string
    priority?: boolean
}

/** Portada de Steam con respaldo: vertical → cabecera → marcador con el nombre. */
export default function GameCover({ appid, name, headerImage, variant, sizes, priority }: Props) {
    const sources = [variant === 'vertical' ? verticalCover(appid) : null, headerImage].filter((s): s is string => !!s)
    const [index, setIndex] = useState(0)
    const src = sources[index]

    if (!src) {
        return (
            <span className="game-cover game-cover--empty">
                <Gamepad2 size={20} aria-hidden />
                <span>{name ?? `App ${appid}`}</span>
            </span>
        )
    }
    return (
        <span className="game-cover">
            <Image
                key={src}
                src={src}
                alt=""
                fill
                sizes={sizes}
                priority={priority}
                onError={() => setIndex((i) => i + 1)}
            />
        </span>
    )
}
