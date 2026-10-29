import { staticFile } from 'remotion'

/** Juegos reales de Steam con datos de usuario inventados (nunca datos personales). */
export type Game = { id: number; name: string }

export const G = {
    eldenRing: { id: 1245620, name: 'ELDEN RING' },
    hades: { id: 1145360, name: 'Hades' },
    hollowKnight: { id: 367520, name: 'Hollow Knight' },
    stardew: { id: 413150, name: 'Stardew Valley' },
    bg3: { id: 1086940, name: "Baldur's Gate 3" },
    cyberpunk: { id: 1091500, name: 'Cyberpunk 2077' },
    celeste: { id: 504230, name: 'Celeste' },
    portal2: { id: 620, name: 'Portal 2' },
    disco: { id: 632470, name: 'Disco Elysium' },
    rdr2: { id: 1174180, name: 'Red Dead Redemption 2' },
    witcher3: { id: 292030, name: 'The Witcher 3: Wild Hunt' },
    sekiro: { id: 814380, name: 'Sekiro: Shadows Die Twice' },
    balatro: { id: 2379780, name: 'Balatro' },
    terraria: { id: 105600, name: 'Terraria' },
    outerWilds: { id: 753640, name: 'Outer Wilds' },
    deadCells: { id: 588650, name: 'Dead Cells' },
    slayTheSpire: { id: 646570, name: 'Slay the Spire' },
    itTakesTwo: { id: 1426210, name: 'It Takes Two' },
    liesOfP: { id: 1627720, name: 'Lies of P' },
    silksong: { id: 1030300, name: 'Hollow Knight: Silksong' },
} satisfies Record<string, Game>

export const ALL_GAMES: Game[] = Object.values(G)

export const cover = (g: Game) => staticFile(`games/c_${g.id}.jpg`)
export const header = (g: Game) => staticFile(`games/h_${g.id}.jpg`)
export const hero = (id: number) => staticFile(`games/hero_${id}.jpg`)
export const sfx = (name: string) => staticFile(`sfx/${name}.ogg`)

/** Nombre de usuario inventado que sale en las maquetas. */
export const USER = 'alex'
