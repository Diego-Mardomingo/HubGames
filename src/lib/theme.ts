export type ThemePref = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'hg-theme'
export const THEME_CHANGED_EVENT = 'hg-theme-changed'

/**
 * Se ejecuta en <head> antes de pintar: aplica el tema guardado (o el del sistema) para evitar el parpadeo.
 * Con preferencia "system" sigue los cambios del sistema operativo en vivo; también se sincroniza entre pestañas.
 */
export const themeScript = `(function(){try{
var k='${THEME_STORAGE_KEY}',d=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)');
function a(){var p=localStorage.getItem(k)||'system';d.dataset.theme=p==='system'?(m.matches?'dark':'light'):p;}
a();m.addEventListener('change',a);window.addEventListener('${THEME_CHANGED_EVENT}',a);window.addEventListener('storage',a);
}catch(e){}})()`

export function getThemePref(): ThemePref {
    try {
        const v = localStorage.getItem(THEME_STORAGE_KEY)
        return v === 'light' || v === 'dark' ? v : 'system'
    } catch {
        return 'system'
    }
}

let fadeTimer: ReturnType<typeof setTimeout> | undefined

/** Colores que pasan con un fundido al cambiar de tema (`html.hg-theme-anim` en globals.css), salvo con movimiento reducido. */
function fadeThemeColors() {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const root = document.documentElement
    root.classList.add('hg-theme-anim')
    clearTimeout(fadeTimer)
    fadeTimer = setTimeout(() => root.classList.remove('hg-theme-anim'), 320)
}

export function setThemePref(pref: ThemePref) {
    fadeThemeColors()
    try {
        if (pref === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
        else localStorage.setItem(THEME_STORAGE_KEY, pref)
    } catch {
        // Sin localStorage (modo privado estricto): el tema solo dura esta página.
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.dataset.theme = pref === 'system' ? (dark ? 'dark' : 'light') : pref
        return
    }
    window.dispatchEvent(new Event(THEME_CHANGED_EVENT))
}
