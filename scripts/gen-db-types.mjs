// Genera src/lib/supabase/database.types.ts solo con los objetos de HubGames (hubgames_* y sus RPC),
// a partir del OpenAPI de PostgREST. La base de datos es compartida con ECOS: no se incluye nada de ecos_*.
// Uso: npm run db:types  (necesita NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local)
import { writeFileSync } from 'node:fs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')

/** Funciones de HubGames (is_admin lo usa solo HubGames). Los tipos de retorno no salen del OpenAPI. */
const FUNCTIONS = {
    hubgames_username_available: 'boolean',
    hubgames_judi_ranking_rows: `{
          completado: boolean
          fase1: boolean
          fase2: boolean
          fase3: boolean
          fase4: boolean
          fase5: boolean
          fase6: boolean
          id_usuario: string
          username: string | null
        }[]`,
    hubgames_judi_list: `{
          completado: boolean
          fase1: boolean
          fase2: boolean
          fase3: boolean
          fase4: boolean
          fase5: boolean
          fase6: boolean
          fecha: string
          header_image: string | null
          id: number
          nombre: string | null
        }[]`,
    hubgames_judi_get_day: 'Json',
    hubgames_judi_guess: 'Json',
    hubgames_judi_guess_anon: 'Json',
    hubgames_judi_capture_url: 'string | null',
    hubgames_judi_search_pool: '{ game_name: string; steam_appid: number }[]',
    hubgames_judi_pick_daily: 'Json',
    hubgames_reorder_backlog: 'undefined',
    hubgames_split_playtime: `{
          day: string
          minutes: number
        }[]`,
    hubgames_take_playtime_snapshot: 'number',
    is_admin: 'boolean',
}

const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
if (!res.ok) throw new Error(`OpenAPI: ${res.status} ${await res.text()}`)
const api = await res.json()

function tsType(p) {
    if (p.type === 'array') return `${tsType(p.items ?? {})}[]`
    if (p.format === 'jsonb' || p.format === 'json') return 'Json'
    if (p.type === 'integer' || p.type === 'number') return 'number'
    if (p.type === 'boolean') return 'boolean'
    if (p.type === 'string') return 'string'
    return 'Json'
}

const tables = Object.keys(api.definitions).filter((n) => n.startsWith('hubgames_')).sort()
let out = `// Archivo generado por scripts/gen-db-types.mjs (npm run db:types). No editar a mano.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
`
for (const name of tables) {
    const def = api.definitions[name]
    const required = new Set(def.required ?? [])
    const cols = Object.entries(def.properties)
    // Clave primaria entera simple sin default visible en el OpenAPI = columna identity/serial.
    const pks = cols.filter(([, p]) => String(p.description ?? '').includes('<pk/>')).map(([c]) => c)
    const identity = new Set(pks.length === 1 && cols.find(([c]) => c === pks[0])[1].type === 'integer' ? pks : [])
    const row = cols.map(([c, p]) => `          ${c}: ${tsType(p)}${required.has(c) ? '' : ' | null'}`).join('\n')
    const ins = cols
        .map(([c, p]) => {
            const optional = !required.has(c) || 'default' in p || identity.has(c)
            return `          ${c}${optional ? '?' : ''}: ${tsType(p)}${required.has(c) ? '' : ' | null'}`
        })
        .join('\n')
    const upd = cols.map(([c, p]) => `          ${c}?: ${tsType(p)}${required.has(c) ? '' : ' | null'}`).join('\n')
    out += `      ${name}: {
        Row: {
${row}
        }
        Insert: {
${ins}
        }
        Update: {
${upd}
        }
        Relationships: []
      }
`
}
out += `    }
    Views: {
      [_ in never]: never
    }
    Functions: {
`
for (const [fn, returns] of Object.entries(FUNCTIONS)) {
    const post = api.paths[`/rpc/${fn}`]?.post
    if (!post) throw new Error(`La función ${fn} no existe en la base de datos`)
    const schema = post.parameters.find((p) => p.in === 'body')?.schema
    const props = Object.entries(schema?.properties ?? {})
    const req = new Set(schema?.required ?? [])
    const args = props.length
        ? `{ ${props.map(([n, p]) => `${n}${req.has(n) ? '' : '?'}: ${tsType(p)}`).join('; ')} }`
        : 'never'
    out += `      ${fn}: {
        Args: ${args}
        Returns: ${returns}
      }
`
}
out += `    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
`

writeFileSync(new URL('../src/lib/supabase/database.types.ts', import.meta.url), out)
console.log(`database.types.ts: ${tables.length} tablas, ${Object.keys(FUNCTIONS).length} funciones`)
