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

- **Color por lista.** Cada estado (Bandeja, Pendiente, Jugando, Pausado, Completado, Abandonado, Descartado) y cada marca (Favorito, Sin final) tiene token `--st-*`, icono (`LIST_ICONS`) y nombre. Se usan igual en el raíl, la franja de la fila, el chip y el selector.
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

- 🎨 **Navegación (barra lateral, barra superior y pestañas móviles)** — en todas las páginas · `src/components/Nav.tsx`, `src/styles/nav.css`
  - Hoy: iconos y etiquetas neutros, activo en cobalto, contador de bandeja como badge.
  - Ideas: que el contador de la bandeja use el color de `--st-bandeja` como en el raíl; valorar indicadores pequeños con color (p. ej. nº de juegos «Jugando» junto a Biblioteca, logros nuevos, JUDI pendiente hoy). Mantener el cobalto solo para el elemento activo.
  - Animación: indicador del elemento activo que se desliza entre enlaces (barra lateral y pestañas móviles), iconos con un leve desplazamiento o rebote al pasar o pulsar, contador de bandeja que «salta» al cambiar, transición suave al pasar de barra ancha a compacta.
  - Mockup: `docs/mockups/navegacion.html` (variantes A/B para Biblioteca en la barra ancha)
- 🎨 **Pie de página** — `src/components/SiteFooter.tsx` · repaso ligero de coherencia, sin color nuevo salvo que aporte.
  - Mockup: `docs/mockups/navegacion.html` (sección «Pie de página»)

### 2. Inicio

- [ ] **Inicio con sesión (dashboard)** — `/` · `src/components/dashboard/Dashboard.tsx`, `ActivityHeatmap.tsx`, `MonthlyGoals.tsx`, `WhatToPlay.tsx`, `SyncButton.tsx`, `dashboard.css`
  - Hoy: saludo, mapa de actividad, paneles «En curso», «Logros recientes», «Siguientes en la cola», «Cerca del 100 %», «JUDI de hoy», objetivos del mes y «Qué jugar».
  - Ideas: cada panel con el color de la lista a la que pertenece (En curso → Jugando, Cola → Pendiente, Cerca del 100 % → Completado); filas con franja y `StatusChip`/`MarkFlags` como en la biblioteca; logros recientes con su rareza; tiles de cifras como los de la ficha; puntuaciones y precios con color en «Qué jugar»; objetivos del mes con barras de progreso con color.
  - Animación: cifras que cuentan, mapa de actividad que se pinta por semanas, barras de objetivos y «Cerca del 100 %» que se rellenan, paneles con entrada escalonada corta, «Sorpréndeme» de «Qué jugar» con un barajado de cartas.
- [ ] **Portada sin sesión (landing)** — `/` sin sesión · `src/app/page.tsx` (`Landing`), `dashboard.css`
  - Hoy: titular, tres botones y mapa de actividad de ejemplo.
  - Ideas: enseñar el producto con color: una vista previa de filas de biblioteca con sus listas, una ficha con puntuación y mínimo histórico, logros por rareza. Que de un vistazo se entienda qué hace HubGames.
  - Animación: la vista previa «en acción» (una fila que cambia de Pendiente a Jugando, un logro que se desbloquea, el mapa que se rellena), una sola vez al cargar.

### 3. Buscar y añadir juegos

- [ ] **Buscador de juegos (Ctrl+K)** — diálogo global, se abre desde la biblioteca y con el atajo · `src/components/tracker/GameSearch.tsx`, `tracker.css`
  - Hoy: campo de búsqueda y lista de resultados; ya usa algo del vocabulario de color.
  - Ideas: cada resultado con su estado si ya está en tu biblioteca (`StatusChip`), Metacritic/reseñas con color, precio con veredicto (mínimo histórico en amarillo) y acciones claras (Añadir a pendientes, Wishlist, Ver ficha). Estado vacío y «sin resultados» con más presencia.
  - Animación: el diálogo se abre escalando desde el centro, los resultados entran con un fundido escalonado mínimo al teclear, el resaltado de la selección con ↑/↓ se desliza entre filas, confirmación animada al añadir (el botón se convierte en un check con el color de la lista).
- [ ] **Bandeja (clasificar juegos nuevos)** — `/biblioteca/bandeja` · `src/app/biblioteca/bandeja/page.tsx`, `biblioteca.css` (clases `tray-*`)
  - Hoy: filas con selección múltiple, orden, y acciones para clasificar a Pendiente / Jugando / Completado / Abandonado / Descartado; no usa los colores de lista.
  - Ideas: botones de clasificación con el color e icono de cada lista (como el selector de estado de la ficha); reseñas y horas con color; barra de acciones por lotes con los mismos colores; que el destino elegido se vea en la fila antes de confirmar.
  - Animación: al clasificar, la fila se tiñe del color de su lista y sale deslizándose (hacia el raíl o la Biblioteca en la barra lateral), el contador de la bandeja baja con un salto, la barra de lotes aparece desde abajo al seleccionar.
- [ ] **Diálogo «Completar juego»** — `src/components/tracker/CompleteDialog.tsx` (se abre desde la ficha y la bandeja)
  - Ideas: colores de `--st-completado`, tu nota con su color de `ratingTier` mientras la eliges, marcas Favorito / Sin final con sus colores.
  - Animación: la celebración principal de la web al confirmar (bandera de Completado que se planta, confeti breve o anillo que se cierra), estrellas o puntos de la nota que se encienden al elegirla.
- [ ] **Panel de sugerencias** — `src/components/tracker/SuggestionsPanel.tsx`
  - Ideas: puntuaciones y precios con color, lista de destino con su color.

### 4. Logros

- [ ] **Logros (resumen)** — `/logros` · `src/app/logros/page.tsx`, `src/components/achievements/*`, `achievements.css`
  - Hoy: puntuación de cazador, hitos, «Cerca del 100 %», «Logros fáciles que te faltan», «Olvidados», «Tus logros más raros», «Juegos al 100 %». La rareza ya está en `AchievementItem`, pero la página no tiene la jerarquía de la ficha.
  - Ideas: cabecera con tiles de cifras (puntos, logros, juegos al 100 %, el más raro) y un reparto por rareza como en el resumen de logros de la ficha; secciones con icono y color; filas de juego con barra de progreso y su estado de lista.
  - Animación: puntuación de cazador que cuenta, reparto por rareza que crece, hitos que se encienden, logros legendarios y épicos con un destello breve de su color al aparecer.
- [ ] **Logros de un juego** — `/juego/[appid]/logros` · `src/app/juego/[appid]/logros/page.tsx`, `GameAchievements.tsx`
  - Hoy: progreso, puntos por rareza, conseguidos por rareza y filtros; ya usa rarezas.
  - Ideas: alinearla con la sección de logros de la ficha (anillo, columnas por rareza), cabecera con la cápsula, el estado del juego y vuelta a la ficha; filtros con el color de cada rareza.
  - Animación: anillo de progreso que se rellena, filtros con fondo activo deslizante y la lista que se reordena (no salta) al filtrar.
- [ ] **Historial de logros** — `/logros/historial` · `src/app/logros/historial/page.tsx`
  - Hoy: mapa de desbloqueos por día, rachas, línea temporal por mes y día.
  - Ideas: cada desbloqueo de la línea temporal con su rareza (punto o franja), resumen por mes con reparto de rareza, racha actual y mejor racha como tiles.
  - Animación: mapa que se pinta, racha con una llama o indicador que se enciende, meses que se despliegan al hacer scroll o al pulsar.

### 5. Wishlist y precios

- [ ] **Wishlist** — `/wishlist` · `src/app/wishlist/page.tsx`, `src/components/wishlist/*`, `wishlist.css`
  - Hoy: filtros, orden, filas con precio (`PriceInfo` ya pinta el mínimo histórico en amarillo) y alerta de precio.
  - Ideas: que la fila sea como la de un pendiente sin comprar de la biblioteca: Metacritic/reseñas con color, veredicto de precio, posición del precio entre mínimo y normal (`pricePosition`, como en la ficha), duración de HowLongToBeat; filtros con contador y color (en oferta, mínimo histórico, con alerta).
  - Animación: el sello de mínimo histórico con un destello amarillo al cargar, punto del precio que se desliza a su posición en la regla, campana de alerta que se balancea al activarla, fila que se pliega al quitarla de la wishlist.

### 6. Estadísticas

- [ ] **Estadísticas del año** — `/estadisticas` · `src/app/estadisticas/page.tsx`, `YearView.tsx`, `stats.css`
  - Hoy: horas jugadas, logros por mes, completados, tu nota, notas, lo que más jugaste, géneros, juegos al 100 %.
  - Ideas: gráficas con la paleta de listas (juegos por estado), notas con la escala `--sc-*`, logros por mes apilados por rareza, tiles de cifras como la ficha. Seguir el skill `dataviz` para los gráficos.
  - Animación: barras y donuts que crecen al entrar en pantalla, cifras que cuentan, transición entre años con fundido cruzado, tooltips que aparecen sin salto.
- [ ] **Resumen anual (Wrapped)** — `/estadisticas/resumen` · `resumen/page.tsx`, `Wrapped.tsx`, y la imagen para compartir `src/app/api/estadisticas/resumen/imagen/route.tsx`
  - Hoy: horas, juego del año, top 5, logro más raro, mejor racha, en números, compartir.
  - Ideas: es la página más «de celebración»: aquí cabe más presencia del color (logro más raro con su rareza a lo grande, juego del año con imagen grande como la ficha, top 5 con su nota en color). La imagen OG debe seguir el mismo diseño (solo valores escritos, sin variables).
  - Animación: la página con más movimiento de la web: bloques que se revelan uno a uno al hacer scroll, horas que cuentan, el logro más raro con su destello de rareza, top 5 que aparece en orden inverso (del 5 al 1).

### 7. Cuenta

- [ ] **Perfil** — `/perfil` · `src/app/perfil/page.tsx`, `SteamSetting.tsx`, `ExportSetting.tsx`
  - Hoy: cabecera con nombre, secciones Cuenta, Preferencias (tema, notificaciones), JUDI y Top.
  - Ideas: cabecera con tiles de tu actividad (juegos por lista con sus colores, logros, nivel de JUDI); estado de la conexión con Steam con color (`--success` / `--warning`); secciones con icono; medallas con los colores de rareza que ya usa.
  - Animación: cambio de tema con transición suave de colores, interruptores con su bola deslizante, confirmación de guardado con un check que se dibuja, cifras que cuentan.
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
