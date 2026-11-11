// Lo abre Windows al pulsar «Actualizar» en /perfil (enlace hubgames-familia://, registrado con
// `npm run steam:familia:instalar`). Cualquier web puede abrir ese enlace, así que no se lee nada de él: siempre hace lo
// mismo, mostrar el QR de scripts/steam-family.ts, que sin tu aprobación en el móvil no consigue nada.
// JavaScript plano: se ejecuta con node sin pasar por npm ni tsx.
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..'))
process.title = 'HubGames · Grupo familiar'

const { status } = spawnSync(process.execPath, ['--env-file=.env.local', join('node_modules', 'tsx', 'dist', 'cli.mjs'), join('scripts', 'steam-family.ts')], {
    stdio: 'inherit',
})

if (status === 0) {
    console.log('\nYa puedes volver a HubGames. Esta ventana se cierra sola.')
    await new Promise((resolve) => setTimeout(resolve, 8000))
} else {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    await rl.question('\nPulsa Intro para cerrar.')
    rl.close()
}
process.exit(status ?? 1)
