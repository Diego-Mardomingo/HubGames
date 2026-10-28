# Guía de estilo de HubGames

Dirección «Panel de actividad»: una herramienta para consultar tu biblioteca y tus logros, no un escaparate. Esta guía resume el sistema aplicado; la fuente de verdad son los tokens de `src/styles/globals.css`.

## Principios

- **Superficies planas.** Fondo, superficie y borde fino. Nada de cristal (`backdrop-filter`), degradados decorativos, brillos, auroras ni sombras de color.
- **Un acento para actuar, colores para entender.** El cobalto (`--primary`) es para acciones, selección y progreso. El resto del color siempre significa algo y se reconoce de un vistazo: **cada lista de la biblioteca** (estados y marcas), **las puntuaciones** (Metacritic, reseñas, tu nota), **el mínimo histórico** de un precio y **las rarezas** de los logros. Nada de color decorativo.
- **Minimalismo con tinte.** El color va como texto o icono sobre su propio fondo al 12–14 % (`.hg-tint`), en franjas finas o en bordes; nunca en bloques saturados. La única excepción es el mínimo histórico, en amarillo sólido para que salte a la vista.
- **Portadas pequeñas.** Cápsula de Steam (`header.jpg`) a ~112×52 px y radio pequeño en listas y rejillas. La imagen grande solo en la ficha de un juego (`/juego/[appid]`).
- **Cursor de selección.** Las filas y tarjetas clicables muestran `box-shadow: 0 0 0 3px var(--cursor)` con el ratón o el foco de teclado. Es la firma de la interfaz.
- **Microanimaciones con peso.** Navegar tiene que sentirse vivo: cada acción tiene respuesta (chip que cambia de color, check que se dibuja, fila que se va a su lista), los indicadores activos se deslizan, las cifras cuentan y las barras se rellenan al llegar, y las filas entran con un escalonado muy corto. Siempre cortas, sutiles y sin bloquear; celebración solo en los momentos que lo merecen (completar, 100 %, legendario, acierto en JUDI). `prefers-reduced-motion` lo anula todo, también los retrasos (`animation-delay: 0s`), para que nada se quede oculto esperando a entrar (regla global al final de `globals.css`). Detalle en `docs/rediseno-color.md`, sección «Microanimaciones».
- **Texto sobrio.** Español, frases cortas, mayúscula solo inicial. Sin etiquetas en MAYÚSCULAS con tracking, sin «eyebrows», sin numeraciones decorativas ni «→» en cada enlace. Botones con verbo concreto.
- **Accesible en los dos temas.** Texto ≥ 4,5:1, foco visible, objetivos táctiles ≥ 44 px en móvil, botones-icono con `aria-label`, y nada que dependa solo del color (la rareza va siempre con su nombre o su %).

## Color

Claro en `:root`, oscuro en `[data-theme='dark']` (lo pone `themeScript` de `src/lib/theme.ts` antes de pintar; el selector es `ThemeToggle`). **No escribas colores a mano**: usa siempre variables.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--background` | `#eef0f3` | `#15171c` | fondo de página |
| `--surface` | `#ffffff` | `#1e2129` | tarjetas, filas, paneles |
| `--surface-2` | `#e4e7ec` | `#282c36` | rellenos suaves, pistas de barras, hover |
| `--surface-3` | `#d6dae1` | `#323744` | rellenos más marcados (interruptor apagado) |
| `--foreground` | `#1b1f27` | `#e8eaee` | texto |
| `--muted` | `#5d6472` | `#9aa1ae` | texto secundario |
| `--border` / `--border-hover` | `#dadde3` / `#c3c8d1` | `#2e323c` / `#404553` | bordes finos |
| `--primary` / `--primary-hover` | `#2453ff` / `#1a43e0` | `#7b9bff` / `#95afff` | acento |
| `--primary-foreground` | `#ffffff` | `#0e1220` | texto sobre el acento |
| `--primary-glow` | cobalto 12 % | cobalto 14 % | fondo de chip o pestaña activa |
| `--cursor`, `--ring` | = `--primary` | = `--primary` | cursor de selección y foco |
| `--success` | `#1a7743` | `#4cc97e` | completado, correcto |
| `--danger` / `--danger-foreground` | `#c7243b` / `#ffffff` | `#f26b7e` / `#1b0a0d` | errores, acciones destructivas |
| `--warning` | `#8e5e18` | `#f2b53a` | avisos |
| `--success-glow`, `--danger-glow` | 10 % | 14 % | fondo de alertas |
| `--scrim` | negro frío 55 % | negro 65 % | velo bajo diálogos |
| `--shadow-sm`, `--shadow-lg` | neutras | neutras | segmento activo; menús y diálogos |
| `--on-done` | `#ffffff` | `#0b1f13` | texto sobre `--st-completado` sólido (botón «Completar») |

Contraste medido (WCAG): `--muted` ≥ 4,8:1 sobre `--background`, `--surface` y `--surface-2` en claro (≥ 5,4:1 en oscuro); `--primary`, `--success`, `--danger` y `--warning` ≥ 4,5:1 sobre los tres fondos y sobre su propio `-glow`; el texto sobre `--primary` y `--danger` ≥ 5,5:1.

### Excepciones a «sin colores a mano»

- Imagen OG del resumen anual (`src/app/api/estadisticas/resumen/imagen/route.tsx`): `ImageResponse` no admite variables; usa los valores del tema oscuro.
- `themeColor` de `src/app/layout.tsx` (metadato del navegador): valores de `--background`.
- Velos oscuros sobre capturas y texto `#fff` encima (JUDI: insignia y pista sobre la captura, zoom), y el fondo `#000` del vídeo del tráiler.
- `#fff` sobre color sólido (bola del interruptor) y el logo de Google con sus colores de marca.
- Colores de reserva del confeti de JUDI (lee las variables y solo usa el valor escrito si fallan).

## Listas de la biblioteca

Un juego tiene **un estado** y puede tener además **marcas**, que se suman al estado (un juego puede estar «Completado» y ser «Favorito» y «Sin final» a la vez). Cada lista tiene su icono (`LIST_ICONS` en `src/components/tracker/status.tsx`) y su color, iguales en el raíl, la franja de la fila, el chip, el selector de la ficha y la bandeja.

| Lista | Tipo | Token | Claro | Oscuro | Icono |
|---|---|---|---|---|---|
| Bandeja | estado (sin clasificar) | `--st-bandeja` | `#5d6472` | `#9aa1ae` | bandeja, borde discontinuo |
| Pendiente | estado | `--st-pendiente` | `#0b7285` | `#3bc9db` | marcador |
| Jugando | estado | `--st-jugando` | `#2453ff` | `#7b9bff` | play |
| Pausado | estado | `--st-pausado` | `#8e5e18` | `#f2b53a` | pausa |
| Rejugable | estado | `--st-rejugable` | `#9c3c08` | `#ff9a5c` | flechas en bucle (`Repeat`) |
| Completado | estado | `--st-completado` | `#1a7743` | `#4cc97e` | bandera |
| Abandonado | estado | `--st-abandonado` | `#c7243b` | `#f26b7e` | círculo con aspa |
| Ya jugado | estado | `--st-yajugado` | `#5c5b06` | `#d2cf5c` | reloj con flecha atrás (`History`) |
| Descartado | estado | `--st-descartado` | `#6b7280` | `#8a919e` | ojo tachado |
| Otros | estado | `--st-otros` | `#931f8f` | `#eb84f8` | formas (`Shapes`) |
| Favorito | marca | `--st-favorito` | `#c2255c` | `#f783ac` | corazón |
| Sin final | marca | `--st-sinfinal` | `#6741d9` | `#b197fc` | infinito |

- Clases: `st-<lista>` pone `--c` (`st-todos` usa el acento) y `.hg-tint` lo pinta como texto sobre su fondo tenue (`--tint`: 12 % en claro, 14 % en oscuro). Componentes: `StatusChip` y `MarkFlags`.
- **Pendientes sin comprar** (añadidos desde el buscador o la ficha, `owned = false`): portada desaturada con borde discontinuo cian, etiqueta «Sin comprar» y precio en lugar de logros. Los comprados llevan «Comprado».
- El estado nunca va solo con el color: siempre con su icono y su nombre.
- **Ya jugado** (oliva): jugados antes de HubGames o sin seguimiento, ni completados ni abandonados. **Otros** (fucsia): lo que no encaja en ninguna lista (software, demos, betas, bandas sonoras). Los dos son estados cerrados: no cuentan como completados (estadísticas, metas, rachas), no salen en «Qué jugar» y las reglas automáticas no los tocan. «Otros» tampoco sale en «Todos», como los descartados. En la bandeja son las teclas 7 y 9.
- Contraste de los dos (texto sobre `--background` / `--surface` / `--surface-2`, y sobre su tinte encima de cada uno): Ya jugado claro 6,23 / 7,11 / 5,73 (tinte 5,25 / 5,94 / 4,86), oscuro 10,95 / 9,83 / 8,53 (tinte 8,09 / 7,13 / 6,17); Otros claro 6,49 / 7,41 / 5,98 (tinte 5,34 / 6,06 / 4,94), oscuro 7,85 / 7,04 / 6,11 (tinte 6,19 / 5,48 / 4,76).
- **Rejugable** (naranja teja): juegos vivos de partidas sueltas, sin un final que perseguir, a los que vuelves de vez en cuando (CS2, Project Zomboid, Path of Exile 2). Es una lista activa: sale en «Todos» y en el raíl va justo después de Pausado. No cuenta como completado (estadísticas, metas, rachas), pero sus horas sí cuentan como las de cualquier juego. Es un estado estable: echar una partida no lo pasa a Jugando ni genera sugerencias («¿Lo has terminado?», «¿Lo pausas?»), y la sincronización con Steam no lo toca. En «Qué jugar» solo entra con «Menos de 1 h», con el motivo «Para una partida rápida», y nunca en «Terminar algo». Su lista se ordena por defecto por «Jugado recientemente» y no tiene filtro de nota (la nota se pone al completar). En la bandeja es la tecla 4. El selector de estado de la ficha es una rejilla de 5 × 2 (2 columnas en móvil). La marca **Sin final** sigue siendo independiente: se suma a cualquier estado.
- Contraste de Rejugable: claro 6,00 / 6,86 / 5,53 (tinte 5,01 / 5,68 / 4,64), oscuro 8,56 / 7,69 / 6,67 (tinte 6,67 / 5,90 / 5,12). Se distingue de Pausado (ámbar, más amarillo y apagado) y de Abandonado (rojo carmín) por tono: queda a medio camino, más saturado que el ámbar.

## Puntuaciones y precios

`src/lib/scores.ts` decide el nivel; el texto («Aclamado», «Muy positivas») va siempre al lado.

| Nivel | Token | Claro | Oscuro | Metacritic | Reseñas de Steam | Tu nota |
|---|---|---|---|---|---|---|
| Muy bien | `--sc-top` | `#1a7743` | `#4cc97e` | ≥ 75 | ≥ 80 % | ≥ 9 |
| Bien | `--sc-good` | `#4d7c0f` | `#a9d15b` | — | 70–79 % | ≥ 7 |
| Regular | `--sc-mid` | `#8e5e18` | `#f2b53a` | 50–74 | 40–69 % | ≥ 5 |
| Mal | `--sc-bad` | `#c7243b` | `#f26b7e` | < 50 | < 40 % | < 5 |

- **Tu nota en palabras** (`ratingLabel` y `RATING_LABELS` en `src/lib/scores.ts`, mismos umbrales que su color): *Imprescindible* ≥ 9, *Muy bueno* ≥ 7, *Correcto* ≥ 5, *Flojo* < 5. Sin nota, «—» en `--muted`. Para reutilizar en la ficha, la biblioteca y las estadísticas.
- **Descuento**: `-40 %` tintado en `--sc-top`.
- **Mínimo histórico** (`.hg-deal`, `.juego-verdict--deal`): `--deal` amarillo sólido (`#f5c400` / `#ffd43b`) con `--deal-foreground` oscuro encima, en los dos temas. Es lo más llamativo de un precio.
- **Rebajado pero ha estado más barato**: tinte `--sc-mid`. **Precio normal**: neutro.

## Rarezas de logros

Según el porcentaje global de jugadores que lo tienen (`src/lib/rarity.ts`, con `rarityTier`, `RARITY_TIER_LABELS` y `rarityColor`):

| Nivel | Umbral | Token | Claro | Oscuro |
|---|---|---|---|---|
| Común | ≥ 40 % | `--rar-comun` | `#8a8f98` | `#9aa0aa` |
| Poco común | < 40 % | `--rar-poco` | `#2e9e5b` | `#4cc97e` |
| Rara | < 15 % | `--rar-rara` | `#2f6fe0` | `#5b93ff` |
| Épica | < 5 % | `--rar-epica` | `#8b4fd8` | `#b07cff` |
| Legendaria | < 1 % | `--rar-leg` | `#c98a0b` | `#f2b53a` |

- Como relleno (franja de la fila, borde izquierdo del logro, puntos, barras) se usa el token tal cual.
- Como **texto o icono** se mezcla con el texto (clase `.rar-ink`): `color-mix(in srgb, var(--c) var(--rar-ink), var(--foreground))`. `--rar-ink` vale 62 % en claro (llega a ≥ 4,5:1 incluso para común y legendaria) y 100 % en oscuro.
- La rareza nunca va sola: siempre con su nombre («Épica») o su porcentaje.
- La dificultad de un logro reutiliza la escala (fácil = común … muy difícil = legendaria); las medallas de ranking y perfil, legendaria y común.

## Tipografía

Una sola familia: **Onest** (`--font-body`, cargada con `next/font`). Los números usan cifras tabulares (`font-variant-numeric: tabular-nums` en `body`); no hay monoespaciada.

| Uso | Tamaño | Peso |
|---|---|---|
| Título de página (`.page-title`) | `clamp(1.625rem, 2.6vw, 2rem)`, tracking −0,02em | 700 |
| Título de sección | 1–1,0625rem | 600–700 |
| Cifra destacada | 1,125–1,75rem | 700 |
| Texto de lectura | 0,9375rem | 400 |
| Texto de interfaz (filas, botones) | 0,875rem | 500–600 |
| Secundario (meta, ayudas) | 0,8125rem | 400–500 |
| Pequeño (chips, ejes, leyendas) | 0,6875–0,78125rem | 500–600 |

## Espaciado, radios y layout

- Radios: `--radius-sm` 8px (botones, campos, cápsulas), `--radius` 10px (filas), `--radius-lg` 14px (paneles `.glass`), `--radius-xl` 18px (contenedores grandes). Pastillas y chips: 999px.
- Espaciado en múltiplos de 4px; huecos habituales de 8, 12, 16 y 24px entre filas, bloques y secciones.
- Layout: barra lateral fija (`--side-w`: 232px, 72px por debajo de 1100px o si el usuario la pliega), barra superior y barra de pestañas inferior por debajo de 768px. Contenido en `#main-content`, máximo 1200px.

## Componentes compartidos

| Pieza | Dónde | Notas |
|---|---|---|
| Tokens, botones (`.hg-button`, `.hg-btn--primary/secondary/danger`), campos (`.hg-input`, `.field*`), `.alert--error/ok`, `.switch`, `.link`, `.glass`, `.page-head/title/subtitle`, loader, pantallas de acceso y mantenimiento | `src/styles/globals.css` | `components/ui/button.tsx` aplica las clases |
| Barra lateral, barra superior y pestañas móviles | `src/components/Nav.tsx`, `src/styles/nav.css` | Grupos con título («Tu colección», «Juego diario», «Administración»). El cobalto solo marca el elemento activo (superficie + barra de 3 px que se desliza con `layoutId`, icono en acento que rebota); avatar neutro salvo en el perfil. La barra es un contenedor: a 72 px pasa a solo iconos con `@container nav-side`. En móvil, como mucho 6 pestañas (Admin va a la barra superior) |
| Indicadores de la navegación (`.nav-ind`) | `src/styles/nav.css`, `src/lib/nav-status.ts` | Bandeja con el color de su lista (`.hg-tint.st-bandeja`, borde discontinuo), mínimos de la wishlist en `--deal` sólido y JUDI de hoy («Hoy» `--warning`, «Acertado» `--success`, «Fallado» `--danger`). Siempre icono + cifra o palabra; en la barra plegada y en las pestañas, insignia en la esquina del icono |
| Barra lateral plegable (≥ 1100 px) | `src/lib/sidebar.ts` (`sidebarScript`, `setSidebarCollapsed`), botón `.nav-collapse` | Preferencia en `localStorage` (`hg-sidebar`) aplicada antes de pintar con `data-side="collapsed"` en `<html>`, como el tema. Al plegar, las etiquetas se desvanecen (150 ms) y luego cambia el ancho (220 ms); al desplegar, al revés |
| Contador que salta | `src/components/AnimatedCount.tsx`, `.hg-count*` en `src/styles/lists.css` | Pop de la cápsula (300 ms) y cifra que entra desde abajo si sube o desde arriba si baja (220 ms); no se anima al montar. Para contadores de raíl, bandeja y tiles |
| Cifra que cuenta | `src/components/CountUp.tsx` | Cuenta desde 0 al llegar (450 ms, ease-out) y luego salta como `AnimatedCount`; valor final para lectores de pantalla y en el servidor. Decimales y sufijo («h») como props. Tiles, atajos de listas, racha de JUDI |
| Tiles de cifras (`.hg-tiles`, `.hg-tile*`) | `src/components/Tile.tsx`, `src/styles/lists.css` | Baldosa con icono tintado del color de lo que cuenta (`tone`: `st-*`, `sc-*`), etiqueta, valor y nota. Ficha e Inicio; 2 columnas por debajo de 860 px |
| Entrada con intención | `.hg-enter`, `.hg-bar--fill`, `.hg-rar-flash`, `.hg-pop-in`, `.hg-draw`, `.hg-beat` en `src/styles/lists.css` | `--i` = posición: 30 ms entre elementos y solo los 8 primeros. Bloques que suben 8 px y aparecen (320 ms), barras que se rellenan con `scaleX` (450 ms), destello del color de la rareza en logros épicos y legendarios (900 ms), pop de elementos pequeños (260 ms), trazo que se dibuja (300 ms) y corazón que late al marcar (400 ms). Solo CSS: se ven al montar, no al refrescar datos |
| Segmentado con fondo deslizante | `.hg-seg--slide`, `.hg-seg__thumb`, `.hg-seg__text` en `src/styles/lists.css` | El fondo activo es un `motion.span` con `layoutId` dentro de la opción activa (220 ms) |
| Filas de lista (`.lib-row` y franja, `.lib-row__name`, `.lib-meta`, `.lib-cover-tag`, `.is-unowned`) | `src/styles/lists.css` | Compartidas por Biblioteca e Inicio; el tamaño de columnas va en la CSS de cada página |
| Atajo del buscador | `src/components/tracker/SearchShortcut.tsx` | Siempre «Ctrl + K» (o «⌘ + K» en Mac), con espacios alrededor del «+» |
| Buscador de juegos (Ctrl + K) | `src/components/tracker/GameSearch.tsx`, `.game-search*` en `tracker.css`, `src/lib/game-search.ts` | Resultados con franja y `StatusChip` de su lista, `MarkFlags`, horas, Metacritic y reseñas con color y `PriceTag`. Antes de escribir, 3 recientes (`localStorage`, `hg-search-recent`) y los de la wishlist en mínimo (`loadWishlistDeals`, la misma lista que el indicador de la navegación). Abre escalando desde el centro (200 ms), resultados con entrada escalonada (180 ms, 20 ms entre filas), resaltado que se desliza con `layoutId` (180 ms) y botón que pasa al color de Pendientes con check que se dibuja |
| Diálogo «Completar juego» | `src/components/tracker/CompleteDialog.tsx`, `.complete-*` en `tracker.css`, `src/lib/completion.ts` | Franja superior y botón «Completar» en `--st-completado` (texto `--on-done`). Cabecera con cápsula, chip, horas frente a la historia (mini barra, verde al pasarla) y logros con anillo (verde al 100 %). Nota con **diez puntos con medios** (`role="slider"`): cifra, palabra y puntos con el color de `ratingTier`, puntos que se encienden en cadena (pop 300 ms, 22 ms entre puntos), cifra que entra desde abajo o arriba (200 ms), vista previa tenue con el ratón; en táctil se arrastra o se toca (otro toque en el mismo punto quita medio). Teclas: flechas y +/- ±0,5, cifra = esa nota, Supr sin nota, Intro guarda. Marcas Favorito y Sin final como interruptores con su color (el corazón late). Fecha con chips de sugerencia, reseña plegada. **Celebración** (la de la web): anillo que se cierra, bandera que cae y se planta y 12 chispas con los colores de Completado, tu nota y Favorito, «¡Completado!» con nota y horas (≈ 1,1 s; un clic o una tecla la cortan). En lote, versión corta (≈ 0,65 s, sin chispas) y el siguiente entra desde la derecha (260 ms); el último, completa con resumen. Editar uno completado: «Guardar cambios» con check que se dibuja, sin celebración. Sin celebración con movimiento reducido. En móvil (≤ 640 px), hoja inferior con el pie fijo, botones de 48 px y controles de 44 px |
| Bandeja (`/biblioteca/bandeja`) | `src/app/biblioteca/bandeja/*`, `.tray-*` en `biblioteca.css`, `src/lib/tray.ts` | Nueve destinos como botones-icono en tres grupos (teclas 1–9 en el orden de `GAME_STATUSES`: 1 Pendiente … 9 Otros) y destino sugerido con borde discontinuo de su color (`suggestDestination`, nunca clasifica solo). Vista previa del destino en la fila (franja y chip «→ Destino»), salida teñida y deslizada (200 + 240 ms, 30 ms entre filas) con ficha que vuela a «Biblioteca» en la navegación, Deshacer 5 s (y Ctrl + Z) con `restoreGames`, «En esta visita» con reparto apilado, barra de lotes que sube desde abajo y bandeja vacía con celebración solo si se ha vaciado en la visita. En móvil, sugerido + «Clasificar» que abre una hoja inferior (`SheetContent side="bottom"`) |
| Resumen de logros (`/logros`) | `src/app/logros/LogrosView.tsx`, `src/components/achievements/Milestones.tsx`, `GameLine.tsx`, `.lg-*` en `achievements.css` | Cuatro tiles (puntos en cobalto, logros en Sin final, juegos al 100 % en Completado y el más raro con su rareza, que destella) con lo de este mes; puntuación de cazador con barra apilada por rareza que crece (600 ms, `clip-path`) y una celda por rareza (cuántos, puntos y umbral; en móvil, lista con franja) y top 5 con barra relativa; **hitos en series** (logros, juegos al 100 %, rarezas) con todos los escalones como nodos: alcanzados encendidos en orden (pop 360 ms, 110 ms entre nodos), línea hasta donde vas (`seriesProgress`) y el siguiente con borde discontinuo. Secciones con icono tintado: Cerca del 100 % y Juegos al 100 % en Completado, Logros fáciles en cobalto, Olvidados en Pausado y Más raros en Legendaria. Filas de juego con franja, `StatusChip` y `MarkFlags`; vacíos con icono, frase y acción; sello «100 %» en `--st-completado` con `--on-done` que salta (`.hg-pop-in`). `.hg-enter.hg-rar-flash` combina entrada y destello |
| Filas de juego (`.hg-row`, cápsula, barra `.hg-bar`, `.hg-chip`), logros (`.hg-ach`), control segmentado (`.hg-seg`), cabeceras de lista (`.hg-section`), pista de teclado (`.hg-keyhint`), tarjetas pequeñas (`.hg-card`), `.hg-icon-btn` | `src/styles/lists.css` | El cursor de selección vive aquí |
| Diálogo, sheet, popover, select, pestañas, tooltip, badge, calendario | `src/styles/ui.css` + `src/components/ui/*` | Primitivas de Radix con CSS propio |
| Lista navegable con ↑/↓ o j/k | `src/components/KeyboardList.tsx` | Las filas marcan su enlace con `data-row-link` |
| Selector de tema | `src/components/ThemeToggle.tsx`, `src/lib/theme.ts` | Claro, oscuro o sistema (`hg-theme` en `localStorage`) |
| Marca | `src/components/brand/Logo.tsx` (`LogoMark`, `Wordmark`, `Logo`) | H y G como barra (70 %) y anillo de progreso; se rellenan al entrar, en bucle en el loader y la barra se completa al pasar el ratón |
| Mapa de actividad anual | `src/components/dashboard/ActivityHeatmap.tsx` | Escala del acento sobre `--surface-2`; un único tab-stop recorrible con flechas |
| Rarezas | `src/lib/rarity.ts` | Nivel, nombre y color a partir del % global |

Tailwind 4 está activo **sin preflight** (solo `theme.css` y `utilities.css` en `globals.css`); se usa poco, sobre todo en `components/ui`. Para estilos nuevos, preferir el CSS propio junto a la página o los componentes compartidos de arriba.

## Reglas de uso

1. Antes de crear una clase, busca si ya existe en `lists.css`, `ui.css` o `globals.css`.
2. Portada grande solo en la ficha; en el resto, cápsula pequeña.
3. Un solo acento para actuar. Todo color nuevo debe significar algo y salir de los tokens de arriba (listas, puntuaciones, precio, rarezas): no inventes colores ni pintes con las rarezas cosas que no sean logros.
4. Filas y tarjetas clicables: enlace principal extendido a toda la fila (`::after`) y cursor de selección en hover y `:focus-visible`/`:focus-within`.
5. Sin mayúsculas forzadas, degradados, cristal ni glows. Las sombras, neutras y solo para lo que flota (menús, diálogos, segmento activo).
6. Movimiento con intención: 120–250 ms para respuestas, 250–450 ms para entradas y cambios de vista, hasta ~1 s solo en celebraciones; `--ease-out` o muelles sin rebote exagerado; solo `transform`/`opacity` (y trazos, recortes, colores); escalonados de ≤ 30 ms y solo en los primeros elementos; anulado con `prefers-reduced-motion`. Las animaciones que se repiten (contador, barra que se rellena, indicador deslizante, entrada de filas) son compartidas.
7. En móvil, todo lo interactivo mide al menos 44 px (si el control se ve más pequeño, amplía su área con un pseudo-elemento, como en `.hg-button` o `.switch`).
8. Comprueba cada cambio en claro y oscuro, a 1440, ~1000 y 390 px.
