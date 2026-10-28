'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { dayLabel, heatmapSummary, type HeatDay, type Heatmap } from '@/lib/activity-heatmap'

const RANGE = new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric', timeZone: 'UTC' })

function rangeLabel(from: string, to: string) {
    const f = (d: string) => RANGE.format(new Date(`${d}T00:00:00Z`)).replace('.', '')
    return `${f(from)} – ${f(to)}`
}

interface Props {
    map: Heatmap
    /** Encima del mapa: las cifras clave (tiles). */
    header?: ReactNode
    /** Pie: a la derecha de la leyenda (notas, enlaces). */
    footer?: ReactNode
    /** Ilustración estática (portada sin sesión): sin tooltip ni teclado, oculta a lectores de pantalla. */
    preview?: boolean

    // ── Modo «año» (historial de logros): todo opcional; sin estas props, el mapa del Inicio de siempre ──
    /** Clase extra de la sección. */
    className?: string
    /** id del título visible (en `header`); sin él, un título oculto «Actividad del último año». */
    labelledBy?: string
    /** aria-label del mapa (el único tab-stop). */
    gridLabel?: string
    /** Clase extra del mapa (p. ej. `is-spot` para apagar todo menos una racha). */
    gridClass?: string
    /** Clases y variables de cada casilla (seleccionada, racha…). */
    decorate?: (day: HeatDay) => { className?: string; style?: CSSProperties } | undefined
    /** Texto del día para el anuncio del teclado (por defecto, `dayLabel`). */
    describe?: (day: HeatDay) => string
    /** Contenido del tooltip (por defecto, el mismo texto de `describe`). */
    renderTip?: (day: HeatDay) => ReactNode
    /** Casillas pulsables: clic, Intro o espacio sobre un día que ya ha llegado. */
    onPick?: (day: HeatDay) => void
    /** Día en el que empieza el recorrido con el teclado (por defecto, el último). */
    focusDay?: string | null
    /** Letras de los días de la semana a la izquierda (L, X, V, D). */
    weekdays?: boolean
    /** Rango de fechas en el pie (por defecto, sí). */
    range?: boolean
    /** Dónde abre el mapa si se desplaza en horizontal (por defecto, al final: lo más reciente). */
    startAt?: 'start' | 'end'
    /** Leyenda propia en lugar de «menos … más» (JUDI: acertado, fallado…). */
    legend?: ReactNode
    /** Resumen para lectores de pantalla en lugar del de horas y logros. */
    summary?: string
}

interface Tip {
    index: number
    x: number
    y: number
}

const LEVELS = [0, 1, 2, 3, 4] as const
const WEEKDAYS = ['L', '', 'X', '', 'V', '', 'D']

/**
 * Mapa de actividad anual (estilo GitHub). Las celdas no son tab-stops: el mapa entero es un único elemento
 * enfocable que se recorre con las flechas (y anuncia el día), con un resumen textual para lectores de pantalla.
 * Con el ratón, tooltip al pasar por encima. En modo «año» (historial) las casillas se pueden pulsar.
 */
export default function ActivityHeatmap({
    map,
    header,
    footer,
    preview = false,
    className,
    labelledBy,
    gridLabel = 'Días del último año. Usa las flechas para recorrerlos.',
    gridClass,
    decorate,
    describe = dayLabel,
    renderTip,
    onPick,
    focusDay,
    weekdays = false,
    range = true,
    startAt = 'end',
    legend,
    summary,
}: Props) {
    const id = useId()
    const scrollRef = useRef<HTMLDivElement>(null)
    const gridRef = useRef<HTMLDivElement>(null)
    const monthsRef = useRef<HTMLDivElement>(null)
    const [tip, setTip] = useState<Tip | null>(null)
    const [active, setActive] = useState<number | null>(null)
    const walkable = (d: HeatDay) => !d.future && !d.out
    const firstDay = Math.max(0, map.days.findIndex(walkable))
    const lastDay = map.days.findLastIndex(walkable)
    const todayIndex = map.hasToday === false ? -1 : lastDay

    // En pantallas estrechas el mapa se desplaza en horizontal: se empieza por lo más reciente.
    // La etiqueta de un mes que queda cortada por el borde izquierdo se oculta (si no, se lee «ay» por «may»).
    useLayoutEffect(() => {
        const el = scrollRef.current
        const months = monthsRef.current
        if (!el || !months) return
        const clipMonths = () => {
            const edge = el.getBoundingClientRect().left
            for (const label of months.children as HTMLCollectionOf<HTMLElement>) {
                label.style.visibility = label.getBoundingClientRect().left < edge ? 'hidden' : ''
            }
        }
        el.scrollLeft = startAt === 'end' ? el.scrollWidth : 0
        clipMonths()
        el.addEventListener('scroll', clipMonths, { passive: true })
        window.addEventListener('resize', clipMonths)
        return () => {
            el.removeEventListener('scroll', clipMonths)
            window.removeEventListener('resize', clipMonths)
        }
    }, [startAt])

    // El tooltip es `fixed`: si la página se desplaza, se oculta en vez de quedarse descolocado.
    useEffect(() => {
        if (!tip) return
        const hide = () => setTip(null)
        window.addEventListener('scroll', hide, { passive: true, capture: true })
        window.addEventListener('resize', hide)
        return () => {
            window.removeEventListener('scroll', hide, { capture: true })
            window.removeEventListener('resize', hide)
        }
    }, [tip])

    function tipFor(index: number): Tip | null {
        const cell = gridRef.current?.children[index] as HTMLElement | undefined
        if (!cell) return null
        const r = cell.getBoundingClientRect()
        // Sin salirse por los lados de la ventana (el texto mide ~180 px).
        const x = Math.max(100, Math.min(window.innerWidth - 100, r.left + r.width / 2))
        return { index, x, y: r.top }
    }

    function cellAt(target: EventTarget): number | null {
        const cell = (target as HTMLElement).closest<HTMLElement>('[data-i]')
        return cell ? Number(cell.dataset.i) : null
    }

    function onPointerMove(e: PointerEvent<HTMLDivElement>) {
        if (e.pointerType !== 'mouse') return
        const index = cellAt(e.target)
        if (index === null || !walkable(map.days[index])) return setTip(null)
        if (tip?.index !== index) setTip(tipFor(index))
    }

    function onClick(e: MouseEvent<HTMLDivElement>) {
        const index = cellAt(e.target)
        if (index === null || !walkable(map.days[index])) return
        setActive(index)
        onPick?.(map.days[index])
    }

    function move(index: number) {
        const next = Math.max(firstDay, Math.min(lastDay, index))
        setActive(next)
        setTip(tipFor(next))
        // Que el día activo se vea si el mapa se desplaza en horizontal.
        ;(gridRef.current?.children[next] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }

    function startIndex(): number {
        const i = focusDay ? map.days.findIndex((d) => d.date === focusDay) : -1
        return i >= 0 && walkable(map.days[i]) ? i : lastDay
    }

    function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
        const current = active ?? startIndex()
        const step: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }
        if (e.key in step) move(current + step[e.key])
        else if (e.key === 'Home') move(firstDay)
        else if (e.key === 'End') move(lastDay)
        else if (e.key === 'Escape') setTip(null)
        else if (onPick && (e.key === 'Enter' || e.key === ' ')) onPick(map.days[current])
        else return
        e.preventDefault()
    }

    const style = { '--weeks': map.weeks } as CSSProperties
    const shown = tip ? map.days[tip.index] : null
    const announced = active !== null ? describe(map.days[active]) : ''
    const interactive = onPick ? { onClick } : {}

    return (
        <section
            className={['heat glass', preview && 'heat--preview', className].filter(Boolean).join(' ')}
            aria-labelledby={preview ? undefined : (labelledBy ?? `${id}-title`)}
            aria-hidden={preview || undefined}
        >
            {!preview && !labelledBy && (
                <h2 id={`${id}-title`} className="sr-only">
                    Actividad del último año
                </h2>
            )}
            {header}

            <div className="heat__scroll" ref={scrollRef}>
                <div className={weekdays ? 'heat__body heat__body--wd' : 'heat__body'} style={style}>
                    {weekdays && (
                        <div className="heat__wd" aria-hidden>
                            {WEEKDAYS.map((w, i) => (
                                <span key={i}>{w}</span>
                            ))}
                        </div>
                    )}
                    <div
                        ref={gridRef}
                        className={['heat__grid heat__grid--paint', onPick && 'heat__grid--pick', gridClass].filter(Boolean).join(' ')}
                        {...(preview
                            ? {}
                            : {
                                  tabIndex: 0,
                                  role: 'group',
                                  'aria-roledescription': 'mapa de actividad',
                                  'aria-label': gridLabel,
                                  'aria-describedby': `${id}-summary`,
                                  onKeyDown,
                                  onFocus: () => setActive((a) => a ?? startIndex()),
                                  onBlur: () => {
                                      setActive(null)
                                      setTip(null)
                                  },
                                  onPointerMove,
                                  onPointerLeave: () => active === null && setTip(null),
                                  ...interactive,
                              })}
                    >
                        {map.days.map((d, i) => {
                            const extra = decorate?.(d)
                            return (
                                <i
                                    key={d.date}
                                    data-i={i}
                                    data-l={d.level}
                                    aria-hidden
                                    // Semana de la casilla: el mapa se pinta de la más antigua a hoy al llegar.
                                    style={{ '--w': Math.floor(i / 7), ...extra?.style } as CSSProperties}
                                    className={
                                        [
                                            d.future && 'is-future',
                                            d.out && 'is-out',
                                            d.achievements > 0 && 'has-n',
                                            i === active && 'is-active',
                                            i === todayIndex && 'is-today',
                                            extra?.className,
                                        ]
                                            .filter(Boolean)
                                            .join(' ') || undefined
                                    }
                                />
                            )
                        })}
                    </div>
                    <div ref={monthsRef} className="heat__months" aria-hidden>
                        {map.months.map((m) => (
                            <span key={m.week} style={{ gridColumnStart: m.week + 1 }}>
                                {m.label}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="heat__foot">
                {legend ?? (
                    <span className="heat__legend" aria-hidden>
                        menos
                        {LEVELS.map((l) => (
                            <i key={l} data-l={l} />
                        ))}
                        más
                    </span>
                )}
                {range && <span>{rangeLabel(map.from, map.to)}</span>}
                {footer}
            </div>

            {!preview && (
                <>
                    <p id={`${id}-summary`} className="sr-only">
                        {summary ?? heatmapSummary(map)}
                    </p>
                    <p className="sr-only" aria-live="polite">
                        {announced}
                    </p>
                </>
            )}
            {shown && tip && (
                <div className="heat__tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
                    {renderTip ? renderTip(shown) : describe(shown)}
                </div>
            )}
        </section>
    )
}
