# Build questions

Ambigüedades o huecos encontrados al construir el prototipo siguiendo `SPEC.md`. Cada punto dice
qué se hizo mientras tanto (siempre la opción más literal o la que no cambia nada existente) para
que se pueda corregir después.

## General

1. **Orden de construcción.** SPEC tiene dos órdenes: el de la sección 5 (Home → Transactions →
   Add transaction → …) y el "Orden de construcción sugerido" al final (proto.js → Transactions →
   … → Home desktop). Se siguió el de la sección 5. El shell de `proto.js` se construyó junto con Home
   porque Home lo necesita (mover el tab bar).
2. **Estados.** La instrucción de construcción pide tres estados (datos, vacío, carga); SPEC (1.10,
   4.1 y la lista de aceptación) pide cuatro, con `error`. Se construyen los cuatro.
3. **Ancho de revisión mobile.** La instrucción pide revisar a 375 px; la lista de aceptación de SPEC
   dice 390 px. Se revisa a 375 px (el más estrecho de los dos).
4. **768–1023 px.** SPEC 2.2 dice "layout mobile centrado a 560 px con tab bar", pero el contenedor
   de `home.html` y el tab bar (que se mueve "sin cambiarlo") miden `max-w-[430px]`. Se dejó en 430 px
   centrado. ¿Debe crecer a 560 px?
5. **Padding superior en desktop.** SPEC no da el espacio sobre el `h1` desktop. Se usó `lg:pt-8`
   (igual al margen lateral `px-8`).
6. **Settings en el sidebar.** No hay archivo de Settings en la tabla de archivos (More es solo
   mobile). El elemento `Settings` del sidebar enlaza a `more.html` mientras tanto.
7. **Members y Notifications** (5.11 y 5.13) se describen como pantallas, pero no están en la tabla de
   "Archivos a crear". Pendiente de decidir al llegar a esas secciones.
8. **N6 en desktop.** Las clases de diálogo (`lg:top-1/2 lg:left-1/2 … -translate-…`) sobre una hoja
   con `inset-x-0 bottom-0 mx-auto` no centran solas: `bottom-0` estira la altura y `right-0` + `mx-auto`
   desplaza el centro. Se agregaron `lg:right-auto lg:bottom-auto` (y en el panel `lg:top-0`
   implícito con `lg:inset-y-0`). No cambia el aspecto especificado.

## 5.1 Home

9. **Hover de la línea desktop.** SPEC da un ejemplo (`Oct 1 · $34,618.93`) pero no dice qué
   puntos muestran etiqueta. Solo hay cifras exactas para el 1 de cada mes y hoy (`mock-data.md` §8);
   la regla se ajusta al más cercano de esos siete puntos.
10. **Destino de `Daniel's paycheck` en Coming up.** SPEC solo da destino para Netflix, Con Edison y
    Pay Sapphire Reserve. Se enlazó a la hoja `confirm` de Recurring (su variante de ingreso existe
    en 5.8).
11. **Campana.** Lleva a Notifications, que no tiene archivo en la tabla (ver 7). Enlaza a
    `notifications.html` provisionalmente.
12. **Estado error de Home.** Se mantiene la cabecera (selector de Space y campana) sobre el N13,
    entendida como parte de la navegación que "sigue visible".

## 5.2 Transactions

13. **Cabecera desktop.** SPEC 5.2 indica `h1`, buscador de 320 px, `Filters` (E15) y `Export CSV`
    (E16), mientras que el diagrama general 2.2 muestra `[Search] [Ask] [🔔]`. Se dejaron los cuatro
    elementos que pide 5.2 explícitamente para que no se parta en dos líneas al abrir el panel derecho
    de 420 px.
14. **Columna `By` en la tabla desktop.** Para movimientos creados por Maya se muestra su avatar `M`
    y para los generados por recurrente un círculo neutro con `repeat` (en mobile, SPEC 4.3 solo pide
    avatar cuando lo capturó otro miembro, `D`, y así se hizo en la lista mobile).
15. **Botón de la hoja Filters.** Sin filtros aplicados muestra `Show 44 transactions` (el total de
    noviembre en `mock-data.md` §5); al activar `Want` muestra `Show 22 transactions` como en el
    ejemplo de SPEC 5.2.

## 5.3 Add transaction

16. **Ancho de `Entertainment` en rejilla de 4 columnas a 375 px.** Con `px-5`, `gap-2` y `text-[12px]`,
    la palabra `Entertainment` mide más que la celda de 77.75 px; se agregó `truncate` dentro de la
    celda para que no desborde el borde a 375 px (a 390 px y en el diálogo desktop de 480 px cabe
    completa).
17. **Selector de cuenta en la fila de contexto.** El chip `Joint Checking ▾` cicla por las cuentas
    al tocarlo para poder probar tarjeta de crédito (`Pay in installments`) y cuenta en MXN (`Mexican
    pesos`) sin abrir una segunda hoja.

## 5.4 Accounts

18. **Segunda línea en tarjetas de crédito.** A 375 px (y en la columna de 336 px del `grid-cols-3`
    desktop), la meta izquierda (`Due Nov 15 · $1,512.80`, 13 px) más la cifra derecha (`$10,153.68
    available`, 12 px) suman ~273 px frente a ~247 px disponibles junto a la ficha de 44 px. Se
    estructuró la fila en dos líneas independientes (como E11 en `home.html`) con `truncate` en el
    texto de la meta izquierda para que el título `Sapphire Reserve` se vea completo arriba y la meta
    trunque con `…` abajo sin pisar `$10,153.68 available`.
19. **Subtotales al filtrar por alcance.** SPEC 5.4 da las cifras héroe para `Shared` (`$30,874.23`)
    y `Only you` (`$5,524.24`); los subtotales de grupo y la línea secundaria se recalculan con las
    sumas de `mock-data.md` §2 para cada alcance.

## 5.5 Account detail

20. **Segunda línea en `Coming up` de Joint Checking.** SPEC 5.5 lista el título, monto y marca de
    cada fila pero no el texto izquierdo de la segunda línea (porque ya estamos dentro de Joint
    Checking). Se puso `Card payment`, `Paycheck` y `Utilities`.
21. **Enlace `Original purchase` en hoja `plan`.** SPEC dice que `$449.94 · Jul 10` abre el
    movimiento, pero `mock-data.md` §5 solo trae noviembre. Enlaza a `transactions.html?sheet=detail`.
22. **Variantes en `account.html`.** Además de `?id=1` y `?id=3`, se agregaron `&private=1` (Maya's
    Checking) y `&currency=MXN` (BBVA México) con sus saldos, cambios y movimientos de `mock-data.md`
    §2 y §5.

## 5.6 Budget

23. **Alcance N5 (`Everything · Shared · Only you`) en Budget.** SPEC 5.6 pide el control N5 debajo
    de la barra total, pero `mock-data.md` §4 define un solo plan para el Space (`$7,400`) y no
    desglosa límites por visibilidad. Al cambiar de alcance en `budget.html` se actualiza la cifra
    gastada (`$4,812.14` / `$4,219.94` / `$592.20` de §4) manteniendo las bolsas del plan.
24. **Ubicación de `Add a limit` en el pie E12.** Para evitar que `Not assigned to a category`,
    `$250.00` y `Add a limit` choquen en el ancho de 336 px de cada columna desktop (y a 375 px en
    mobile), `Add a limit` se coloca debajo de la fila del total dentro del pie `border-t`.
25. **Mes anterior (`?month=oct`).** No hay plan activo guardado en octubre según `mock-data.md`, así
    que al retroceder a octubre desde el selector se muestra una vista ilustrativa de mes pasado
    (`Over plan $1,408.32` frente a `$7,400`, sin texto `a day`) usando los totales reales de octubre
    de §8.

## 5.7 Analytics

26. **Periodo `Year` y vista `Merchants` en tarjeta 3.** `mock-data.md` §8 tiene seis meses de
    historia (junio a noviembre) y para comercios da totales de noviembre (`Whole Foods 28031 (2)`)
    sin el comparativo de octubre, por lo que `Year` muestra los seis meses disponibles y en
    `Merchants` se muestra la cantidad de movimientos a la derecha.
27. **Cabecera desktop de Analytics.** Además de Periodo y Alcance a la derecha del `h1` (SPEC 5.7),
    se mantuvieron `Ask` y la campana igual que en el resto de pantallas desktop.




