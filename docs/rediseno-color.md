# Rediseño con color: trasladar Biblioteca y Ficha al resto de la web

## Qué estamos haciendo

En el PR #75 (`7e1ef8f`, «listas con color, marcas, pendientes sin comprar y ficha rediseñada») rediseñamos **la Biblioteca** (`/biblioteca`) y **la ficha de juego** (`/juego/[appid]`). Pasaron de ser páginas sobrias y casi monocromas a usar **color con significado**: cada lista, cada puntuación, cada precio y cada rareza tiene su color, su icono y su nombre. El resultado es que la página se entiende de un vistazo, antes de leer nada: ves qué está en curso, qué está abandonado, qué juego está bien valorado o qué precio es un chollo solo por el color.

Ahora queremos llevar ese mismo lenguaje a **todas las páginas que puede ver el usuario**, y a la vez darle **peso a las microanimaciones**: que navegar por la web se sienta vivo, que cada acción tenga respuesta y que los cambios de página, pestaña o filtro se vean fluidos. Este documento es la lista de trabajo: una checklist con cada página, lo que tiene hoy y qué se le puede aplicar.

> El rediseño anterior (fases 1–6, PR #73) ya dejó toda la web con los tokens, la tipografía Onest, la barra lateral, el tema claro/oscuro y los componentes planos. **No hay que rehacer eso.** Lo que falta es la capa de color con significado, la jerarquía visual que tienen ahora Biblioteca y Ficha y la capa de movimiento (ver «Microanimaciones»).

## Cómo se trabaja (léelo antes de empezar)

Lo hace un agente, **página a página**, en este orden:

1. **Coge el siguiente elemento sin marcar** de la checklist (en el orden en que aparecen, salvo que el usuario diga otro).
2. **Estudia la referencia y la página.** Abre `/biblioteca` y `/juego/[appid]` (y sus CSS) para ver el lenguaje visual, y lee el código de la página que toca.
3. **Haz un mockup**, no la implementación. Un HTML estático autocontenido en `docs/mockups/<pagina>.html` que:
   - use **los tokens reales** de `src/styles/globals.css` (copia las variables al `<style>` del mockup) y la fuente Onest;
   - muestre **tema claro y oscuro** (un botón que cambie `data-theme` en `<html>`, o las dos versiones una al lado de otra);
   - muestre **escritorio (1440 px) y móvil (390 px)**;
   - use datos realistas (nombres de juegos de verdad, horas, porcentajes), incluidos los casos límite: vacío, un solo elemento, textos largos;
   - **tenga las microanimaciones funcionando** (hover, foco, clic, cambio de pestaña o filtro, entrada de la página, contadores…) para que se puedan probar, con un botón «Repetir entrada» si hay animación de entrada y un interruptor que simule `prefers-reduced-motion`;
   - lleve arriba una nota breve con **qué cambia respecto a hoy y por qué**, incluida una lista de las animaciones propuestas.
4. **Para y pide el visto bueno al usuario.** Marca el elemento como `🎨 mockup listo` y espera. Si pide cambios, se itera sobre el mockup.
5. **Solo con el visto bueno, implementa.** Reutiliza lo que ya existe (ver «Piezas a reutilizar»), comprueba en claro y oscuro a 1440, ~1000 y 390 px, y pasa `npm run lint` y los tests.
6. **Marca el elemento como hecho** (`[x]`) y añade debajo una línea con el PR o el commit. Si algo nuevo entra en el sistema (un token, una clase compartida), actualiza `docs/design-system.md`.

Una página por PR. No avances a la siguiente sin cerrar la anterior.

Leyenda de estado en la checklist: `[ ]` pendiente · `🎨` mockup listo, esperando visto bueno · `[x]` implementado.

## El lenguaje visual de referencia

La fuente de verdad es `docs/design-system.md`. Resumen de lo que hace que Biblioteca y Ficha se lean de un vistazo:

- **Color por lista.** Cada estado (Bandeja, Pendiente, Jugando, Pausado, Rejugable, Completado, Abandonado, Ya jugado, Descartado, Otros) y cada marca (Favorito, Sin final) tiene token `--st-*`, icono (`LIST_ICONS`) y nombre. Se usan igual en el raíl, la franja de la fila, el chip y el selector.
- **Color por puntuación.** Metacritic, reseñas de Steam y tu nota en cuatro niveles `--sc-top/good/mid/bad` (`src/lib/scores.ts`), siempre con el texto al lado («Aclamado», «Muy positivas»).
- **Color por precio.** Descuento tintado en verde; **mínimo histórico en amarillo sólido** (`--deal`, `.hg-deal`), lo más llamativo de la página; rebajado pero ha estado más barato en `--sc-mid`.
- **Color por rareza** en los logros (`--rar-*`, `src/lib/rarity.ts`).
- **Tinte, no bloques.** El color va como texto o icono sobre su fondo al 12–14 % (`.hg-tint`), en franjas finas a la izquierda de la fila o en bordes. Nunca en bloques saturados (salvo el mínimo histórico).
- **Jerarquía clara.** Cabecera con lo importante y las acciones (Jugar, Completar), cifras grandes en «tiles» (`.juego-tile`), secciones con título e icono, barras de progreso con marcas.
- **Raíl / filtros con color y contador.** En la biblioteca el raíl izquierdo lleva icono, color y número por lista.
- **Nunca solo color:** siempre icono + nombre o cifra. Contraste AA en los dos temas.

Lo que **no** hacemos (sigue vigente): degradados, cristal, glows, sombras de color, mayúsculas con tracking, colores inventados. **Todo color nuevo tiene que significar algo** y salir de las familias de arriba. Si una página necesita una familia de color nueva (por ejemplo, posiciones del ranking o pistas de JUDI), se propone en el mockup y se añade a `design-system.md` como token, con su contraste medido.

### Piezas a reutilizar

| Pieza | Dónde |
|---|---|
| Tokens de color (`--st-*`, `--sc-*`, `--deal`, `--rar-*`, `--tint`) | `src/styles/globals.css` |
| `.hg-tint`, `.hg-chip`, `.hg-flag`, `.hg-score`, `.hg-deal`, `.st-*`, `.sc-*`, `.hg-row`, `.hg-bar`, `.hg-section`, `.hg-seg` | `src/styles/lists.css` |
| `StatusChip`, `MarkFlags`, `LIST_ICONS`, `listClass` | `src/components/tracker/status.tsx` |
| `GameMenu` (menú de estado y marcas por fila) | `src/components/tracker/GameMenu.tsx` |
| `metacriticScore`, `steamReviewScore`, `ratingTier`, `priceVerdict`, `pricePosition` | `src/lib/scores.ts` |
| `rarityTier`, `rarityColor`, `RARITY_TIER_LABELS` | `src/lib/rarity.ts` |
| `PriceInfo` (precio con veredicto) | `src/components/wishlist/PriceInfo.tsx` |
| Tiles, barras de objetivo, anillo de logros, veredicto de precio | `src/app/juego/[appid]/juego.css`, `GamePanel.tsx`, `GameAchievementsSummary.tsx` |
| Raíl de listas, cabecera de lista, filas con franja | `src/app/biblioteca/biblioteca.css`, `src/app/biblioteca/page.tsx` |

Si una pieza de la ficha o de la biblioteca hace falta en otra página (por ejemplo, los tiles o el anillo de logros), **muévela a un componente o a `lists.css` en vez de copiarla.**

## Microanimaciones

Queremos que la web **se sienta viva al navegar**. Hasta ahora la regla era «movimiento solo como respuesta» y casi no había animación; a partir de este rediseño las microanimaciones son **parte del diseño de cada página**, igual que el color: cada mockup propone las suyas y se implementan con la página. (`docs/design-system.md` ya está actualizado con esta regla.)

### Qué buscamos

- **Respuesta a cada acción.** Pulsar, marcar, cambiar de estado, añadir a la wishlist, completar un juego: todo tiene una reacción visible y corta (el chip que cambia de color con una transición, el icono del corazón que «late» al marcar Favorito, la fila que se desliza a su nueva lista, el check que se dibuja).
- **Navegación fluida.** Transición entre páginas (hoy hay una suave en `src/app/template.tsx`), indicador del elemento activo que se desliza en la barra lateral y en el raíl de listas, pestañas y controles segmentados con el fondo activo que se mueve (`layoutId` de framer-motion), contenido que cambia con un fundido cruzado al filtrar en vez de saltar.
- **Entrada con intención.** Al llegar a una página, las cifras clave cuentan hasta su valor, las barras de progreso y los anillos se rellenan, y las filas o tarjetas aparecen con un escalonado muy corto (máx. ~30 ms entre elementos y solo los primeros ~8; el resto, de golpe).
- **Hover y foco con vida.** Además del cursor de selección, las filas y tarjetas pueden elevar levemente la cápsula, mostrar las acciones con un fundido o desplazar el icono; siempre sutil.
- **Celebración donde toca.** Completar un juego, llegar al 100 % de logros, conseguir un logro legendario, acertar en JUDI: aquí cabe algo más visible (la rareza que brilla un instante, confeti como el de JUDI, el anillo que se cierra).

### Reglas

1. **Cortas y suaves.** 120–250 ms para respuestas (hover, clic, chip); 250–450 ms para entradas, rellenos y cambios de vista; celebraciones hasta ~1 s. Curva `--ease-out` (`globals.css`) o muelles de framer-motion sin rebote exagerado.
2. **Solo `transform` y `opacity`** (y `stroke-dashoffset`, `clip-path`, colores) para que vayan a 60 fps; nada que provoque recálculo de layout en bucle.
3. **No bloquean.** El contenido es usable desde el primer momento; ninguna animación retrasa un clic ni oculta información más de lo que dura.
4. **No se repiten sin motivo.** Las entradas se ven al llegar a la página, no cada vez que se refresca un dato; nada en bucle salvo los cargando.
5. **`prefers-reduced-motion` lo anula todo** (dejando solo fundidos instantáneos). Ya hay reglas globales al final de `globals.css`, `lists.css` y `ui.css`; con framer-motion, `useReducedMotion` o `MotionConfig reducedMotion="user"` en `src/components/Providers.tsx`.
6. **Herramientas:** CSS (`transition`, `@keyframes`) para lo simple; **framer-motion** (ya instalado y usado en `template.tsx`, `Nav.tsx`, `AuthShell.tsx`, JUDI) para listas que se reordenan, `layoutId`, presencia (`AnimatePresence`) y contadores. Valorar la View Transitions API para el cambio de página si la versión de Next lo soporta (consultar `node_modules/next/dist/docs/`).
7. **Coherencia.** Las animaciones que se repiten en varias páginas (contador, barra que se rellena, entrada de filas, indicador que se desliza) se hacen **una vez** como componente o clase compartida y se reutilizan. La primera página que las necesite las crea; las siguientes las importan.

---

## Checklist

### 0. Ya hechas (referencia, no tocar salvo para extraer piezas)

- [x] **Biblioteca** — `/biblioteca` · `src/app/biblioteca/page.tsx`, `biblioteca.css`
- [x] **Ficha de juego** — `/juego/[appid]` · `src/app/juego/[appid]/page.tsx`, `GamePanel.tsx`, `GameContext.tsx`, `GameAchievementsSummary.tsx`, `Media.tsx`, `juego.css`
- [ ] **Biblioteca y Ficha: pase de microanimaciones** — el color ya está; falta la capa de movimiento. Se hace **al final**, cuando ya existan las animaciones compartidas creadas por el resto de páginas.
  - Animación: indicador activo que se desliza por el raíl, filas que se reordenan y salen de la lista al cambiar de estado, chip que cambia de color, corazón y ∞ que reaccionan al marcar, contadores del raíl que se actualizan con un salto de número; en la ficha, tiles que cuentan, anillo de logros y barra de objetivo que se rellenan, selector de estado con fondo deslizante y celebración al completar.

### 1. Marco común

- [x] **Navegación (barra lateral, barra superior y pestañas móviles)** — en todas las páginas · `src/components/Nav.tsx`, `src/styles/nav.css`
  - Hoy: iconos y etiquetas neutros, activo en cobalto, contador de bandeja como badge.
  - Ideas: que el contador de la bandeja use el color de `--st-bandeja` como en el raíl; valorar indicadores pequeños con color (p. ej. nº de juegos «Jugando» junto a Biblioteca, logros nuevos, JUDI pendiente hoy). Mantener el cobalto solo para el elemento activo.
  - Animación: indicador del elemento activo que se desliza entre enlaces (barra lateral y pestañas móviles), iconos con un leve desplazamiento o rebote al pasar o pulsar, contador de bandeja que «salta» al cambiar, transición suave al pasar de barra ancha a compacta.
  - Mockup: `docs/mockups/navegacion.html` (aprobada la variante A)
  - Hecho en la rama `Diego-Mardomingo/rediseno-navegacion`, commit `e28a08a`. Incluye «Ctrl + K» en toda la interfaz y el botón para plegar la barra en pantallas anchas.
- [x] **Pie de página** — `src/components/SiteFooter.tsx` · repaso ligero de coherencia, sin color nuevo salvo que aporte.
  - Mockup: `docs/mockups/navegacion.html` (sección «Pie de página»)
  - Hecho en la rama `Diego-Mardomingo/rediseno-navegacion`, commit `e28a08a`.

### 2. Inicio

- [x] **Inicio con sesión (dashboard)** — `/` · `src/components/dashboard/Dashboard.tsx`, `ActivityHeatmap.tsx`, `MonthlyGoals.tsx`, `WhatToPlay.tsx`, `SyncButton.tsx`, `dashboard.css`
  - Hoy: saludo, mapa de actividad, paneles «En curso», «Logros recientes», «Siguientes en la cola», «Cerca del 100 %», «JUDI de hoy», objetivos del mes y «Qué jugar».
  - Ideas: cada panel con el color de la lista a la que pertenece (En curso → Jugando, Cola → Pendiente, Cerca del 100 % → Completado); filas con franja y `StatusChip`/`MarkFlags` como en la biblioteca; logros recientes con su rareza; tiles de cifras como los de la ficha; puntuaciones y precios con color en «Qué jugar»; objetivos del mes con barras de progreso con color.
  - Animación: cifras que cuentan, mapa de actividad que se pinta por semanas, barras de objetivos y «Cerca del 100 %» que se rellenan, paneles con entrada escalonada corta, «Sorpréndeme» de «Qué jugar» con un barajado de cartas.
  - Mockup: `docs/mockups/inicio.html` (aprobada la variante B: pendientes sin comprar en la cola y en «Empezar algo nuevo»; sin «el logro más difícil que te falta»)
  - Hecho en la rama `Diego-Mardomingo/rediseno-inicio`, commit `416e57c` (y `410afc0`: `hubgames_judi_today` para el JUDI de hoy en la navegación). Crea las piezas de movimiento compartidas (`CountUp`, `.hg-enter`, `.hg-bar--fill`, `.hg-rar-flash`, `.hg-pop-in`, `.hg-draw`, `.hg-seg--slide`) y mueve los tiles de la ficha a `Tile` / `.hg-tile`.
- [x] **Portada sin sesión (landing)** — `/` sin sesión · `src/app/page.tsx` (`Landing`), `dashboard.css`
  - Hoy: titular, tres botones y mapa de actividad de ejemplo.
  - Ideas: enseñar el producto con color: una vista previa de filas de biblioteca con sus listas, una ficha con puntuación y mínimo histórico, logros por rareza. Que de un vistazo se entienda qué hace HubGames.
  - Animación: la vista previa «en acción» (una fila que cambia de Pendiente a Jugando, un logro que se desbloquea, el mapa que se rellena), una sola vez al cargar.
  - Mockup: `docs/mockups/inicio.html` (sección «Portada sin sesión»)
  - Hecho en la rama `Diego-Mardomingo/rediseno-inicio`, commit `416e57c`.

### 3. Buscar y añadir juegos

- [x] **Buscador de juegos (Ctrl+K)** — diálogo global, se abre desde la biblioteca y con el atajo · `src/components/tracker/GameSearch.tsx`, `tracker.css`
  - Hoy: campo de búsqueda y lista de resultados; ya usa algo del vocabulario de color.
  - Ideas: cada resultado con su estado si ya está en tu biblioteca (`StatusChip`), Metacritic/reseñas con color, precio con veredicto (mínimo histórico en amarillo) y acciones claras (Añadir a pendientes, Wishlist, Ver ficha). Estado vacío y «sin resultados» con más presencia.
  - Animación: el diálogo se abre escalando desde el centro, los resultados entran con un fundido escalonado mínimo al teclear, el resaltado de la selección con ↑/↓ se desliza entre filas, confirmación animada al añadir (el botón se convierte en un check con el color de la lista).
  - Mockup: `docs/mockups/buscador.html` (aprobada la variante B: 3 recientes + wishlist en mínimo; se mantiene «Añadir a pendientes» en los juegos de otras listas)
  - Hecho en la rama `Diego-Mardomingo/rediseno-buscador`, commit `bd01378`. Añade `.hg-beat` (corazón que late) y `loadWishlistDeals`, que comparten la navegación y el buscador.
- [x] **Bandeja (clasificar juegos nuevos)** — `/biblioteca/bandeja` · `src/app/biblioteca/bandeja/page.tsx`, `biblioteca.css` (clases `tray-*`)
  - Hoy: filas con selección múltiple, orden, y acciones para clasificar a Pendiente / Jugando / Completado / Abandonado / Descartado; no usa los colores de lista.
  - Ideas: botones de clasificación con el color e icono de cada lista (como el selector de estado de la ficha); reseñas y horas con color; barra de acciones por lotes con los mismos colores; que el destino elegido se vea en la fila antes de confirmar.
  - Animación: al clasificar, la fila se tiñe del color de su lista y sale deslizándose (hacia el raíl o la Biblioteca en la barra lateral), el contador de la bandeja baja con un salto, la barra de lotes aparece desde abajo al seleccionar.
  - Mockup: `docs/mockups/bandeja.html` (aprobada la variante A; teclas 1–9 en el orden de `GAME_STATUSES`; Completado en lote abre «Completar juego» juego a juego)
  - Hecho en la rama `Diego-Mardomingo/rediseno-bandeja`, commit `728e4a8`. Añade `src/lib/tray.ts` (destinos, sugerido, reparto), `restoreGames` (Deshacer), la hoja inferior `SheetContent side="bottom"` y `SyncButton` con texto y `onSynced`.
- [x] **Diálogo «Completar juego»** — `src/components/tracker/CompleteDialog.tsx` (se abre desde la ficha y la bandeja)
  - Ideas: colores de `--st-completado`, tu nota con su color de `ratingTier` mientras la eliges, marcas Favorito / Sin final con sus colores.
  - Animación: la celebración principal de la web al confirmar (bandera de Completado que se planta, confeti breve o anillo que se cierra), estrellas o puntos de la nota que se encienden al elegirla.
  - Mockup: `docs/mockups/completar.html` (aprobadas la nota A · diez puntos con medios y la celebración 1 · bandera + anillo + chispas; a diferencia del mockup, Favorito y Sin final se muestran siempre; «Saltar este» deja el juego seleccionado en la bandeja)
  - Hecho en la rama `Diego-Mardomingo/rediseno-completar`, commit `9c846fd`. Añade `ratingLabel` / `RATING_LABELS` junto a `ratingTier` (palabra de tu nota), `src/lib/completion.ts` (teclas y puntero de la nota, avance del lote), el token `--on-done` y las marcas en `saveCompletion` y en Deshacer (`restoreGames`).
- [x] **Panel de sugerencias** — `src/components/tracker/SuggestionsPanel.tsx`
  - Ideas: puntuaciones y precios con color, lista de destino con su color.
  - Mockup: `docs/mockups/sugerencias.html` (aprobada la variante A: lista agrupada por destino, «¿Lo has terminado?» en verde Completado y «¿Lo dejas en pausa?» en ámbar Pausado, con resumen «3 por completar · 2 por pausar» y, con una sola, la pregunta como título; las tres pruebas con color de `evaluateGame`; contexto sin precios; Deshacer 5 s al pausar y al descartar, con cuándo volverá a preguntar; ficha que vuela al atajo de la lista en la cabecera del Inicio; sin tercera respuesta «Lo dejo»; 4 a la vista y «Ver N más»; primero completar y luego pausar, cada grupo por última partida)
  - Hecho en la rama `Diego-Mardomingo/rediseno-sugerencias`, commit `5c96981`. Añade `src/lib/suggestions.ts` (grupos y orden, la prueba de cada regla, cuándo vuelve a preguntar), `restoreSuggestion` (Deshacer un descarte), `moveListCount` y los atajos de listas del Inicio como componente cliente (`ListShortcuts`, que cuentan los cambios del panel sin recargar); `restoreGames` vuelve a poner la sugerencia que borra el trigger.

### 4. Logros

- [x] **Logros (resumen)** — `/logros` · `src/app/logros/page.tsx`, `src/components/achievements/*`, `achievements.css`
  - Hoy: puntuación de cazador, hitos, «Cerca del 100 %», «Logros fáciles que te faltan», «Olvidados», «Tus logros más raros», «Juegos al 100 %». La rareza ya está en `AchievementItem`, pero la página no tiene la jerarquía de la ficha.
  - Ideas: cabecera con tiles de cifras (puntos, logros, juegos al 100 %, el más raro) y un reparto por rareza como en el resumen de logros de la ficha; secciones con icono y color; filas de juego con barra de progreso y su estado de lista.
  - Animación: puntuación de cazador que cuenta, reparto por rareza que crece, hitos que se encienden, logros legendarios y épicos con un destello breve de su color al aparecer.
  - Mockup: `docs/mockups/logros.html` (aprobados los hitos B · tres series con todos los escalones y los logros fáciles A · lista plana con el chip de la lista de cada juego; se mantiene el panel «Puntuación de cazador» con el reparto por rareza y el top 5 aunque el tile ya da el total; «N fáciles» en «Cerca del 100 %» sale de la consulta de fáciles, limitada a 300)
  - Hecho en la rama `Diego-Mardomingo/rediseno-logros`, commit `f138a60`. `computeMilestones` devuelve también las series completas (`series`), y se añaden `seriesProgress`, `unlockedByRarity`, `thisMonth` y `countByGame` en `src/lib/achievements.ts`; la vista pasa a `src/app/logros/LogrosView.tsx` y los hitos a `Milestones.tsx`. `AchievementItem` acepta `index` (entrada escalonada y destello de épicos y legendarios) y funde el nombre al revelar un logro oculto.
- [x] **Logros de un juego** — `/juego/[appid]/logros` · `src/app/juego/[appid]/logros/page.tsx`, `GameAchievements.tsx`
  - Hoy: progreso, puntos por rareza, conseguidos por rareza y filtros; ya usa rarezas.
  - Ideas: alinearla con la sección de logros de la ficha (anillo, columnas por rareza), cabecera con la cápsula, el estado del juego y vuelta a la ficha; filtros con el color de cada rareza.
  - Animación: anillo de progreso que se rellena, filtros con fondo activo deslizante y la lista que se reordena (no salta) al filtrar.
  - Mockup: `docs/mockups/logros-juego.html` (aprobada la variante A · el filtro de rareza vive en las columnas del resumen, con chip «Épica ×» en la barra y filas de 44 px en móvil; cabecera con cápsula 184 × 86, `StatusChip`, marcas, horas y último logro; «Guías de Steam» como botón; filtro de rareza combinado con el de estado, con contadores cruzados y los «Sin dato» solo en «Todas»; anillo con pulso y sello «100 %»; lista que se reordena con `layout`, solo fundido con más de 150 logros)
  - Hecho en la rama `Diego-Mardomingo/rediseno-logros-juego`, commit `00d53a9`. Lógica pura en `src/lib/game-achievements.ts` (`filterAchievements`, `stateCounts`, `matchesRarity`, `rarityColumns`, `lastUnlock`, `DIFFICULTY_TIERS`) con tests; resumen en `AchievementsSummary.tsx` y estilos `.gl-*` en `logros-juego.css`. Una consulta nueva y barata a tu fila de `hubgames_library` para la cabecera. `AchievementItem` acepta `as="div"` para ir dentro de un `motion.li`.
- [x] **Historial de logros** — `/logros/historial` · `src/app/logros/historial/page.tsx`
  - Hoy: mapa de desbloqueos por día, rachas, línea temporal por mes y día.
  - Ideas: cada desbloqueo de la línea temporal con su rareza (punto o franja), resumen por mes con reparto de rareza, racha actual y mejor racha como tiles.
  - Animación: mapa que se pinta, racha con una llama o indicador que se enciende, meses que se despliegan al hacer scroll o al pulsar.
  - Mockup: `docs/mockups/historial-logros.html` (aprobados los meses B · tarjetas plegables con su resumen, abierto el más reciente y de 6 en 6 con «Ver meses anteriores», y el día A · detalle con `AchievementItem` y la hora en vez de la fecha; racha actual en cobalto con su llama y el aviso ámbar «Consigue uno hoy para no perderla» si viene de ayer; hitos y sello del 100 % en la línea; mapa con el patrón de `ActivityHeatmap` en modo año, pulsable y con el selector de año; «Ver N más» a partir de 5 logros de un juego en un día)
  - Hecho en la rama `Diego-Mardomingo/rediseno-historial-logros`, commit `ffa0458`. La vista pasa a `src/app/logros/historial/HistorialView.tsx` con su `historial.css` (`.hi-*`); se añaden `byMonth`, `tallyRarity`, `daySummary`, `monthSummary`, `notableRarities`, `busiestDay`, `yearSummary`, `streakAtRisk`, `streakIndex`, `perfectDays`, `milestonesByDay` y `yearHeatmap` en `src/lib/achievement-history.ts`. `ActivityHeatmap` acepta un modo «año» (casillas pulsables con `onPick`, `decorate`, tooltip propio, letras de los días, `out`/`hasToday` en el mapa); `AchievementItem` acepta `showTime` y `Milestones.tsx` exporta `seriesOf`. Sale de `achievements.css` el CSS viejo del historial (`.heatmap*`, `.timeline*`, `.tl-*`).

### 5. Wishlist y precios

- [x] **Wishlist** — `/wishlist` · `src/app/wishlist/page.tsx`, `src/components/wishlist/*`, `wishlist.css`
  - Hoy: filtros, orden, filas con precio (`PriceInfo` ya pinta el mínimo histórico en amarillo) y alerta de precio.
  - Ideas: que la fila sea como la de un pendiente sin comprar de la biblioteca: Metacritic/reseñas con color, veredicto de precio, posición del precio entre mínimo y normal (`pricePosition`, como en la ficha), duración de HowLongToBeat; filtros con contador y color (en oferta, mínimo histórico, con alerta).
  - Animación: el sello de mínimo histórico con un destello amarillo al cargar, punto del precio que se desliza a su posición en la regla, campana de alerta que se balancea al activarla, fila que se pliega al quitarla de la wishlist.
  - Mockup: `docs/mockups/wishlist.html` (aprobados los filtros A · barra con color y contador —Todos, En mínimo histórico en amarillo, En oferta en verde, Con aviso en cobalto, Próximamente— y el precio A · regla pequeña de la ficha con la tienda en el título; «Con aviso» = aviso propio (precio objetivo o descuento mínimo); vista ampliada con Metacritic, mediana de SteamSpy y HowLongToBeat; `StatusChip` si también está en la Biblioteca; €/h de historia con el color de la ficha; órdenes nuevos «Más cerca de su mínimo» y «Mejor valorados» con «Mayor descuento» por defecto; franja con el veredicto; quitar con Deshacer 5 s (los de Steam siguen sin papelera); esqueleto de filas al cargar)
  - Hecho en la rama `Diego-Mardomingo/rediseno-wishlist`, commit `8dfc2fb`. Migración `20261028120000_hubgames_wishlist_notas_duracion` (solo añade columnas al final de `hubgames_wishlist`, con `security_invoker` y el mismo grant; la duración sale de `hubgames_hltb` como `hltb_main`/`hltb_main_extra`/`hltb_completionist`, igual que en `hubgames_library`, para que `gameDuration` funcione igual). Lógica en `src/lib/wishlist-list.ts` (filtros, contadores, órdenes, `rowFacts`, `closestToLow`, `restoreAt`) con tests; `priceRule`, `euroPerHour` y `costPerHourTier` pasan a `src/lib/scores.ts` (también los usa la ficha) y `alertTarget` a `price-alerts.ts`. La fila es `src/components/wishlist/WishlistRow.tsx`; el segmentado con fondo deslizante, icono y contador pasa a `src/components/Segmented.tsx` (también en logros de un juego). Deshacer devuelve el juego con su fecha de alta (`restoreToWishlist`, `POST /api/wishlist` con `restore`) y `WISHLIST_CHANGED_EVENT` hace que la navegación vuelva a contar los mínimos. Salen `PriceNow` y `PriceLows`. Diferencias con el mockup: el orden sigue siendo el `Select` de la app (no un `<select>` nativo, sin «(nuevo)»); «Sincronizar con Steam» del vacío es el `SyncButton` (secundario, no fantasma); los «Añadido el…» abrevian el mes sin punto; el aviso de Deshacer reutiliza `.tray-float`/`.tray-toast` de la bandeja; el enlace por juego al historial de IsThereAnyDeal se quita (queda la atribución al pie).

### 6. Estadísticas

- [x] **Estadísticas del año** — `/estadisticas` · `src/app/estadisticas/page.tsx`, `YearView.tsx`, `stats.css`
  - Hoy: horas jugadas, logros por mes, completados, tu nota, notas, lo que más jugaste, géneros, juegos al 100 %.
  - Ideas: gráficas con la paleta de listas (juegos por estado), notas con la escala `--sc-*`, logros por mes apilados por rareza, tiles de cifras como la ficha. Seguir el skill `dataviz` para los gráficos.
  - Animación: barras y donuts que crecen al entrar en pantalla, cifras que cuentan, transición entre años con fundido cruzado, tooltips que aparecen sin salto.
  - Mockup: `docs/mockups/estadisticas.html` (aprobados los logros por mes B · columnas en cobalto con el reparto del año por rareza como la barra de `/logros`, y el de cada mes en el tooltip y la tabla, y las listas B · barra apilada fina y una fila por lista con icono y nombre que enlaza a su lista; «Tus listas» es la lista de hoy de los juegos con actividad ese año, sin historial; diferencias con el año anterior en gris con flecha; histograma de notas con `Math.floor`; año sin actividad = un solo vacío con acción y sin selector si solo hay un año; sin «Horas por mes» ni tile de «Mejor racha»)
  - Hecho en la rama `Diego-Mardomingo/rediseno-estadisticas`, commit `d23dee9`. Lógica en `src/lib/stats-year.ts` (`yearView`, `unlocksByMonthRarity`, `sumSplits`, `monthsElapsed`, `listsOfYear`, `ratingTierCounts`, `yearSummary`, `summaryDiff`) con tests; en `src/lib/stats.ts`, solo añadidos: `ratingBucket` (el histograma agrupa por abajo), `YearStats.active` (los appid con actividad) y `StatsUnlock.description` opcional (`loadStatsInput` lo carga). La vista es `YearView.tsx` (cliente) con el gráfico de columnas y su tooltip en `Columns.tsx`; reutiliza `Tile`, `CountUp` (acepta `from` para contar desde la cifra del año anterior), `Segmented`, `StatusChip`/`MarkFlags`, `AchievementItem`, `SyncButton`, la barra `.lg-stack` de `/logros`, `.hg-bar--fill`, `.hg-pop-in` y los paneles y vacíos del Inicio (`.dash-panel`, `.dash-sec__*`, `.dash-empty`). Diferencias con el mockup: el servidor manda todos los años a la vez, así que cambiar de año es inmediato (pushState de `?year=`, atrás y adelante también cambian) y no hay fase «a media opacidad mientras carga»: sale el año en 120 ms y entra el nuevo en 220 ms; los tiles no vuelven a subir al cambiar de año (solo cuentan); los paneles vacíos usan una frase simple dentro del panel; la neutra de «Tus listas» y «Géneros» es el icono gris del Inicio; los logros sin % global cuentan en el total y salen como «Sin dato» en el tooltip y la tabla (no en la barra).
- [x] **Resumen anual (Wrapped)** — `/estadisticas/resumen` · `resumen/page.tsx`, `Wrapped.tsx`, y la imagen para compartir `src/app/api/estadisticas/resumen/imagen/route.tsx`
  - Hoy: horas, juego del año, top 5, logro más raro, mejor racha, en números, compartir.
  - Ideas: es la página más «de celebración»: aquí cabe más presencia del color (logro más raro con su rareza a lo grande, juego del año con imagen grande como la ficha, top 5 con su nota en color). La imagen OG debe seguir el mismo diseño (solo valores escritos, sin variables).
  - Animación: la página con más movimiento de la web: bloques que se revelan uno a uno al hacer scroll, horas que cuentan, el logro más raro con su destello de rareza, top 5 que aparece en orden inverso (del 5 al 1).
  - Mockup: `docs/mockups/resumen-anual.html` (aprobados el juego del año A · arte grande de la ficha (`HeroImage`) con `StatusChip`, `MarkFlags`, tu nota con color y palabra, Metacritic, logros de ese año y barra de «tu año», el top 5 A · filas con barra de horas, posición, cápsula, chip de su lista y nota o «—», del 5 al 1 con el 1 al final con un pop (160 ms entre filas: excepción solo aquí) y la imagen A · siempre oscura; «Lo que completaste» con «Ver los N» a partir de 12; descripción del logro más raro; selector de año en la cabecera con los 5 más recientes y «Más»; «hasta hoy, 28 de octubre» en el año en curso, en la página y en la imagen; revelado al hacer scroll una vez por visita; Onest 400/700/800 en la imagen)
  - Hecho en la rama `Diego-Mardomingo/rediseno-resumen-anual`, commit `fce734c`. Lógica en `src/lib/wrapped.ts` (`buildWrappedView`, `monthlyMinutes`, `rarityCounts`, `unlocksByGame`, `yearSpan`, `hoursEquivalents`, `shareOfYear`, `yearChoices`, `streakSquares`, `formatRating`, `dayLong`, `otherYearWithData`) con tests; `yearStats`, `buildWrapped` y `TopGame` no cambian (en `stats.ts` y `stats-db.ts` solo se añade `description`). Bloques con `Reveal.tsx` (`IntersectionObserver`, una vez; `useRevealed` arranca las cifras), selector `YearPicker.tsx` (popover «Más»), estilos `.wr-*` en `resumen/resumen.css`. `CountUp` acepta `duration` y `run`. La imagen pasa a `wrapped-image.tsx` (la ruta solo carga los datos) con Onest de `src/assets/fonts/onest` (OFL, con su licencia; `outputFileTracingIncludes` en `next.config.js`). Diferencias con el mockup: los tiles de «En números» son los de la app (`--surface-2`, sin borde); el icono del logro más raro es el de Steam (con el trofeo de respaldo) dentro del marco de su rareza; Metacritic usa las palabras de `metacriticScore` («Aclamado», «Favorable», «Variado», «Desfavorable»); los días enteros se redondean hacia abajo (14 h no son «1 día entero») y «al día» cuenta los días transcurridos en el año en curso; el vacío propone el año más reciente con datos (o solo vuelve a las estadísticas si no hay); los tooltips del primer y último mes se alinean al borde para no salirse. Las reglas `.wrapped*` de `stats.css` ya no se usan.

### 7. Cuenta

- [x] **Perfil** — `/perfil` · `src/app/perfil/page.tsx`, `SteamSetting.tsx`, `ExportSetting.tsx`
  - Hoy: cabecera con nombre, secciones Cuenta, Preferencias (tema, notificaciones), JUDI y Top.
  - Ideas: cabecera con tiles de tu actividad (juegos por lista con sus colores, logros, nivel de JUDI); estado de la conexión con Steam con color (`--success` / `--warning`); secciones con icono; medallas con los colores de rareza que ya usa.
  - Animación: cambio de tema con transición suave de colores, interruptores con su bola deslizante, confirmación de guardado con un check que se dibuja, cifras que cuentan.
  - Mockup: `docs/mockups/perfil.html` (aprobada la v2: el perfil es solo el perfil, **sin cifras de juegos** (fuera la actividad de la v1 y sus variantes); **tarjeta de usuario** con avatar de Steam o inicial, nombre, chip «Admin» en ámbar, email, «En HubGames desde…» y la cuenta de Steam con el color de su estado; color con significado en cada sección (Cuenta cobalto, Steam verde/ámbar/neutro según su estado, Preferencias con el icono y color de tu tema, notificaciones activas en verde solo aquí, Tus datos con el color de lo que exporta); zona **«Salir»** en rojo al final con «Cerrar sesión» y «Desvincular Steam» (fuera de la sección de Steam); **JUDI en un solo panel en la columna lateral** (tus cifras + top 5, medallas como hoy); tarjeta de **Administración** en ámbar solo para admins con tres líneas de estado, programados ≥ 3 días verde / 1–2 ámbar / 0 rojo; el nombre se comprueba mientras escribes)
  - Hecho en la rama `Diego-Mardomingo/rediseno-perfil`, commit `cdaeae0`. La página se parte en `ProfileCard`, `AccountSetting`, `SteamSetting`, `PrefsSetting`, `ExportSetting`, `ExitZone`, `AdminCard`, `JudiPanel` y `Section` (`PfSection` con la cabecera `.dash-sec__head` del Inicio y `SaveButton`: spinner y check que se dibuja); lógica pura en `src/lib/profile.ts` (`memberSince`, `steamState`, `STEAM_STATE_META`, `steamNeedsFix`, `timeAgo`, `usernameIssue`, `passwordRules`, `judiStats`, `beatPercent`, `topWithSelf`, `scheduledDaysLeft`, `scheduledTone`, `judiDay`, `judiDateLong`, `adminWhen`, `adminLines`) con tests. Admin con `rpc('is_admin')` (no `user_metadata`), y sus tres consultas solo si lo es (`hubgames_judi_generacion_logs`, `hubgames_lista_videojuegos_judi`, recuento de `hubgames_sync_logs` con error en 24 h). La carga de `hubgames_user_steam` sube a la página para que la tarjeta use `avatar` y `persona_name`. Piezas compartidas nuevas: `.hg-btn--danger-soft` (variante `dangerSoft` de `Button`), `html.hg-theme-anim` (fundido de colores al cambiar de tema, desde `setThemePref`, en toda la web) y `ThemeToggle labeled` con fondo deslizante e icono del color de su tema (`.theme-opt--*`, `useThemePref`). Sin migraciones. Diferencias con el mockup: «Conectar con Steam» y «Volver a comprobar» llevan a `/api/steam/link` (sin la simulación del mockup); «Cerrar sesión» enseña el spinner y sale, sin check; desvincular avisa con un toast; el estado `desconocida` de Steam sale en ámbar («No se pudo leer el perfil») y deja sincronizar; en Administración la cifra va antes del detalle («6 días · Hasta el 3 de noviembre»), con esqueleto mientras carga y una frase si falla; el interruptor de notificaciones se mueve al momento y vuelve si falla; la etiqueta del tema activo sigue en cobalto (estilo de `.hg-seg` de la app); entre 760 y 1100 px Administración y JUDI van en dos columnas bajo los ajustes.
- [ ] **Login** — `/login` · `src/app/login/page.tsx`, `src/components/AuthShell.tsx`
  - Hoy: formulario dentro de `AuthShell`.
  - Ideas: el lateral o fondo de `AuthShell` enseñando el producto con color (como la landing), sin decorar por decorar. Errores y estados con `--danger` / `--success`.
  - Animación: la vista previa del producto «en acción» (como la landing), error con una pequeña sacudida del formulario, botón que pasa a cargando y a check al entrar.
- [ ] **Registro** — `/registro` · `src/app/registro/page.tsx`, `AuthShell.tsx`
  - Mismo tratamiento que el login (comparten `AuthShell`); validación de campos con color e icono.
  - Animación: requisitos de la contraseña que se van marcando en verde mientras se escribe, transición compartida con el login al cambiar de uno a otro.

### 8. JUDI y Ranking

- [ ] **JUDI — partida del día** — `/judi` · `src/app/judi/JudiClient.tsx`, `JudiFinishActions.tsx`, `judi.css`
  - Hoy: captura con fases, intentos, «Ya probado», «Intentos fallados», pistas, ampliar captura.
  - Ideas: vidas e intentos con color (correcto / fallado / saltado), pistas con color según lo que acercan, fases con indicador claro; al terminar, la tarjeta del juego como en la ficha (puntuación, precio, añadir a pendientes).
  - Animación: vida que se pierde con una sacudida y fundido, fallo que tiembla en rojo, acierto con el confeti existente y la portada que se revela, cambio de fase de la captura con deslizamiento, pistas que se despliegan.
- [ ] **JUDI — tus estadísticas e historial** — `/judi` (vista de historial) · `JudiClient.tsx`
  - Ideas: tiles de racha, aciertos y media; historial con cada día en verde/rojo/neutro y filtros con contador.
  - Animación: tiles que cuentan, días del historial que aparecen escalonados, filtros con fondo deslizante.
- [ ] **JUDI — mantenimiento** — `src/app/judi/JudiMaintenance.tsx` · repaso ligero.
- [ ] **Ranking** — `/ranking` · `src/app/ranking/page.tsx`
  - Hoy: podio y clasificación.
  - Ideas: podio con medallas de color (hoy usa legendaria y común; definir oro/plata/bronce si hace falta, como token nuevo), tu posición resaltada con el cursor de selección, tendencia (sube/baja) con `--success` / `--danger`.
  - Animación: podio que sube (3.º, 2.º y 1.º en ese orden), posiciones que se ordenan al cargar, tu fila con un resalte breve para encontrarte.

### 9. Administración (solo admins)

- [ ] **Admin** — `/admin` · `src/app/admin/page.tsx`, `admin.css`
  - Hoy: logs de generación, sincronizaciones con Steam, pool de juegos, juegos programados; estados Correcto / Fallido / Parcial / En curso.
  - Ideas: estados de log y de sincronización con chips tintados (`--success`, `--danger`, `--warning`, acento); pool con Elegible / No elegible / Descartado con color; cifras arriba en tiles. Prioridad baja: solo lo ve el admin.
  - Animación: mínima, solo respuesta (actualizar con icono que gira, detalle de log que se despliega).

### 10. Estados transversales

- [ ] **Cargando** — `src/components/Loader.tsx` y esqueletos (`.juego-skel`, `components/ui/skeleton.tsx`) · que las páginas rediseñadas usen esqueletos con la forma real (como la ficha) en vez del loader genérico donde tenga sentido.
  - Animación: brillo suave que recorre los esqueletos y fundido cruzado del esqueleto al contenido real (sin salto de layout).
- [ ] **Estados vacíos** — biblioteca vacía, wishlist vacía, sin logros, sin resultados, sin Steam conectado · revisar que todos sigan el mismo patrón (icono con color de la lista o sección, texto corto, una acción).
- [ ] **Página 404 y página de error** — hoy **no existen** (`src/app/not-found.tsx`, `src/app/error.tsx`) · proponer un diseño coherente y crearlas.
  - Animación: un detalle con personalidad (el logo de HubGames con la barra que no termina de llenarse, un mando que se desconecta…), una sola vez.
- [ ] **Transición entre páginas** — `src/app/template.tsx` (hoy: fundido + leve desplazamiento de 0,4 s) · revisar duración y estilo para que encaje con el resto de microanimaciones; valorar View Transitions para que la cápsula de un juego «vuele» de la fila de la biblioteca a la imagen grande de la ficha.

### 11. Cierre: README, capturas y vídeo

Va **al final**, cuando el rediseño esté terminado, y se hace poco a poco. No usa mockups: el agente principal pregunta a Diego por la finalidad del proyecto antes de escribir nada.

- [ ] **README** — `README.md` · hoy cuenta un producto distinto al real (habla de «centro de control gamer», PWA, avisos push…). Reescribirlo desde cero a partir de una ronda de preguntas a Diego: para qué y para quién es HubGames, qué partes son las centrales (biblioteca, estados, logros, Inicio) y cuáles secundarias (JUDI), qué se queda fuera, tono.
- [ ] **Capturas** — `docs/readme/hero.png`, `screens.png` · rehacerlas con el diseño nuevo, claro y oscuro, escritorio y móvil, con datos reales y sin información privada.
- [ ] **Vídeo** — `docs/readme/hubgames-promo.mp4`, `video.png` (miniatura), proyecto Remotion en `promo/` · rehacer el recorrido con las páginas rediseñadas y sus microanimaciones, alineado con lo que cuente el README nuevo.
