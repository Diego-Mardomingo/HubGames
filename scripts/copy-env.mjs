// Copia los .env* (ignorados por git) del checkout principal al worktree recién creado. Lo ejecuta Orca (orca.yaml).
// Orca a veces no pasa ORCA_ROOT_PATH (stablyai/orca#9206): entonces el checkout principal se saca de git.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const root = process.env.ORCA_ROOT_PATH
    || dirname(resolve(execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim()))
if (resolve(root) === resolve('.')) process.exit(0)
for (const f of readdirSync(root)) {
    if (/^\.env(\..+)?$/.test(f) && !f.endsWith('.example') && !existsSync(f)) {
        copyFileSync(join(root, f), f)
        console.log('copiado', f)
    }
}
