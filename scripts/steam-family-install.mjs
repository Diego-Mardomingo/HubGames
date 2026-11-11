// Registra en tu usuario de Windows el enlace hubgames-familia://, que abre el botón «Actualizar» del grupo familiar
// en /perfil (#86). Sin permisos de administrador (HKCU). Hay que repetirlo si mueves el proyecto o cambia la ruta de node.
// Uso: npm run steam:familia:instalar          (registrar)
//      npm run steam:familia:instalar -- --quitar   (borrar)
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const KEY = 'HKCU\\Software\\Classes\\hubgames-familia'
const reg = (...args) => execFileSync('reg', args, { stdio: 'pipe' })

if (process.platform !== 'win32') {
    console.error('Solo funciona en Windows.')
    process.exit(1)
}

if (process.argv.includes('--quitar')) {
    try {
        reg('delete', KEY, '/f')
        console.log('Enlace hubgames-familia:// borrado.')
    } catch {
        console.log('No estaba registrado.')
    }
    process.exit(0)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const launcher = join(root, 'scripts', 'steam-family-launch.mjs')
if (!existsSync(join(root, '.env.local'))) console.warn('Aviso: falta .env.local; el script lo necesita para guardar en Supabase.')

// Sin "%1": la dirección del enlace no llega nunca al script.
const command = `"${process.execPath}" "${launcher}"`
reg('add', KEY, '/ve', '/d', 'URL:HubGames grupo familiar', '/f')
reg('add', KEY, '/v', 'URL Protocol', '/d', '', '/f')
reg('add', `${KEY}\\shell\\open\\command`, '/ve', '/d', command, '/f')

console.log('Listo: el botón «Actualizar» del grupo familiar en /perfil ya abre el QR en este PC.')
console.log(`Comando registrado: ${command}`)
