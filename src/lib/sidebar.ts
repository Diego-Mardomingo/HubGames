// Barra lateral plegada a mano en pantallas anchas (≥ 1100 px). Por debajo de 1100 px siempre está plegada (CSS).
// Mismo patrón que el tema (theme.ts): la preferencia vive en localStorage y un script en <head> la aplica antes de pintar.

export const SIDEBAR_STORAGE_KEY = 'hg-sidebar'
export const SIDEBAR_CHANGED_EVENT = 'hg-sidebar-changed'

/** Pone `data-side="collapsed"` en <html> si la barra está plegada; también se sincroniza entre pestañas. */
export const sidebarScript = `(function(){try{
var k='${SIDEBAR_STORAGE_KEY}',d=document.documentElement;
function a(){if(localStorage.getItem(k)==='collapsed')d.dataset.side='collapsed';else delete d.dataset.side;}
a();window.addEventListener('storage',function(e){if(e.key===k){a();window.dispatchEvent(new Event('${SIDEBAR_CHANGED_EVENT}'));}});
}catch(e){}})()`

export function isSidebarCollapsed(): boolean {
    return document.documentElement.dataset.side === 'collapsed'
}

export function subscribeSidebar(onChange: () => void) {
    window.addEventListener(SIDEBAR_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(SIDEBAR_CHANGED_EVENT, onChange)
}

function persist(collapsed: boolean) {
    try {
        if (collapsed) localStorage.setItem(SIDEBAR_STORAGE_KEY, 'collapsed')
        else localStorage.removeItem(SIDEBAR_STORAGE_KEY)
    } catch {
        // Sin localStorage: el cambio solo dura esta página.
    }
}

const LABELS_FADE_MS = 150
const WIDTH_MS = 220

/**
 * Pliega o despliega con la transición del mockup: al plegar, primero se desvanecen las etiquetas y luego cambia el
 * ancho; al desplegar, al revés. `data-side-anim` activa la transición de ancho solo durante el cambio (no al cargar ni
 * al redimensionar) y `data-side-fade` oculta las etiquetas mientras tanto.
 */
export function setSidebarCollapsed(collapsed: boolean) {
    const d = document.documentElement
    persist(collapsed)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const apply = () => {
        if (collapsed) d.dataset.side = 'collapsed'
        else delete d.dataset.side
        window.dispatchEvent(new Event(SIDEBAR_CHANGED_EVENT))
    }
    if (reduced) {
        apply()
        return
    }
    d.dataset.sideAnim = ''
    d.dataset.sideFade = ''
    if (collapsed) {
        window.setTimeout(() => {
            apply()
            window.setTimeout(() => {
                delete d.dataset.sideFade
                delete d.dataset.sideAnim
            }, WIDTH_MS)
        }, LABELS_FADE_MS)
    } else {
        apply()
        window.setTimeout(() => {
            delete d.dataset.sideFade
            delete d.dataset.sideAnim
        }, WIDTH_MS)
    }
}
