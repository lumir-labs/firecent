# Firecent · especificación de construcción

Documento único para construir el resto del prototipo en `./fable`. Quien construya solo necesita
esta carpeta: `SPEC.md` (qué y cómo), `mock-data.md` (con qué datos), `schema-gaps.md` (qué falta
en la base), `home.html` (la dirección visual aprobada) y `src/tokens.proposed.css`.

Todo el copy de la UI va **en inglés** y está escrito aquí tal cual debe aparecer. Lo marcado
**Decisión** se resolvió al escribir este documento y no hay que volver a preguntarlo.

## 0. Contrato de construcción

**Qué es Firecent.** SaaS de finanzas personales para llevar el dinero solo o en grupo. Compite con
Copilot Money, Monarch, YNAB y Revolut. No se conecta a bancos y **no mueve dinero**: registra lo
que el usuario captura, importa o aprueba.

**Vocabulario fijo**

| En la UI | En la base | Nota |
| --- | --- | --- |
| Space | `Organization` | Un grupo que comparte finanzas. Puede ser de una sola persona. |
| Account | `BankAccount` | Checking, Savings, Cash, Credit card. Cada una en su moneda. |
| Transaction | `Record` | Expense, Income o Transfer. |
| Owe / Need / Want | `SpendingNature` `DEBO / NECESITO / QUIERO` | Siempre en ese orden. |
| Installment plan | (nuevo) | Compra a meses en una tarjeta. Formato "4 of 6", "0% interest". |
| Budget, "the plan" | (nuevo) | Plan mensual: tres bolsas más límites opcionales por categoría. |
| Recurring | (nuevo) | Plantilla que se repite, en modo Auto o Manual. |
| Shared / Only you | (nuevo) | Visibilidad de una cuenta dentro del Space. |

**Archivos a crear** (uno por pantalla, mismo esqueleto que `home.html`):

| Archivo | Pantalla | Hojas que contiene (`?sheet=`) |
| --- | --- | --- |
| `home.html` (existe) | Home | se le agrega el layout desktop (5.1) |
| `transactions.html` | Transactions | `filters`, `detail` |
| `accounts.html` | Accounts | `add-account` |
| `account.html` | Account detail (`?id=1` cuenta normal, `?id=3` tarjeta) | `pay-card`, `plan`, `share` |
| `budget.html` | Budget | `edit-plan`, `limit` |
| `analytics.html` | Analytics | |
| `recurring.html` | Recurring | `detail`, `confirm`, `auto` |
| `debts.html` | Debts | `detail`, `add-debt` |
| `assistant.html` | Assistant (`?view=new` o `?view=thread`) | `threads` |
| `more.html` | More | |
| `onboarding.html` | Onboarding (`?step=1..4`) | |

Las piezas que se repiten en todas las pantallas (tab bar, sidebar desktop, hoja de alta rápida
`?sheet=add`, selector de Space `?sheet=space`, toast) viven **una sola vez** en `assets/proto.js`
como plantillas que se inyectan en `<div data-shell></div>` al cargar. `build.mjs` ya escanea
`proto.js` para íconos y clases. Después de inyectar hay que llamar `window.fableIcons(nodo)`.
**Decisión**: el tab bar que hoy está escrito dentro de `home.html` se mueve a `proto.js` sin
cambiarlo.

**Convenciones del prototipo**

- Estado por URL: `?state=data|empty|loading|error`. Cada estado es un bloque `data-view="…"`.
  Falta `error`: agregar a `src/app.css` la regla
  `html[data-state="error"] [data-view="error"] { display: block; }`.
- Tema por URL: `?theme=light|dark` (ya funciona).
- Hojas por URL: `proto.js` copia `?sheet=x` a `<html data-sheet="x">`. Regla nueva en `src/app.css`:
  `[data-sheet-id] { display: none; }` y
  `html[data-sheet="add"] [data-sheet-id="add"] { display: block; }` (una por hoja, o un selector
  generado en `proto.js`).
- Íconos: `<i data-icon="nombre-lucide" class="size-5"></i>`. Todos los nombres de este documento
  existen en el `lucide-react` instalado. La flama es `firecent` (color) o `firecent-mono`.
- `bun fable/build.mjs` después de agregar clases o íconos.
- `index.html` (el visor): agregar cada pantalla a `SCREENS`, activar el botón Desktop (iframe de
  1440 × 900 con el mismo `zoom` de ajuste), agregar `Error` al grupo State y un grupo `Sheet`
  con las hojas de la pantalla activa.
- Un solo archivo sirve mobile y desktop con utilidades `lg:`. Si la estructura cambia (lista
  contra tabla), se duplican los bloques con `lg:hidden` y `hidden lg:block`.

## 1. Principios

Los seis de `design-notes.md` mandan. Resumen operativo:

1. **Un número, luego el contexto.** Cada pantalla abre con la cifra que responde su pregunta, sin
   tarjeta alrededor. Las tarjetas son para grupos de filas.
2. **El color significa algo o no está.** Violeta: lo que se puede tocar y lo compartido. Verde:
   dinero que entra. Ámbar: vence pronto o va por encima del ritmo. Rojo: se pasó del límite o es
   destructivo. Arena con flama: habla el asistente. Un gasto normal va en tinta neutra.
3. **Quién lo ve, siempre visible.** Lo privado lleva candado (`lock`). Lo compartido es el default
   y no lleva marca en filas; solo en el detalle (pastilla `Shared`).
4. **Owe / Need / Want** siempre en ese orden y con sus tres colores.
5. **El asistente propone, el usuario aprueba.** Todo lo de IA vive en la superficie arena y
   termina en una acción explícita.
6. **Calma antes que densidad.** Una sola acción violeta por pantalla (el botón +). Sin sombras
   decorativas ni gradientes de relleno.

Reglas que se agregan:

7. **Cada cifra se calcula con lo que ve quien mira.** Nunca se muestra un total que incluya
   cuentas privadas de otro miembro.
8. **Firecent registra, no ejecuta.** Donde una acción pueda leerse como mover dinero ("Record
   payment", transferencias, recurrentes Auto) el copy lo aclara:
   `This records it in Firecent. It does not move money at your bank.`
9. **El color nunca es el único indicador**: siempre hay signo, ícono o texto.
10. **Cuatro estados por pantalla**: con datos, vacío, carga y error (sección 4.1).

## 2. Mapa de navegación

### 2.1 Mobile (menos de 1024 px)

```
Tab bar  ─┬─ Home ──────────── Balance → Accounts (con Shared / Only you ya elegido)
          │                    "Budget" → Budget
          │                    fila de Coming up → Recurring (hoja detail o confirm) / Account (tarjeta)
          │                    "See all" → Recurring
          │                    insight → Recurring con chip Subscriptions / Assistant (hilo)
          │                    campana → Notifications
          │                    selector de Space → hoja Spaces
          ├─ Transactions ──── fila → hoja Transaction detail
          │                    filtro → hoja Filters
          ├─ +  ────────────── hoja Add transaction (desde cualquier pantalla)
          ├─ Assistant ─────── chat nuevo / hilo / hoja Threads
          └─ More ──────────── Accounts → Account detail → hojas Record payment, Installment plan
                               Budget → hojas Edit plan, Category limit
                               Analytics
                               Recurring → hojas detail, confirm
                               Debts → hoja detail
                               Members, Categories, Labels, Import a statement
                               Profile, Appearance, Notifications, Security, Sign out
```

- El tab bar se ve en las cinco raíces y en las pantallas hijas de More. Se oculta con una hoja
  abierta, en Onboarding y dentro de un hilo del Assistant.
- Las pantallas hijas llevan barra superior con flecha atrás (`chevron-left`).
- El tab activo de una pantalla hija de More es **More**.

### 2.2 Desktop (1024 px o más)

```
┌ Sidebar 240 px ───────────┐┌ Contenido (máx. 1120 px, px-8) ───────────────────────┐
│ [M][D] Maya & Daniel  ⇅   ││ Título de página            [Search] [Ask] [🔔]       │
│ [+ Add transaction]       ││                                                        │
│ Home                      ││  …                                                     │
│ Transactions              ││                                                        │
│ Accounts                  ││                                    ┌ Panel Ask 400 px ┐│
│ Budget                    ││                                    │ Assistant        ││
│ Analytics                 ││                                    │ (opcional)       ││
│ Recurring                 ││                                    └──────────────────┘│
│ Debts                     ││                                                        │
│ ───────                   ││                                                        │
│ Assistant                 ││                                                        │
│ ───────                   ││                                                        │
│ Settings                  ││                                                        │
│ (M) Maya Torres           ││                                                        │
└───────────────────────────┘└────────────────────────────────────────────────────────┘
```

- More desaparece: sus destinos son elementos del sidebar. Settings agrupa Members, Categories,
  Labels, Appearance, Notifications y Security.
- El botón violeta `Add transaction` del sidebar es el equivalente del + (única acción violeta).
- `Ask` abre el asistente en un panel derecho sobre cualquier pantalla, con el contexto de esa
  pantalla. `Assistant` en el sidebar abre la página completa.
- Las hojas inferiores pasan a ser: diálogo centrado de 480 px (formularios) o panel derecho de
  420 px (detalles). El selector de Space es un popover de 288 px anclado al sidebar.
- **Decisión**: entre 768 y 1023 px se usa el layout mobile centrado a 560 px con tab bar.

Atajos de teclado desktop: `N` nueva transacción, `/` buscar, `G` luego `H T A B Y R D` para ir a
Home, Transactions, Accounts, Budget, Analytics, Recurring, Debts. `Esc` cierra hoja o panel.

## 3. Sistema de diseño

### 3.1 Tokens de color

Valores efectivos (tokens del repo más `src/tokens.proposed.css`). La columna Utilidades lista las
clases que ya usa `home.html`.

| Token | Light | Dark | Utilidades | Uso |
| --- | --- | --- | --- | --- |
| `--background` | `#f4f6fa` | `#0b1220` | `bg-background`, `ring-background` | Fondo de página |
| `--foreground` | `#0b1220` | `#f4f6fa` | `text-foreground`, `bg-foreground/45` | Texto, marcador de ritmo |
| `--card` | `#ffffff` | `#11192a` | `bg-card`, `bg-card/85` | Tarjetas, hojas, tab bar |
| `--muted` | `#eef1f6` | `#17202f` | `bg-muted` | Pistas de barras, fichas de fecha e ícono |
| `--muted-foreground` | `#566275` | `#94a3b8` | `text-muted-foreground` | Texto secundario (AA sobre `card`, `background` y `muted`) |
| `--accent` | `#f1f4f9` | `#182236` | `hover:bg-accent`, `hover:bg-accent/60` | Hover y presionado |
| `--border`, `--input` | `#e2e8f0` | `#1e293b` | `border`, `divide-y`, `divide-x`, `border-t`, `border-input` | Bordes |
| `--primary` | `#5e54f0` | `#7758fb` | `bg-primary`, `text-primary-foreground` | Relleno violeta: botón +, paso activo, barra Shared |
| `--primary-foreground` | `#ffffff` | `#ffffff` | `text-primary-foreground` | Texto sobre violeta |
| `--primary-text` | `#5046e0` | `#a99bff` | `text-primary-text` | Violeta como texto o enlace, tab activo |
| `--ring` | `#7c5cff` | `#a78bfa` | `outline` de `:focus-visible` | Foco |
| `--positive` | `#047857` | `#34d399` | `text-positive` | Dinero que entra |
| `--warning` | `#b45309` | `#fbbf24` | `text-warning` | Vence pronto, por encima del ritmo |
| `--destructive` | `#dc2626` | `#f87171` | `text-destructive`, `bg-destructive` | Sobre el límite, borrar |
| `--nature-owe` | `#334155` | `#a9b4c6` | `bg-nature-owe` | Bolsa Owe |
| `--nature-need` | `#5e54f0` | `#9a88fb` | `bg-nature-need` | Bolsa Need |
| `--nature-want` | `#f9622f` | `#ff7a3d` | `bg-nature-want` | Bolsa Want, punto de no leídas |
| `--assistant` | `#fff7f0` | `#1e1714` | `bg-assistant` | Superficie del asistente |
| `--assistant-border` | `#fbdcc8` | `#3d261b` | `border-assistant-border` | Borde de esa superficie |
| `--assistant-accent` | `#c2410c` | `#ffa983` | `text-assistant-accent` | Texto de acento del asistente |
| `--sidebar` | `#ffffff` | `#080e1a` | `bg-sidebar` | Sidebar desktop |
| `--brand-purple` / `-foreground` | `#ede9fe` / `#6d28d9` | `#5b21b6` / blanco 87% | `bg-brand-purple text-brand-purple-foreground` | Avatar de Maya |
| `--brand-orange` / `-foreground` | `#ffedd5` / `#c2410c` | `#9a3412` / blanco 87% | `bg-brand-orange text-brand-orange-foreground` | Avatar de Daniel |

- Los diez colores del enum `Colors` (`default gray brown orange yellow green blue purple pink red`)
  existen como `bg-brand-{c} text-brand-{c}-foreground`. Se usan **solo** en avatares y labels.
- **Decisión**: las fichas de ícono de categoría y de cuenta son neutras (`bg-muted
  text-foreground`). La naturaleza se marca con el cuadrito de color, no pintando el ícono.
- Tintes para pastillas: `bg-warning/12`, `bg-positive/12`, `bg-destructive/10`, `bg-primary/10`.
- Velo de hojas: `bg-[#0b1220]/50` en ambos temas.
- No hay tokens nuevos que agregar más allá de `tokens.proposed.css`.
- Logos: `assets/brand/logo.svg` (claro), `logo_d.svg` (oscuro), `icon.svg`. Gradientes de marca
  (Fire `#FF3F3A → #FFA64F`, Grupo `#3A2EDB → #A78BFA`) solo dentro de la flama, nunca como relleno de UI.

### 3.2 Tipografía

Inter Variable (`assets/fonts/InterVariable.ttf`), con `font-optical-sizing: auto`. Base del
`body`: 15 px, `line-height: 1.45`. Toda cifra lleva la clase `.num` (tabular).

| Rol | Clases | Dónde |
| --- | --- | --- |
| Cifra héroe | `num text-[44px] leading-[48px] font-semibold tracking-[-0.035em]`; el `$` y los centavos en `text-[26px] font-medium text-muted-foreground` | Primer número de cada pantalla |
| Cifra héroe de hoja | `num text-[34px] leading-[40px] font-semibold tracking-[-0.03em]` | Detalle de transacción, monto del alta rápida |
| Título de pantalla raíz | `text-[28px] leading-[34px] font-semibold tracking-[-0.02em]` | `h1` de Transactions, Assistant, More |
| Título desktop | `text-[24px] leading-[32px] font-semibold tracking-[-0.02em]` | `h1` de cada página en desktop |
| Cifra de tarjeta | `num text-[20px] font-semibold tracking-[-0.02em]` | Money in, Left to spend |
| Título de sección | `text-[17px] font-semibold tracking-[-0.01em]` | `h2`, título de barra superior y de hoja |
| Cifra de fila destacada | `num text-[16px] font-semibold` | Shared / Only you, subtotales |
| Cuerpo | `text-[15px]` (heredado), filas con `font-medium` | Nombre de fila, monto de fila |
| Secundario | `text-[14px]` | Enlaces, botones, texto de apoyo (`leading-[20px]` o `[21px]`) |
| Etiqueta | `text-[13px] text-muted-foreground` | Rótulos sobre cifras, segunda línea de fila |
| Nota | `text-[12px] text-muted-foreground` | Pies, pastillas, ejes de gráficas |
| Tab | `text-[11px] font-medium` (activo `font-semibold`) | Tab bar |

Los campos de texto usan `text-[16px]` para que iOS no haga zoom.

### 3.3 Espaciado, radios y elevación

| Qué | Valor |
| --- | --- |
| Margen lateral de página | `px-5` (20 px). Desktop `px-8` |
| Ancho de contenido | mobile `max-w-[430px]`; desktop `max-w-[1120px]`, rejilla `grid-cols-12 gap-6` |
| Encabezado a primer bloque | `pt-6` |
| Entre secciones | `pt-7` |
| Título de sección a tarjeta | `mt-3` |
| Relleno de tarjeta y de fila | `p-4`; entre ícono y texto `gap-3` |
| Espacio para el tab bar | `pb-28` en el contenedor |
| Radio base | `--radius: 0.75rem` |
| Tarjeta | `rounded-2xl` (16 px) |
| Botón, campo, ficha de ícono o fecha | `rounded-xl` (12 px) |
| Hoja y diálogo | `rounded-t-3xl` / `rounded-3xl` (24 px) |
| Botón + | `rounded-[20px]` |
| Pastilla, chip, avatar, barra | `rounded-full` |
| Cuadrito de naturaleza | `size-2.5 rounded-[3px]` |
| Sombra | Ninguna en tarjetas. Solo botón + (`shadow-[0_8px_20px_-6px_color-mix(in_srgb,var(--primary)_70%,transparent)]`), hojas (`shadow-[0_-8px_30px_-12px_rgb(11_18_32/0.25)]`), popovers y toast (`shadow-lg`) |
| Objetivo táctil | mínimo 44 × 44 px (`h-11`, `size-11`, `min-h-14` en filas). Si el dibujo es menor, se extiende con `relative after:absolute after:-inset-y-1 after:content-['']`. En desktop los controles pueden medir 40 px (`h-10`) |

### 3.4 Componentes que ya existen en `home.html` (reutilizar tal cual)

| ID | Componente | Clases clave |
| --- | --- | --- |
| E1 | Selector de Space | `-ml-2 flex h-11 items-center gap-2.5 rounded-full pr-3 pl-2 hover:bg-accent`; avatares `size-7 … ring-2 ring-background` en `-space-x-2`; nombre `text-[15px] font-semibold`; `chevrons-up-down size-4` |
| E2 | Botón de ícono | `grid size-11 place-items-center rounded-full hover:bg-accent`, ícono `size-[22px]`; punto de no leídas `size-2.5 rounded-full bg-nature-want ring-2 ring-background` |
| E3 | Cifra héroe | Ver 3.2. Rótulo encima `text-[13px] font-medium text-muted-foreground` |
| E4 | Línea de cambio | `mt-2 flex items-center gap-1.5 text-[14px]`; valor `font-medium text-positive` con `trending-up size-4`; contexto en `text-muted-foreground` |
| E5 | Línea de tendencia | `svg` `viewBox="0 0 100 72"`, trazo 2 px `var(--primary)`, área con gradiente 16% → 0, punto final `size-2.5 bg-primary ring-[3px] ring-background`. Suavizado leve (tensión 0.3) |
| E6 | Barra partida Shared / Only you | `flex h-1 gap-0.5`: `bg-primary` al ancho de lo compartido, resto `bg-muted-foreground/55`; debajo dos enlaces `min-h-14` con rótulo + ícono (`users`, `lock`) y cifra |
| E7 | Encabezado de sección | `flex items-baseline justify-between`; `h2` + enlace `-my-3 -mr-2 flex h-11 items-center px-2 text-[14px] font-medium text-primary-text` |
| E8 | Tarjeta | `rounded-2xl border bg-card`; secciones internas separadas con `border-t` o `divide-y` |
| E9 | Par de cifras | `dl grid grid-cols-2 divide-x`, cada celda `p-4`: rótulo con ícono `size-4` + cifra de tarjeta |
| E10 | Barra de bolsa con marcador de ritmo | Fila `flex items-baseline justify-between text-[14px]` (cuadrito + nombre / `$gastado` `of $plan`); pista `relative mt-2 h-1.5 rounded-full bg-muted` con `role="progressbar"`; relleno `bg-nature-*`; marcador `absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground/45` en `left: 40%` |
| E11 | Fila con ficha de fecha | `flex items-center gap-3 p-4 hover:bg-accent/60`; ficha `grid size-11 rounded-xl bg-muted` (día `text-[11px]`, número `text-[16px] font-semibold`); título + monto; segunda línea `text-[13px]` + marca `text-[12px]` con ícono `size-3` (`repeat` Auto, `hand` Manual, `arrow-down-left` Expected, `clock` + `text-warning` Due in N days) |
| E12 | Pie de tarjeta con total | `flex items-baseline justify-between border-t px-4 py-3.5 text-[14px]` |
| E13 | Tarjeta del asistente | `relative rounded-2xl border border-assistant-border bg-assistant p-4`; antetítulo `text-[13px] font-medium text-assistant-accent` con flama `h-5`; título 17 px; cuerpo `text-[14px] leading-[21px] text-foreground/80`; cerrar `absolute top-1 right-1 size-11` |
| E14 | Botón primario | `inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-foreground` |
| E15 | Botón de contorno | `flex h-11 items-center rounded-xl border bg-card px-4 text-[14px] font-semibold` (sobre arena: `border-assistant-border`) |
| E16 | Botón de texto | `flex h-11 items-center rounded-xl px-3 text-[14px] font-medium text-primary-text` (en arena: `text-assistant-accent`) |
| E17 | Tab bar y botón + | `nav fixed inset-x-0 bottom-0 z-10 … border-t bg-card/85 backdrop-blur-xl`; `ul grid grid-cols-5 px-2 pt-1.5 pb-7`; elemento `flex h-12 flex-col items-center justify-center gap-1`, activo `text-primary-text` con `aria-current="page"`; + `-mt-5 size-14 rounded-[20px] bg-primary ring-4 ring-background` |
| E18 | Esqueleto | Bloques `.sk` con la forma final, dentro de un contenedor `aria-busy="true"` con `<p class="sr-only" role="status">` |
| E19 | Lista de pasos (vacío de Home) | `ol divide-y rounded-2xl border bg-card`; número `size-7 rounded-full` (activo `bg-primary text-primary-foreground`, pendiente `border text-muted-foreground`) |
| E20 | Leyenda del marcador | `mt-2 flex items-center gap-2 text-[12px] text-muted-foreground` con raya `h-3 w-0.5 bg-foreground/45` |

### 3.5 Componentes nuevos

| ID | Componente | Especificación |
| --- | --- | --- |
| N1 | Barra superior de pantalla hija | `header flex h-14 items-center gap-1 px-2`: E2 con `chevron-left` (`aria-label="Back"`), título `flex-1 truncate text-[17px] font-semibold`, hasta dos acciones E2 o un E16 |
| N2 | Fila de transacción | `flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-accent/60`. Ficha `grid size-10 shrink-0 place-items-center rounded-xl bg-muted` con ícono de categoría `size-5`. Centro: nombre `truncate font-medium`; meta `mt-0.5 flex items-center gap-1 truncate text-[13px] text-muted-foreground`. Derecha: monto `num shrink-0 font-medium` y, si aplica, segunda cifra `text-[12px] text-muted-foreground` |
| N3 | Encabezado de día | `flex items-baseline justify-between px-1 pt-5 pb-2 text-[13px] font-medium text-muted-foreground`: fecha a la izquierda, neto del día a la derecha (`num`) |
| N4 | Chip | `relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3.5 text-[14px] font-medium` + extensión táctil. Seleccionado: `border-transparent bg-foreground text-background` y `aria-pressed="true"`. Removible: `x size-3.5` al final. Fila de chips: `flex gap-2 overflow-x-auto px-5` |
| N5 | Control segmentado | `flex h-11 rounded-xl bg-muted p-1`; opción `flex-1 rounded-lg text-[14px] font-medium text-muted-foreground`; activa `bg-card text-foreground shadow-[0_1px_2px_rgb(11_18_32/0.12)]` con `aria-pressed="true"` |
| N6 | Hoja inferior | Velo `fixed inset-0 z-40 bg-[#0b1220]/50`. Hoja `fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92dvh] max-w-[430px] overflow-y-auto rounded-t-3xl bg-card pb-8` + sombra de hoja, `role="dialog" aria-modal="true" aria-labelledby`. Asa `mx-auto mt-2.5 h-1 w-9 rounded-full bg-muted-foreground/30`. Cabecera `flex h-14 items-center justify-between px-5` (título 17 px + E2 con `x`, `aria-label="Close"`). Desktop: diálogo `lg:top-1/2 lg:left-1/2 lg:w-[480px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl`, o panel `lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[420px] lg:max-h-none lg:rounded-none lg:border-l` |
| N7 | Fila de campo | Dentro de E8: `flex min-h-14 items-center justify-between gap-3 px-4`; rótulo `text-muted-foreground`; valor `font-medium` + `chevron-right size-4 text-muted-foreground` si abre algo |
| N8 | Campo de texto | `h-12 w-full rounded-xl border border-input bg-card px-3.5 text-[16px] placeholder:text-muted-foreground`; rótulo encima `mb-1.5 block text-[13px] font-medium`; error: `border-destructive` + `mt-1.5 text-[13px] text-destructive` con `circle-alert size-3.5` y `aria-describedby` |
| N9 | Teclado numérico | `grid grid-cols-3 gap-1 px-3`; tecla `h-14 rounded-xl text-[22px] font-medium active:bg-accent`. Orden `1 2 3 / 4 5 6 / 7 8 9 / . 0 ⌫` (`delete size-6`, `aria-label="Delete"`) |
| N10 | Pastilla | `inline-flex h-6 items-center gap-1 rounded-full px-2 text-[12px] font-medium`. Neutra `bg-muted text-muted-foreground`; Shared `bg-primary/10 text-primary-text` + `users size-3`; Only you neutra + `lock size-3`; aviso `bg-warning/12 text-warning`; positiva `bg-positive/12 text-positive`; error `bg-destructive/10 text-destructive` |
| N11 | Fila de categoría con límite | `px-4 py-3`: ficha `size-9 rounded-xl bg-muted` + nombre `font-medium` + derecha `num text-[14px]` `$709.46` `of $900`; debajo pista `mt-2 h-1 rounded-full bg-muted` con relleno del color de su bolsa; debajo estado `mt-1.5 text-[12px]` |
| N12 | Toast | `fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-[398px] items-center justify-between gap-3 rounded-2xl bg-foreground px-4 py-3 text-[14px] text-background shadow-lg`, `role="status"`; acción `-my-2 -mr-2 flex h-11 items-center px-2 font-semibold`. Dura 6 s. Desktop: `lg:left-auto lg:right-8 lg:bottom-8 lg:w-[360px]` |
| N13 | Bloque de vacío o error | `flex flex-col items-center px-8 py-12 text-center`: ficha `grid size-14 place-items-center rounded-2xl bg-muted` con ícono `size-6 text-muted-foreground`; título `mt-4 text-[17px] font-semibold`; cuerpo `mt-1.5 max-w-[280px] text-[14px] leading-[20px] text-muted-foreground`; botones `mt-5` |
| N14 | Aviso en línea | `mx-5 flex items-start gap-2.5 rounded-xl bg-muted px-3.5 py-3 text-[13px] leading-[19px]` con ícono `size-4 mt-0.5`. Variante aviso: `bg-warning/12` con ícono `text-warning` |
| N15 | Fila de navegación | `flex min-h-14 items-center gap-3 px-4 hover:bg-accent/60`: ficha `size-9 rounded-xl bg-muted` con ícono `size-[18px]`, rótulo `flex-1 font-medium`, vista previa `num text-[14px] text-muted-foreground`, `chevron-right size-4` |
| N16 | Fila de cuenta | Como N2 con ficha `size-11`. Ícono por tipo: `landmark` Checking, `piggy-bank` Savings, `banknote` Cash, `credit-card` Credit card. Meta: tipo + `·· 4821`; si es privada, `lock size-3` antes del tipo |
| N17 | Barra de progreso de deuda o plan | Pista `h-1.5 rounded-full bg-muted`, relleno `bg-foreground/70`. Plan a meses: segmentos `flex gap-1`, cada uno `h-1.5 flex-1 rounded-full` (`bg-foreground/70` facturado, `bg-muted` pendiente) |
| N18 | Mensaje del usuario | `ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-[15px] leading-[22px]` |
| N19 | Mensaje del asistente | Sin burbuja: flama `firecent h-5` + texto `text-[15px] leading-[22px]` a todo el ancho; tablas `w-full text-[14px]` con `border-t` por fila; chip de fuente = N10 neutra con `receipt size-3` |
| N20 | Tarjeta de propuesta | E13 con: antetítulo `Suggested change`; título = resumen; lista `dl mt-3 divide-y divide-assistant-border rounded-xl border border-assistant-border bg-card` con filas `flex justify-between gap-3 px-3.5 py-2.5 text-[14px]`; botones `mt-4 flex gap-2`: `Approve` (E14), `Edit` (E15), `Dismiss` (E16 en `text-muted-foreground`); pie `mt-3 text-[12px] text-muted-foreground` |
| N21 | Compositor del chat | `fixed inset-x-0 bottom-0 mx-auto max-w-[430px] border-t bg-card/85 px-3 pt-2 pb-7 backdrop-blur-xl`: E2 `paperclip`, `textarea` de una a cinco líneas `min-h-11 flex-1 rounded-2xl bg-muted px-4 py-2.5 text-[16px]`, enviar `grid size-11 rounded-full bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground` con `arrow-up` |
| N22 | Sidebar desktop | `hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r bg-sidebar px-3 py-4`. Elemento `flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground`; activo `bg-accent text-foreground` + `aria-current="page"`; ícono `size-[18px]`. Contenido `lg:pl-60` |
| N23 | Tabla desktop | `w-full text-[14px]`; cabecera `h-10 text-left text-[12px] font-medium text-muted-foreground border-b`; fila `h-13 border-b hover:bg-accent/60`; montos alineados a la derecha con `.num` |
| N24 | Interruptor | `relative h-7 w-12 rounded-full bg-input aria-checked:bg-primary` con perilla `size-6 rounded-full bg-white` y `role="switch"`; la fila completa (N7) es el objetivo táctil |
| N25 | Progreso de onboarding | `flex gap-1.5`: barras `h-1 flex-1 rounded-full bg-muted`, hechas y actual `bg-primary`; `aria-label="Step 2 of 3"` |
| N26 | Avatar | `grid size-7 place-items-center rounded-full bg-brand-{c} text-[12px] font-semibold text-brand-{c}-foreground`. Tamaños: 16 px en meta de fila (`size-4 text-[9px]`), 28 px, 40 px en More |

Íconos de navegación: Home `house`, Transactions `arrow-left-right`, + `plus`, Assistant
`firecent-mono`, More `layout-grid`, Accounts `wallet`, Budget `target`, Analytics `chart-column`,
Recurring `repeat`, Debts `hand-coins`, Settings `settings`.

## 4. Patrones transversales

### 4.1 Estados

| Estado | Regla | Copy por defecto |
| --- | --- | --- |
| Carga | Esqueleto E18 con la forma final de la pantalla. Nunca un spinner a pantalla completa. Si tarda menos de 300 ms no se muestra | `sr-only`: `Loading …` |
| Vacío | La cifra héroe en `text-muted-foreground/70` con `$0.00`, y debajo un N13 o una lista E19 con el siguiente paso real. Cada pantalla define su texto | |
| Error de carga | N13 con `cloud-off`, en lugar del contenido; la navegación sigue visible | Título `We couldn't load this`. Cuerpo `Check your connection and try again. Nothing was changed.` Botón E15 `Try again` |
| Error al guardar | La hoja no se cierra y no se pierde lo capturado. N14 variante aviso arriba del botón | `Couldn't save. Your entry is still here.` Botón: `Try again` |
| Sin conexión | N14 fijo bajo el encabezado, con `wifi-off` | `You're offline. Showing what was loaded last.` |
| Sin resultados | N13 con `search` | Título `Nothing matches`. Cuerpo `Try a different word or remove a filter.` Botón E16 `Clear filters` |
| Éxito | Toast N12 con deshacer cuando la acción se puede revertir | `Saved`, `Transaction deleted` + `Undo` |

**Decisión**: borrar es reversible (`deletedAt`). No hay diálogo de confirmación; hay toast con
`Undo` por 6 s. Solo se confirma con diálogo lo que expone datos o cambia un automatismo: compartir
una cuenta privada, activar Auto, salir de un Space.

Diálogo de confirmación: N6 en variante diálogo, título 17 px, cuerpo 14 px, botones apilados en
mobile (E14 arriba, E16 abajo).

### 4.2 Montos

- Formato `en-US`: `$1,234.56`. Negativo con `−` (U+2212). Estimado con `~` delante.
- En listas de **movimientos**: gasto `−$41.24` en tinta, ingreso `+$2,975.00` en `text-positive`,
  transferencia `$1,800.00` en `text-muted-foreground` sin signo.
- En listas de **pagos por venir** (Coming up, Recurring): el gasto va sin signo, el ingreso con `+`.
- Otra moneda: monto en la moneda de la cuenta (`−MX$1,050.00`) y debajo `≈ −$56.85` en 12 px gris.
- Porcentajes de reparto: enteros, redondeo por resto mayor para que sumen 100.
- Las cifras de plan sin centavos cuando son redondas: `of $3,300`.

### 4.3 Privacidad (Shared / Only you)

- Control de alcance (N5) con tres opciones: `Everything` · `Shared` · `Only you`. Aparece en
  Accounts, Budget, Analytics y dentro de la hoja de filtros de Transactions. Default `Everything`.
  **Decisión**: el alcance elegido se conserva al navegar entre esas pantallas durante la sesión.
- En un Space de una sola persona el control y los candados no se muestran.
- Cuenta privada: `lock size-3` antes del tipo en su fila y pastilla `Only you` en su detalle.
- Movimiento en cuenta privada: `lock size-3` antes del nombre de la cuenta en la meta de la fila.
- Movimiento capturado por otro miembro: avatar de 16 px al final de la meta, con
  `aria-label="Added by Daniel"`.
- Transferencia desde o hacia una cuenta privada de otro miembro: `From a private account` /
  `To a private account`.

### 4.4 Accesibilidad y movimiento

- Contraste AA: texto normal 4.5:1, texto de 18 px o más y elementos gráficos 3:1. Los pares de
  la tabla 3.1 ya cumplen. No usar `text-muted-foreground` con opacidad sobre `bg-muted`.
- Foco visible: `outline: 2px solid var(--ring); outline-offset: 2px` (ya en `src/app.css`).
- Toda barra lleva `role="progressbar"` con `aria-label` en texto ("Need, 59% of plan spent").
- Toda gráfica lleva `role="img"` con `aria-label` que resume el dato, y un botón `View as table`.
- Hojas: foco atrapado, `Esc` cierra, al cerrar el foco vuelve al disparador.
- Los íconos decorativos llevan `aria-hidden` (lo pone `icons.js`). Un botón que solo tiene ícono
  lleva `aria-label`.
- Movimiento: hojas 240 ms `cubic-bezier(0.32, 0.72, 0, 1)`, toast 160 ms, barras 400 ms al
  entrar. Con `prefers-reduced-motion: reduce` todo aparece sin transición.

## 5. Pantallas

Cada pantalla: objetivo, bloques en orden, copy, interacciones, estados y cambios en desktop. Las
cifras vienen de `mock-data.md` (Space *Maya & Daniel*, mira Maya, hoy jueves 12 nov 2026).

### 5.1 Home

**Objetivo**: responder en diez segundos cuánto tengo, cómo va el mes y qué viene.

**Mobile**: ya construida en `home.html`. No se rediseña. Tres ajustes al tocarla: mover el tab bar
a `proto.js`, reemplazar las tres últimas posiciones de la serie de la línea por la de
`mock-data.md` sección 8, y agregar el estado `error` (4.1).

Destinos de sus enlaces: `Shared` → `accounts.html` con alcance Shared; `Only you` → alcance Only
you; `Budget` → `budget.html`; `See all` → `recurring.html`; fila Netflix o Con Edison → hoja
`detail` o `confirm` de Recurring; fila `Pay Sapphire Reserve` → `account.html?id=3`; `Review
subscriptions` → `recurring.html` con el chip Subscriptions; `Ask about it` → `assistant.html?view=thread`.

**Desktop** (`lg:`), rejilla de 12 columnas:

| Zona | Columnas | Contenido |
| --- | --- | --- |
| Cabecera | 12 | `h1` visible `Home` (24 px). A la derecha: `Ask` (E15 con `firecent-mono`), campana (E2). El selector de Space pasa al sidebar |
| Balance | 1–7 | E3 + E4 iguales. Línea E5 a `h-[180px]`, con seis marcas de eje `Jun Jul Aug Sep Oct Nov` en 12 px y, al pasar el cursor, una regla vertical con etiqueta `Oct 1 · $34,618.93`. Debajo E6 |
| November | 8–12 | La misma tarjeta (E9 + E10 + pie) y la leyenda E20 |
| Coming up | 1–7 | La misma tarjeta E11 con pie E12 |
| Insight | 8–12 | E13 igual |
| Recent | 8–12, bajo Insight | **Decisión**: solo desktop. Encabezado E7 `Recent` + enlace `All transactions`. Tarjeta con las 5 últimas filas N2: DoorDash −$41.24, McNally Jackson −$25.31, Union Sq Greenmarket −$38.00, Ticketmaster −$142.60, Blue Bottle −$6.75 |

Vacío en desktop: Balance en gris a la izquierda y la lista E19 `Three steps to a full picture` a
la derecha (columnas 8–12). Carga: los mismos esqueletos en dos columnas.

### 5.2 Transactions

**Objetivo**: encontrar cualquier movimiento y entender un día o un mes de un vistazo.

**Bloques (mobile)**

1. `h1` `Transactions` (título raíz), `px-5 pt-3`.
2. Fila de búsqueda, `mt-3 flex gap-2 px-5`: campo N8 a `h-11` con `search size-4` dentro y
   placeholder `Search payee, note or amount`; a su derecha E2 con borde (`rounded-xl border
   bg-card`) e ícono `sliders-horizontal`, `aria-label="Filters"`. Con filtros activos lleva un
   contador `absolute -top-1 -right-1 grid size-5 rounded-full bg-foreground text-[11px]
   font-semibold text-background`.
3. Chips N4, `mt-3`: `All` · `Owe` · `Need` · `Want` · `Income` · `Transfers`. Los tres de
   naturaleza llevan su cuadrito. Selección única.
4. Mes, `mt-5 px-5 flex items-center justify-between`: E2 `chevron-left` (`aria-label="Previous
   month"`), centro `November 2026` (17 px semibold) con debajo `$6,125.00 in · $4,812.14 out`
   (13 px gris, `.num`), E2 `chevron-right` deshabilitado en el mes actual.
5. Lista por día, `px-5`: N3 (`Today` / `−$104.55`) y una tarjeta E8 `divide-y` con sus filas N2.
   Encabezados: `Today`, `Yesterday`, luego `Tue, Nov 10`. Neto positivo en `text-positive`
   (`+$2,866.15` el 6 nov).
6. Pie de lista: `That's all for November` (13 px gris, centrado) y E15 `Show October`.

**Fila N2 según el tipo**

| Caso | Nombre | Meta | Monto |
| --- | --- | --- | --- |
| Gasto | `DoorDash` | `Dining out · Joint Checking` | `−$41.24` |
| Gasto en cuenta privada | `McNally Jackson` | `Shopping ·` `lock` `Amex Gold` | `−$25.31` |
| Capturado por otro | `Costco` | `Groceries · Joint Checking ·` avatar D | `−$211.36` |
| Generado por recurrente | `Spotify` | `repeat` `Subscriptions · Sapphire Reserve` | `−$18.99` |
| Otra moneda | `Liverpool` | `Gifts ·` `lock` `BBVA México` | `−MX$1,050.00` y debajo `≈ −$56.85` |
| Ingreso | `Lumen Labs` | `Paycheck ·` `lock` `Maya's Checking` | `+$2,975.00` en `text-positive` |
| Transferencia | `Maya's Checking → Joint Checking` | `Transfer · Maya's share` | `$1,800.00` gris; ficha con `arrow-left-right` |
| Con label | `Target` | `Household · Joint Checking ·` avatar D | `−$64.90`; pastilla N10 `Reimbursable` bajo la meta |

**Hoja Filters** (`?sheet=filters`), título `Filters`:

- `Show` → N5 `Everything` · `Shared` · `Only you`.
- `Type` → N5 `All` · `Expenses` · `Income` · `Transfers`.
- `Owe, Need or Want` → chips N4 de selección múltiple.
- `Account` → lista con casilla (`check size-4` a la derecha), las 7 cuentas con su ícono.
- `Category` → fila N7 `Any category` que abre la lista con buscador.
- `Added by` → N5 `Anyone` · `Maya` · `Daniel`.
- `Amount` → dos campos N8 lado a lado, `Min` y `Max`.
- `Label` → chips N4.
- Pie fijo: E16 `Clear all` y E14 a todo lo ancho restante `Show 22 transactions` (el número se
  recalcula en vivo; con cero: `No transactions match`, deshabilitado).

Con filtros activos, bajo los chips aparece una fila de chips removibles (`Want ×`, `Sapphire
Reserve ×`) y la línea `22 transactions · $935.25`. La búsqueda filtra al escribir (espera de 200 ms).

**Hoja Transaction detail** (`?sheet=detail`, ejemplo: 1041 Ticketmaster):

1. Cabecera: `x` a la izquierda, E16 `Edit` a la derecha.
2. Centro: ficha `size-14 rounded-2xl bg-muted` con `ticket size-6`; `Ticketmaster` (20 px
   semibold); monto héroe de hoja `−$142.60`; `Wed, Nov 11, 2026` (13 px gris).
3. Tarjeta de filas N7: `Category` → `Entertainment`; `Counts as` → N5 compacto `Owe` · `Need` ·
   `Want` con `Want` activo; `Account` → `Joint Checking` + pastilla `Shared`; `Added by` →
   avatar + `Maya`; `Note` → `Bleachers, 2 tickets`; `Labels` → `Add label` (E16).
   Bajo `Counts as`, al cambiarlo: `Changes only this transaction.` (12 px gris).
4. Tarjeta de relación, solo si existe (una fila N15):
   - deuda: `Sofía Torres owes you $71.30 for this`
   - recurrente: `Part of Spotify Duo · Monthly on the 5th`
   - plan: `Installment plan · 4 of 6 billed`
5. Acciones: fila N15 `Make recurring` (`repeat`), fila N15 `Duplicate` (`copy`), y
   `Delete transaction` en `text-destructive` (`trash-2`).

Borrar: la hoja se cierra y aparece el toast `Transaction deleted` + `Undo`.
`Edit` convierte las filas en campos (el formulario completo de 5.3).

**Estados**

- Vacío: N13 con `receipt`. Título `No transactions yet`. Cuerpo `Add your first one with the +
  button, or import a statement and approve what gets saved.` Botones: E14 `Add transaction`, E16
  `Import a statement` (lleva al Assistant).
- Sin resultados, carga (búsqueda + dos días de tres filas en esqueleto) y error: 4.1.

**Desktop**: cabecera con `h1`, buscador de 320 px, `Filters` (E15) y `Export CSV` (E16). Bajo la
cabecera, la fila de chips y el selector de mes en una línea. La lista pasa a tabla N23 dentro de
una tarjeta: casilla · `Date` · `Payee` (con ficha de ícono de 32 px) · `Category` · `Account`
(con candado) · `By` (avatar) · `Amount`. Los encabezados de día se conservan como filas de grupo
(`bg-muted/50`, 12 px). Clic en fila abre el detalle en panel derecho de 420 px sin tapar la
tabla. Con casillas marcadas aparece una barra sobre la tabla: `3 selected` · `Change category` ·
`Add label` · `Delete`. Filters abre como popover de 360 px.

### 5.3 Add transaction (alta rápida)

**Objetivo**: registrar un gasto en **tres toques como máximo**: `+`, categoría, `Save`. Las
teclas del monto son entrada de datos, no toques de navegación. Con la fila Repeat tampoco hay
que teclear: `+`, frecuente, `Save`.

Hoja N6 (`?sheet=add`), sin cabecera de título. De arriba a abajo:

1. N5 `Expense` · `Income` · `Transfer` (default `Expense`) y `x` a la derecha.
2. Monto, centrado, `py-5`: cifra héroe de hoja `$0.00` en `text-muted-foreground/70` hasta que
   se teclea. Debajo, en 13 px gris, la moneda si la cuenta no es USD: `Mexican pesos`.
3. `Repeat` (rótulo 12 px gris, `px-5`): chips N4 `Blue Bottle · $6.75`, `Trader Joe's`,
   `MTA OMNY · $34.00`. Tocar uno llena monto, categoría y cuenta.
4. Categorías: `grid grid-cols-4 gap-2 px-5`. Ocho celdas `flex h-[68px] flex-col items-center
   justify-center gap-1.5 rounded-xl border bg-card text-[12px] font-medium` con ícono `size-5`.
   Las siete más probables para esa hora y cuenta, y la octava `More` (`ellipsis`) que abre la
   lista completa agrupada por Owe, Need y Want con buscador. Orden inicial del mock: `Groceries`,
   `Dining out`, `Transport`, `Shopping`, `Entertainment`, `Health`, `Household`, `More`.
   Seleccionada: `border-transparent bg-foreground text-background`.
5. Fila de contexto, `flex gap-2 overflow-x-auto px-5`: chips N4 `Joint Checking` (con
   `chevron-down`), `Today`, `Add note`. Cuenta por defecto: la última usada por ese miembro.
6. Teclado N9.
7. E14 a todo lo ancho, `h-13`, `mx-5`: `Save` y, con monto, `Save $41.24`. Deshabilitado
   (`bg-muted text-muted-foreground`) hasta tener monto y categoría; mientras falte categoría el
   texto es `Pick a category`.
8. E16 centrado `More details`: despliega `Payee` (autocompletar), `Note`, `Labels` y, si la cuenta
   es tarjeta de crédito, el interruptor N24 `Pay in installments`.

**Reglas**

- El monto se teclea natural: `4`, `1`, `.`, `2`, `4` → `$41.24`. Máximo dos decimales.
- **Decisión**: la categoría es obligatoria en un gasto; por eso el tercer toque siempre es `Save`.
- Al guardar: la hoja se cierra, toast `Saved · Dining out −$41.24` con acción `Add details` que
  abre el detalle de ese movimiento.
- `Pay in installments` activo muestra chips `3` `6` `9` `12` `18` `24` (`months`), el interruptor
  `0% interest` (activo por defecto) y la línea `$74.99 a month for 6 months`.
- `Income`: las celdas son las categorías de ingreso (`Paycheck`, `Other income`); el botón dice
  `Save +$2,975.00`.
- `Transfer`: en lugar de categorías, dos filas N7 `From` y `To`. Si las monedas difieren aparece
  un segundo campo `They receive` con `MX$` y la línea `1 USD = 18.47 MXN`. Botón `Save transfer`.
  Bajo el botón: `This records it in Firecent. It does not move money at your bank.`
- Error al guardar: 4.1.

**Desktop**: diálogo de 480 px. Sin teclado numérico: el monto es un campo con foco inicial. `Tab`
va a un combobox de categoría con las mismas ocho sugerencias; `Enter` guarda. Atajo `N`.

### 5.4 Accounts

**Objetivo**: ver todo lo que hay y lo que se debe, y quién puede ver cada cuenta.

**Bloques (mobile)**

1. N1: `Accounts`, acción E2 `plus` (`aria-label="Add account"`).
2. E3 con rótulo `Balance`: `$36,398.47`. Debajo, 14 px gris: `$38,857.19 in accounts · −$2,458.72 on cards`.
3. Alcance N5, `mt-5 mx-5`: `Everything` · `Shared` · `Only you`. Al cambiar, la cifra héroe pasa
   a `$30,874.23` o `$5,524.24` y la lista se filtra.
4. Tres grupos, cada uno con N3 (nombre / subtotal) y tarjeta E8 de filas N16:

| Grupo | Subtotal | Filas (nombre · meta → derecha) |
| --- | --- | --- |
| `Cash and checking` | `$12,472.73` | `Joint Checking` · `Checking ·· 4821` → `$8,420.55` |
| | | `Maya's Checking` · `lock` `Checking ·· 2260` → `$3,912.18` |
| | | `Cash` · `lock` `Cash` → `$140.00` |
| `Savings` | `$26,384.46` | `Emergency Fund` · `Savings ·· 9034` → `$24,300.00` |
| | | `BBVA México` · `lock` `Savings ·· 5512` → `MX$38,500.00` y debajo `≈ $2,084.46` |
| `Credit cards` | `−$2,458.72` | `Sapphire Reserve` · `clock` `Due Nov 15 · $1,512.80` en `text-warning` → `−$1,846.32` y debajo `$10,153.68 available` |
| | | `Amex Gold` · `lock` `Due Nov 28 · $268.90` → `−$612.40` y debajo `$7,387.60 available` |

   La meta de una tarjeta va en `text-warning` solo si vence en 7 días o menos. Si
   `displayCreditMode = AVAILABLE_CREDIT`, las dos cifras de la derecha se intercambian.
5. Tarjeta final con una fila N15: `Debts` (`hand-coins`), vista previa `You owe $19,885.00`.
   Debajo, 12 px gris: `Debts are tracked apart and are not part of Balance.`

**Hoja Add account** (`?sheet=add-account`), título `Add account`:

- `Type`: cuatro celdas como las de categoría: `Checking`, `Savings`, `Cash`, `Credit card`.
- `Name` (N8), placeholder `e.g. Joint Checking`.
- `Currency` (N7) → `US dollar (USD)`; abre lista con buscador.
- `Current balance` (N8, numérico). En tarjeta el rótulo es `What you owe today`.
- `Last 4 digits` (opcional).
- `Who can see it` (N5): `Maya & Daniel` · `Only you`. Debajo: `You can change this later.
  Sharing shows the full history.` No aparece en un Space de una persona.
- Solo tarjeta: `Credit limit`, `Statement closes on` (día 1–31), `Payment is due on` (día 1–31),
  `Pay it from` (cuenta), `APR` (opcional).
- E14 `Add account`. Error de nombre repetido: `That name is taken in this space.`

**Estados**: vacío → E3 en gris `$0.00` + N13 con `wallet`, título `No accounts yet`, cuerpo
`Add the accounts you use. Each one keeps its own currency and can be shared or private.`, E14
`Add account`. Carga: héroe + dos grupos de dos filas. Error: 4.1.

**Desktop**: héroe y alcance en la fila superior; los tres grupos en tres columnas
(`grid-cols-3`), cada uno su tarjeta; la fila de Debts debajo a todo lo ancho. Clic en una cuenta
navega a su detalle.

### 5.5 Account detail

**Objetivo**: saldo de una cuenta, qué le viene y sus movimientos. En tarjeta de crédito: cuánto
se debe, cuánto queda disponible, cuándo se paga y qué planes a meses tiene.

#### Cuenta normal (`?id=1`, Joint Checking)

1. N1: `Joint Checking`, acción E2 `ellipsis` → menú: `Edit account`, `Adjust balance`, `Make
   private` (o `Share with Maya & Daniel`), `Archive`.
2. E3 `Balance` `$8,420.55`. E4: `+$855.13` `since Nov 1`. Pastillas N10: `Shared` · `Checking ·· 4821`.
3. Tarjeta E9: `In` `$4,950.00` / `Out` `$4,094.87`. Pie 12 px gris: `Includes transfers.`
4. `Coming up` (E7 sin enlace) + tarjeta E11: `Sun 15` `Pay Sapphire Reserve` `$1,512.80` (`Due in
   3 days`); `Mon 16` `Daniel's paycheck` `+$3,150.00` (`Expected`); `Wed 18` `Con Edison`
   `~$94.00` (`Manual`). Pie E12: `Expected balance on Nov 19` → `~$9,963.75`.
5. `Transactions` (E7 con enlace `See all`, que abre Transactions filtrado por esta cuenta) +
   lista por día como en 5.2, primeras 10 filas.

Variantes: cuenta privada → pastilla `Only you` con candado. Cuenta en otra moneda → héroe
`MX$38,500.00` y línea `≈ $2,084.46 at 18.47 MXN per USD`.

**Diálogo Share** (`?sheet=share`): título `Share Maya's Checking?`. Cuerpo `Daniel will see this
account, its balance and all of its history, including past transactions.` Botones E14 `Share
account`, E16 `Keep private`. El inverso: `Make Joint Checking private?` · `Daniel will no longer
see this account or its transactions. Totals he sees will change.` · `Make private` / `Cancel`.

#### Tarjeta de crédito (`?id=3`, Sapphire Reserve)

1. N1: `Sapphire Reserve`, menú `ellipsis` igual más `Edit dates and limit`.
2. E3 con rótulo `You owe`: `$1,846.32` (sin signo: el rótulo ya lo dice). Pastillas `Shared` ·
   `Credit card ·· 7719`.
3. Barra de crédito, `mt-5`: pista `h-2 rounded-full bg-muted`, relleno `bg-foreground/70` al
   15.4%, `role="progressbar" aria-label="15% of credit limit used"`. Debajo, `flex
   justify-between text-[13px]`: `$10,153.68 available` (izquierda, `font-medium text-foreground`)
   y `of $12,000 limit` (derecha, gris).
4. Tarjeta `What makes up the balance` (E7 como título). Tres filas `px-4 py-3.5`, título +
   monto arriba y nota de 13 px abajo:

| Fila | Monto | Nota | Extra |
| --- | --- | --- | --- |
| `Statement due Nov 15` | `$1,512.80` | `Closed Oct 21 · Minimum $35.00` | pastilla aviso `Due in 3 days` |
| `Since the statement` | `$183.54` | `Next statement closes Nov 21` | |
| `Installments not billed yet` | `$149.98` | `1 plan` | |

   Pie E12: `You owe` → `$1,846.32`. Dentro de la tarjeta, bajo la primera fila: E15 a todo lo
   ancho `Record payment`.
5. `Installment plans` (E7) + tarjeta. Fila `px-4 py-3.5`: `Dyson V15 · Best Buy` / derecha `4 of
   6` (`num font-medium`); segunda línea `$74.99 a month · 0% interest`; barra N17 de 6 segmentos
   (4 llenos); tercera línea 12 px gris `$149.98 left · ends Dec 21`.
   Sin planes: texto dentro de la tarjeta, `p-4 text-[14px] text-muted-foreground`: `No
   installment plans. When you pay a purchase in installments, its schedule shows here.`
6. `Transactions` (E7) + N5 `Since statement` · `Statement Oct 21` + lista. `Since statement`
   muestra los 4 cargos de noviembre (`$125.07`) más los del 22 al 31 de octubre.
7. Tarjeta `Dates` de filas N7: `Statement closes` → `21st of each month`; `Payment is due` →
   `15th of each month`; `Paid from` → `Joint Checking`; `APR` → `24.99%`.

**Hoja Record payment** (`?sheet=pay-card`), título `Record a payment`:

- Tres opciones de radio (filas N7 con círculo a la izquierda): `Statement balance` `$1,512.80`
  (elegida), `Minimum payment` `$35.00`, `Another amount` (abre campo).
- `From` → `Joint Checking` · `$8,420.55`. `Date` → `Today`.
- E14 `Record $1,512.80`.
- Nota 12 px gris: `This records the payment in Firecent. It does not move money at your bank.`
- Resultado: una transferencia Joint Checking → Sapphire Reserve; la fila del estado de cuenta
  pasa a `Paid Nov 12` con `circle-check` en `text-positive`. Toast `Payment recorded` + `Undo`.
- Si el monto supera el saldo de la cuenta origen: aviso N14 `Joint Checking has $8,420.55.` (no bloquea).

**Hoja Installment plan** (`?sheet=plan`), título `Dyson V15 · Best Buy`:

- Cabecera: `$149.98 left` (cifra héroe de hoja) y `of $449.94 · 0% interest`.
- Barra N17 y `4 of 6 billed`.
- Lista de mensualidades (filas `flex justify-between px-4 py-3`, `1` a `6`, cada una `$74.99`):
  `Jul 21` `Aug 21` `Sep 21` → `Billed` (gris, con `check`); `Oct 21` → `In the statement due Nov
  15` (`text-warning`); `Nov 21` y `Dec 21` → `Upcoming`.
- Fila N15 `Original purchase` → `$449.94 · Jul 10` (abre el movimiento).
- E16 en `text-muted-foreground`: `Mark as paid off early`.

**Estados**: carga con la forma de cada variante. Error: 4.1. Cuenta sin movimientos: en la sección
Transactions, `No transactions in this account yet.` (14 px gris dentro de la tarjeta).

**Desktop**: dos columnas. Izquierda (1–5): héroe, barra de crédito, `What makes up the balance`,
`Dates`. Derecha (6–12): `Installment plans` y `Transactions` como tabla N23. Las hojas son diálogos.

### 5.6 Budget

**Objetivo**: saber cuánto queda para gastar este mes y en qué bolsa, y ajustar el plan.

**Bloques (mobile)**

1. N1: `Budget`, acción E16 `Edit plan` (solo owner y admin).
2. Mes: el mismo selector de 5.2 con `November 2026`.
3. E3 con rótulo `Left to spend`: `$2,587.86`. Debajo, 14 px gris: `$143.77 a day for 18 days`.
4. Barra total, `mt-5`: pista `h-2 bg-muted` con tres rellenos contiguos (`bg-nature-owe` 33.4%,
   `bg-nature-need` 19.0%, `bg-nature-want` 12.6% del plan total), sin marcador. Debajo, 13 px:
   `$4,812.14 spent` / `of $7,400 planned`.
5. Alcance N5.
6. Tres tarjetas, una por bolsa y en orden. Cada una:
   - Cabecera `p-4`: E10 completo (cuadrito, nombre, `$2,470.00` `of $3,300`, barra con marcador)
     y debajo `$830.00 left` (13 px gris).
   - Filas N11 de sus categorías con límite, luego las que no tienen límite (solo nombre y gastado,
     sin barra).
   - Pie E12: `Not assigned to a category` → `$250.00`, con E16 `Add a limit`.

| Bolsa | Cabecera | Filas con límite (gastado `of` límite · estado) | Sin límite | Pie |
| --- | --- | --- | --- | --- |
| Owe | `$2,470.00 of $3,300` · `$830.00 left` | `Rent` `$2,150.00 of $2,150` · `Paid`; `Car loan` `$320.00 of $320` · `Paid`; `Student loan` `$0.00 of $385` · `Due Nov 20`; `Insurance` `$0.00 of $195` · `Due Nov 22 and 24` | | `$250.00` |
| Need | `$1,406.89 of $2,400` · `$993.11 left` | `Groceries` `$709.46 of $900` · `Above pace · $10.59 a day left`; `Transport` `$250.20 of $300` · `Above pace · $2.77 a day left`; `Phone & internet` `$179.99 of $180` · `Paid`; `Utilities` `$58.75 of $220` · `On pace`; `Health` `$82.35 of $150` · `On pace` | `Household` `$64.90`; `Pets` `$61.24` | `$650.00` |
| Want | `$935.25 of $1,700` · `$764.75 left` | `Dining out` `$313.69 of $450` · `Above pace · $7.57 a day left`; `Entertainment` `$212.09 of $250` · `Above pace · $2.11 a day left`; `Subscriptions` `$40.47 of $80` · `On pace` | `Shopping` `$131.15`; `Fitness` `$121.00`; `Gifts` `$116.85` | `$920.00` |

7. Leyenda E20: `Today, 40% of the way through the month`.
8. Tarjeta `Income` de tres filas N7: `Expected this month` → `$9,275.00`; `In the plan` →
   `$7,400.00`; `Not planned` → `$1,875.00`.
9. Aviso N14 con `info`: `First month on a plan. You averaged $8,505.88 a month from June to October.`

**Estado de una categoría** (texto de 12 px bajo su barra):

| Condición | Texto | Estilo |
| --- | --- | --- |
| Gastado mayor que el límite | `Over by $12.40` | `text-destructive` + `circle-alert size-3`; relleno `bg-destructive` |
| Su recurrente del mes ya se pagó y lleva 99.5% o más | `Paid` | gris + `check size-3` |
| Tiene recurrente pendiente y nada gastado | `Due Nov 20` | gris |
| Porcentaje gastado mayor que el ritmo más 15 puntos (hoy: más de 55%) | `Above pace · $10.59 a day left` | `text-warning` + `trending-up size-3` |
| Lo demás | `On pace` | gris |

La misma regla aplica a la bolsa: si se pasa, su barra va en `bg-destructive` y la línea dice `Over by $…`.
Tocar una categoría abre Transactions filtrado por ella y el mes.

**Hoja Edit plan** (`?sheet=edit-plan`), título `November plan`:

- `Expected income` (N8): `$9,275.00`. Nota: `From your recurring income. Change it if this month is different.`
- Tres campos N8 con cuadrito y, a la derecha del rótulo, su porcentaje del ingreso: `Owe`
  `$3,300` · `35.6%`; `Need` `$2,400` · `25.9%`; `Want` `$1,700` · `18.3%`.
- Línea de total: `Not planned` → `$1,875.00 · 20.2%`. Si el plan supera el ingreso: `$250.00 over
  your expected income` en `text-warning` (no bloquea).
- E14 `Save plan`. E16 `Copy October's plan` (solo si existe).
- Error de validación: `Limits in Need add up to $2,500, more than the $2,400 in the bucket. Raise
  Need or lower a limit.`

**Hoja Category limit** (`?sheet=limit`), título `Groceries`: N5 `No limit` · `Monthly limit`;
campo `$900`; nota `Spent so far this month: $709.46`; E14 `Save limit`.

**Estados**

- Sin plan en el mes: E3 en gris `$0.00`. N13 con `target`: título `No plan for November yet`,
  cuerpo `Split what you expect to earn into three buckets: what you owe, what you need and what
  you want.`, E14 `Create plan`, E16 `Copy October's plan`. `Create plan` abre la hoja con valores
  sugeridos y el aviso `Suggested from your last 3 months.`
- Miembro sin permiso: no ve `Edit plan` ni `Add a limit`.
- Mes pasado: sin `a day`; el héroe es `Left over` o `Over plan` con la cifra final.
- Carga y error: 4.1.

**Desktop**: fila superior con héroe + barra total a la izquierda (1–7) y la tarjeta `Income` a la
derecha (8–12). Debajo, las tres bolsas en tres columnas. `Edit plan` es un diálogo.

### 5.7 Analytics

**Objetivo**: cuatro respuestas, una por gráfica. Cada tarjeta abre con la conclusión escrita en
una frase y debajo la gráfica que la prueba. **Decisión**: son cuatro y no más; lo demás se le
pregunta al asistente.

**Bloques (mobile)**

1. N1: `Analytics`.
2. Periodo N5: `Month` · `3 months` · `6 months` · `Year` (default `6 months`). Alcance N5 debajo.
3. Cuatro tarjetas E8 `p-4`. Estructura fija: pregunta (13 px gris), conclusión (17 px semibold,
   `leading-[23px]`), gráfica, y E16 `View as table`.

| # | Pregunta | Conclusión | Gráfica |
| --- | --- | --- | --- |
| 1 | `Are we keeping more than we spend?` | `You kept $1,312.86 so far in November, 21% of what came in.` | Barras pareadas por mes, Jun a Nov: entra (`var(--positive)`) y sale (`var(--muted-foreground)` al 55%). Bajo cada par, el neto en 12 px (`+$344`, `+$1,319`, `+$410`, `+$1,307`, `+$467`, `+$1,313`). Noviembre con trama de puntos y la nota `so far` |
| 2 | `Where does it go?` | `Owe 51%, Need 29%, Want 20% of November.` | Una barra horizontal al 100% de `h-3` en tres segmentos con los colores de naturaleza y su leyenda (`Owe $2,470.00` …). Debajo, seis columnas apiladas Jun a Nov con los mismos colores |
| 3 | `What changed since last month?` | `$156.84 more than at this point in October. Groceries and Entertainment explain it.` | N5 `Categories` · `Merchants`. Lista de seis filas: nombre, monto, barra horizontal `h-1.5 bg-foreground/70` proporcional al mayor, y cambio a la derecha (`+$111.26`, `+$45.29`, `+$6.10`, `+$116.09`, `$0.00`, `−$72.60`) con `trending-up` o `trending-down` en gris. Nota: `Compared with Oct 1 to 12.` |
| 4 | `Is the total growing?` | `Up $5,158.47 since June 1.` | Línea E5 a `h-[140px]` con el balance al inicio de cada mes y hoy; etiquetas `Jun` … `Nov` |

**Reglas de gráfica**: SVG propio, sin librería. Barras con esquinas superiores de 4 px, ancho 14
px y separación 4 px dentro del par. Sin cuadrícula; solo la línea base en `var(--border)`. Ejes
en 12 px gris. Sin eje Y: los valores se leen en la etiqueta que aparece al tocar una barra
(`Aug · In $9,275.00 · Out $8,865.35`). El cambio en la tabla 3 no usa rojo ni verde: gastar más
no es un error. Cada `svg` lleva `role="img"` y un `aria-label` igual a la conclusión.

`View as table` reemplaza la gráfica por una tabla N23 con las mismas cifras (`mock-data.md`
sección 8) y el botón pasa a `View as chart`.

**Estados**: con menos de un mes de datos, N13 con `chart-column`: título `Not enough history
yet`, cuerpo `Charts appear after your first full week of transactions.` Una tarjeta sin datos en
el periodo muestra `Nothing in this period.` en su lugar. Carga: cuatro tarjetas con dos líneas y
un bloque `.sk h-[140px]`. Error: 4.1.

**Desktop**: rejilla 2 × 2 (`grid-cols-2 gap-6`). Periodo y alcance en la cabecera, a la derecha
del `h1`. Las gráficas crecen a `h-[220px]` y muestran la etiqueta al pasar el cursor.

### 5.8 Recurring

**Objetivo**: ver qué se repite, qué viene y decidir qué se registra solo (Auto) y qué pide
confirmación (Manual).

**Bloques (mobile)**

1. N1: `Recurring`, acción E2 `plus` (`aria-label="Add recurring"`).
2. E3 con rótulo `Recurring payments`: `$3,526.95`. Debajo, 14 px gris: `a month in 14 payments ·
   $689.49 still to pay in November`.
3. N5: `Upcoming` · `All`.

**Vista Upcoming**

- Si hay algo que confirmar hoy o atrasado, primero una tarjeta `Needs you` (E8 con borde
  `border-warning/40`): título `Con Edison is due today`, nota `Usually about $94.00`, E15
  `Confirm amount`. Con los datos del mock (hoy 12 nov) **no aparece**.
- `Next 7 days` (N3 con total `$1,622.29`) + tarjeta E11 con las cuatro filas de Home.
- `Later in November` (N3 con `$1,598.90`) + tarjeta E11: `Fri 20` `Student loan · Nelnet` `$385.00`
  (`From` `lock` `Maya's Checking` · `Auto`); `Fri 20` `Emergency Fund top-up` `$750.00` (`From
  Joint Checking` · `arrow-left-right` `Transfer`); `Sun 22` `Geico` `$148.00` (`Auto`); `Tue 24`
  `Lemonade Renters` `$47.00` (`Auto`); `Sat 28` `Pay Amex Gold` `$268.90` (`From` `lock`
  `Maya's Checking` · `Due in 16 days` en gris, porque faltan más de 7 días).

**Vista All**

- Chips N4: `All` · `Subscriptions` · `Bills` · `Income` · `Transfers`.
- Grupos con N3 (nombre y total mensual): `Bills and payments` `$3,526.95` (14), `Income`
  `+$9,275.00` (2), `Transfers` `$2,550.00` (2).
- Fila (N2 con ficha de ícono de categoría): nombre; meta `Monthly on the 5th · Sapphire Reserve`;
  derecha el monto (`~` si es estimado) y debajo la marca `Auto`, `Manual` o `Expected` (12 px
  gris con su ícono).
- Con el chip `Subscriptions`: N3 `4 subscriptions` / `$55.96 a month`; filas `Netflix` `$15.49`,
  `Spotify Duo` `$18.99`, `Max` `$18.49`, `iCloud+` `$2.99`. Las tres que subieron llevan una
  tercera línea de 12 px gris con `trending-up`: `Up $2.50 since Jan`, `Up $2.00 since Nov`, `Up
  $3.00 since Jun`.

**Hoja detail** (`?sheet=detail`, ejemplo Spotify Duo):

1. Ficha + `Spotify Duo` + cifra héroe de hoja `$18.99` + `Monthly on the 5th · next Dec 5`.
2. Tarjeta `How it gets added` con N5 `Auto` · `Manual` y, debajo, el texto del modo activo:
   - Auto: `Firecent adds it on the day with this amount. You don't have to do anything.`
   - Manual: `Firecent asks you on the day. You confirm or change the amount.`
3. Tarjeta de filas N7: `Account` → `Sapphire Reserve`; `Category` → `Subscriptions · Want`;
   `Amount varies` → interruptor N24 (apagado); `Ends` → `Never`.
4. `History` (E7) + filas: `Nov 5` `$18.99`, `Oct 5` `$16.99`, `Sep 5` `$16.99`. Nota 12 px gris:
   `Went up $2.00 in November.`
5. Acciones (filas N15): `Skip Dec 5`, `Pause`, y `Delete` en `text-destructive`.

**Diálogo Auto** (`?sheet=auto`), al pasar de Manual a Auto: título `Add it automatically?` Cuerpo
`From Dec 5, Firecent will add $18.99 to Sapphire Reserve every month without asking. This only
records it. It does not move money at your bank.` Botones E14 `Turn on Auto`, E16 `Keep Manual`.
`Amount varies` activo impide Auto; el control lo explica: `Auto needs a fixed amount.`

**Hoja confirm** (`?sheet=confirm`, Con Edison): título `Con Edison · Nov 18`; cifra héroe de hoja
editable `$94.00`; nota `Last three: $92.47 · $101.40 · $88.12`; teclado N9; E14 `Confirm
$94.00`; E16 `Skip this month`. Para un ingreso: título `Daniel's paycheck · Nov 16`, pregunta
`Did it arrive?`, E14 `Yes, add +$3,150.00`, E16 `Not yet`.

**Add recurring**: hoja con `Name`, N5 `Expense` · `Income` · `Transfer`, `Amount` + interruptor
`Amount varies`, `Account`, `Category`, `Repeats` (N5 `Weekly` · `Monthly` · `Yearly` + día),
`How it gets added` (N5 `Auto` · `Manual`, default `Manual`), `Starts`, `Ends` (opcional). E14 `Add recurring`.

**Estados**: vacío → E3 `$0.00` gris + N13 con `repeat`: título `Nothing repeats yet`, cuerpo `Add
rent, subscriptions and paychecks once. Firecent shows what is coming and what is left after
it.`, E14 `Add recurring`. Si el asistente detectó candidatos, debajo va una E13: `Chewy looks
like a monthly payment` + E15 `Add as recurring`. Carga y error: 4.1.

**Desktop**: héroe arriba; dos columnas: `Upcoming` a la izquierda (1–5) como línea de tiempo y
`All` a la derecha (6–12) como tabla N23 (`Name`, `Amount`, `When`, `Account`, `Mode`, `Next`).
El detalle abre en panel derecho.

### 5.9 Debts

**Objetivo**: cuánto se debe, cuánto le deben a uno y cómo va cada pago.

**Bloques (mobile)**

1. N1: `Debts`, acción E2 `plus` (`aria-label="Add debt"`).
2. E3 con rótulo `You owe`: `$19,885.00`. E4 en verde: `arrow-down-left` `$421.30` + `owed to you` (gris).
3. Aviso N14 con `info`: `Debts are tracked apart. They are not part of your Balance.`
4. N5: `You owe (3)` · `Owed to you (2)`.
5. Una tarjeta E8 por deuda, `p-4`: nombre (`font-semibold`) + a la derecha lo que falta (`num
   font-semibold`); nota de 13 px gris; barra N17; pie de 12 px gris a dos lados.

| Pestaña | Nombre | Falta | Nota | Barra | Pie izquierdo / derecho |
| --- | --- | --- | --- | --- | --- |
| You owe | `Toyota Financial` | `$11,200.00` | `Car loan` | 39.1% | `$320.00 a month · 35 left` / `Ends Oct 2029` |
| You owe | `lock` `Nelnet` | `$8,085.00` | `Student loan` | 66.3% | `$385.00 a month · 21 left` / `Ends Jul 2028` |
| You owe | `lock` `Elena Torres` | `$600.00` | `Moving costs` | 60.0% | `$900.00 of $1,500 paid` / `By Feb 28, 2027` |
| Owed to you | `Leo Reyes` | `$350.00` | `Lent for car repair` | 41.7% | `$250.00 of $600 received` / `By Dec 15` |
| Owed to you | `Sofía Torres` | `$71.30` | `Her concert ticket` | 0% | `Nothing received yet` / `By Nov 30` |

6. Sección plegada `Settled (0)`; no se dibuja si está en cero.

**Hoja detail** (`?sheet=detail`, Leo Reyes): cifra héroe de hoja `$350.00` con rótulo `Leo still
owes you`; barra N17; tarjeta N7: `Lent` → `$600.00 · Aug 15`; `Pay back by` → `Dec 15, 2026`;
`From` → `Joint Checking`; `Visible to` → `Maya & Daniel`. `Payments` (E7): `Oct 20` `+$150.00`,
`Sep 12` `+$100.00`. E15 `Record a payment`; E16 `Mark as settled`; `Delete` en `text-destructive`.

`Record a payment`: hoja con monto (teclado N9), `Into` o `From` (cuenta) y `Date`. E14 `Record
$100.00`.

**Hoja Add debt** (`?sheet=add-debt`): N5 `I owe` · `Owed to me`; `Who` (N8, placeholder `Person
or lender`); `Amount`; `Date`; `Pay back by` (opcional); `Note`; interruptor `Also record it in an
account` → `Account`; `Who can see it` (N5). E14 `Add debt`.

**Decisiones**

- Las deudas no entran en el Balance de Home ni de Accounts: no son cuentas y no tienen moneda
  propia. Se resumen aquí y en la fila final de Accounts.
- Pagar una deuda propia es un gasto en Owe (cuenta en el plan). Prestar y cobrar son movimientos
  marcados para **no** contar en Money in ni Money out (`Record.excludeFromStats`, ver
  `schema-gaps.md`).
- Una deuda con vencimiento en 7 días o menos muestra su fecha en `text-warning`.

**Estados**: vacío → E3 `$0.00` gris + N13 con `hand-coins`: título `No debts`, cuerpo `Track
what you owe and what people owe you. Each payment you record brings the amount down.`, E14 `Add
debt`. Pestaña sin deudas: `Nobody owes you anything right now.` / `You don't owe anything right
now.` Carga y error: 4.1.

**Desktop**: héroe arriba; las dos listas lado a lado (`grid-cols-2`) en lugar del control
segmentado; el detalle en panel derecho.

### 5.10 Assistant

**Objetivo**: preguntar con palabras y recibir respuestas con cifras del Space. El asistente
analiza y propone. **Nunca guarda, cambia ni borra nada sin una aprobación explícita**, y no puede
mover dinero.

**Vista nueva** (`?view=new`, raíz del tab)

1. Cabecera `px-5 pt-3 flex items-center justify-between`: `h1` `Assistant`; acciones E2 `history`
   (`aria-label="Past chats"`) y E2 `plus` (`aria-label="New chat"`).
2. Centro, `pt-8 text-center`: flama `firecent h-12`; `Ask about your money` (20 px semibold);
   `I read your transactions, plan and recurring payments. I can suggest changes, and nothing is
   saved until you approve it.` (14 px gris, `max-w-[300px]` centrado).
3. Sugerencias: tarjeta E8 con cuatro filas N15 sin ficha: `How are we doing this month?` ·
   `What changed since October?` · `Find subscriptions I could cut` · `Import a statement`
   (esta con `upload`).
4. `Noticed for you` (E7) + tarjetas E13 de los insights `in2` y `in3` (títulos y cuerpos en
   `mock-data.md` sección 9), cada una con su botón E15 y `Ask about it` (E16).
5. Compositor N21 sobre el tab bar (`bottom-[84px]` en esta vista). Placeholder `Ask anything
   about your money`.

**Vista hilo** (`?view=thread`, sin tab bar)

1. N1: título `Subscriptions that went up`; acción E2 `ellipsis` → `Rename`, `Delete chat`.
   Bajo el título, 12 px gris centrado: `lock` `Only you can see this chat`.
2. Mensajes, `space-y-5 px-5 pb-40`: los cuatro de `mock-data.md` sección 9, con N18 y N19. La
   tabla de precios va dentro del mensaje. El chip de fuente `Based on 31 transactions · Jan 1 to
   Nov 12` abre Transactions con ese filtro. Chips de sugerencia N4 bajo la respuesta.
3. Propuesta N20 al final (Chewy), con sus seis filas y `Nothing changes until you approve.`
4. Compositor N21 pegado abajo. Debajo, 11 px gris centrado: `The assistant can be wrong. Check
   the figures before you act.`

**Estados de una propuesta (N20)**

| Estado | Qué se ve |
| --- | --- |
| Pending | `Approve` · `Edit` · `Dismiss` + `Nothing changes until you approve.` |
| Applying | `Approve` con giro (`rotate-cw` animado) y texto `Saving…`; los otros deshabilitados |
| Approved | Sin botones. Línea `circle-check` en `text-positive`: `Approved by you · Nov 12, 3:41 PM` y E16 `Undo` |
| Dismissed | La tarjeta se reduce a una línea gris: `Dismissed` |
| Failed | N14 aviso dentro de la tarjeta: `Couldn't apply this. Nothing was changed.` + E15 `Try again` |
| Out of date | `This suggestion is out of date.` + E16 `Ask again` (los datos cambiaron desde que se propuso) |

`Edit` abre el formulario normal de ese objeto (por ejemplo Add recurring) con los valores
propuestos; guardar ahí cuenta como aprobar.

**Propuesta de varios movimientos** (importar un estado de cuenta): título `Add 9 transactions to
Amex Gold`; lista con casilla por fila (todas marcadas), cada fila N2 con su categoría editable;
pie E12 `Total` → `$268.90`; botones `Approve 9` · `Dismiss`. Desmarcar cambia el número del botón.

**Respuestas fijas**

- Si se le pide pagar o transferir: `I can't move money. Firecent doesn't connect to your bank.
  Once you've made the payment, I can record it for you.` + propuesta `Record a payment`.
- Si la pregunta toca datos que no puede ver: `I can only use what you can see in this space.`
- Sin datos suficientes: `I don't have enough history to answer that yet.`

**Otros estados**

- Pensando: flama con pulso de opacidad (1.2 s) + texto gris `Looking at your transactions…`. Con
  movimiento reducido, solo el texto.
- Mensaje no enviado: N18 con `circle-alert` y `Not sent. Tap to try again.`
- Servicio caído: N13 con `cloud-off`: título `The assistant is unavailable`, cuerpo `Your data is
  fine. Try again in a few minutes.`, E15 `Try again`.
- Adjuntar: `paperclip` abre el selector (PDF, CSV, foto). El archivo aparece como chip sobre el
  campo: `file-text` `amex-gold-nov.pdf` `×`.
- Space vacío: las sugerencias cambian a `Import a statement` · `What can you do?` y no hay
  `Noticed for you`.

**Hoja Threads** (`?sheet=threads`), título `Past chats`: filas N15 sin ficha con título y fecha:
`Subscriptions that went up` · `Today`; `November so far` · `Nov 9`; `Amex statement import` · `Nov 4`.

**Desktop**: página con dos columnas: lista de chats a la izquierda (280 px, con `New chat` arriba)
y el hilo a la derecha con ancho máximo de 720 px y el compositor al pie de esa columna. El panel
`Ask` (400 px, a la derecha, sobre cualquier pantalla) es el mismo hilo con un chip de contexto
arriba del compositor: `About: Budget · November` `×`.

### 5.11 Selector de Space y miembros

**Objetivo**: cambiar de Space en dos toques y dejar claro quién ve qué.

**Hoja Spaces** (`?sheet=space`, se abre desde E1), título `Spaces`:

1. Tarjeta E8 con una fila por Space, `flex min-h-16 items-center gap-3 px-4`: avatares apilados
   (hasta 3, luego `+1`), nombre (`font-medium`), meta 13 px gris, y `check size-5
   text-primary-text` en el activo (`aria-current="true"`).

| Space | Meta |
| --- | --- |
| `Maya & Daniel` (activo) | `Shared with Daniel` |
| `Personal` | `Only you` |
| `Torres family` | `4 people` |

2. Fila N15 `New space` (`plus`).
3. Fila N15 `Manage Maya & Daniel` (`settings`) → Members.

Al elegir otro Space: la hoja se cierra, todas las cifras pasan a esqueleto y se recargan. El
Space activo se recuerda entre sesiones. No se muestran saldos en esta lista.

**Hoja New space**: `Name` (N8, placeholder `e.g. Maya & Daniel`); `Who is it for` (N5 `Just me` ·
`Shared`); `Main currency` (N7 → `US dollar (USD)`), nota `Totals are shown in this currency.
Each account keeps its own.`; E14 `Create space`. Si es `Shared`, sigue `Invite people`: campo
`Email`, E14 `Send invite`, E16 `Not now`.

**Pantalla Members** (More → Members):

1. N1: `Maya & Daniel`, acción E16 `Invite`.
2. Tarjeta de miembros: avatar de 40 px, nombre, correo, y rol a la derecha (`Owner`, `Admin`,
   `Member`). `Maya Torres` · `Owner` · `You`; `Daniel Reyes` · `Member`.
3. Invitaciones pendientes (si hay): correo, `Invited · expires in 6 days`, acciones `Resend` ·
   `Cancel`.
4. Tarjeta `What Daniel can see`, dos listas con `eye` y `eye-off`:
   - `Shared with the space`: `Accounts marked Shared and their transactions` · `The plan and its
     limits` · `Recurring payments and debts on shared accounts`
   - `Only yours`: `Accounts marked Only you and everything in them` · `Your chats with the assistant`
5. Tarjeta N7: `Space name`, `Main currency` → `USD`.
6. `Leave space` en `text-destructive`. Diálogo: `Leave Maya & Daniel?` · `You lose access to its
   shared accounts. Accounts you own and marked Only you are archived for you.` · `Leave` / `Cancel`.
   El único owner no puede salir: `Make someone else the owner first.`

Errores de invitación: `Enter a valid email address.` · `Daniel is already in this space.`

**Desktop**: popover de 288 px anclado al selector del sidebar, con la misma lista. Members es
una sección dentro de Settings.

### 5.12 Onboarding

**Objetivo**: llegar a Home con un Space y una cuenta en menos de un minuto. Empieza después de
iniciar sesión, cuando `isOnboarded` es falso. El inicio de sesión ya existe y no se diseña aquí.

Marco común: sin tab bar. Arriba `px-5 pt-3`: E2 `chevron-left` (no en el paso 1) y N25. Contenido
`px-5 pt-8`: título (28 px semibold, `leading-[34px]`), apoyo (15 px gris, `mt-2`), campos
(`mt-8`). Botón E14 a todo lo ancho `h-13`, fijo abajo (`pb-8`).

| Paso | Título | Apoyo | Campos | Botones |
| --- | --- | --- | --- | --- |
| 1 | `First, your name` | `This is how you appear to people you share with.` | `First name` (N8, foco inicial) | `Continue` |
| 2 | `Who is this for?` | `You can add more spaces later.` | Dos celdas grandes (`rounded-2xl border bg-card p-4`, seleccionada `border-primary ring-1 ring-primary`): `Just me` · `A private space for your own money.` (ícono `lock`) y `Me and someone else` · `A shared space for a partner, family or roommates. Any account can still be private.` (ícono `users`). Si elige la segunda: `Space name` (N8, placeholder `e.g. Maya & Daniel`). Fila N7 `Main currency` → `US dollar (USD)` | `Continue` |
| 3 | `Add your first account` | `Start with the one you use most. No bank login needed.` | Los campos de la hoja Add account (5.4) | `Add account` · E16 `I'll do this later` |
| 4 (solo Space compartido) | `Invite someone` | `They see shared accounts only. Yours stay private until you share them.` | `Email` (N8) | `Send invite` · E16 `Not now` |

Al terminar: Home. Con una cuenta, Home muestra datos y el toast `You're set. Add a transaction
with +.` Sin cuenta, Home está en su estado vacío con la lista `Three steps to a full picture`
(ya construida), que continúa el onboarding: los pasos hechos cambian su número por `check` en
`bg-positive/12 text-positive` y su texto pasa a gris.

**Estados**: validación en línea al salir del campo (`Enter your first name.` · `Enter a valid
email address.` · `That name is taken in this space.`). Botón con giro y `Saving…` mientras
guarda. Error al guardar: 4.1. Si se cierra la app a medias, se retoma en el mismo paso.

**Desktop**: columna centrada de 480 px dentro de una tarjeta `rounded-3xl border bg-card p-10`
sobre `bg-background`; `assets/brand/logo.svg` (o `logo_d.svg` en oscuro) arriba a la izquierda de
la página, `h-7`. Sin sidebar.

### 5.13 More (solo mobile) y Notifications

**More**: `h1` `More`. Tarjeta de perfil (fila N15 con avatar de 40 px): `Maya Torres` ·
`maya@example.com`. Luego tres grupos, cada uno con rótulo de 13 px gris y tarjeta E8 de filas N15:

| Grupo | Fila (ícono) | Vista previa |
| --- | --- | --- |
| `Money` | `Accounts` (`wallet`) | `$36,398.47` |
| | `Budget` (`target`) | `$2,587.86 left` |
| | `Analytics` (`chart-column`) | |
| | `Recurring` (`repeat`) | `4 this week` |
| | `Debts` (`hand-coins`) | `$19,885.00` |
| `Maya & Daniel` | `Members` (`users`) | `2` |
| | `Categories` (`tag`) | |
| | `Labels` (`tags`) | |
| | `Import a statement` (`upload`) | |
| `App` | `Appearance` (`sun`) | `System` |
| | `Notifications` (`bell`) | |
| | `Security` (`shield-check`) | |
| | `Help` (`circle-help`) | |

Al final, `Sign out` (E16 en `text-muted-foreground`, con `log-out`). `Appearance` abre una hoja
con N5 `System` · `Light` · `Dark`.

**Notifications** (desde la campana): N1 `Notifications` + E16 `Mark all read`. Filas de `min-h-16`
con ficha de ícono, texto y hora; las no leídas llevan un punto `size-2 rounded-full
bg-nature-want` a la izquierda y texto en `font-medium`. Contenido en `mock-data.md` sección 1.
Vacío: N13 con `bell`: `You're all caught up`.

## 6. Qué se toma de cada referente

| Referente | Se toma | Por qué | No se toma |
| --- | --- | --- | --- |
| Copilot Money | El pulido de la revisión diaria: una cifra grande, filas limpias, tipografía numérica cuidada. Los recurrentes como parte de la lectura del mes | Es el listón visual del segmento; su fuerza es que abrir la app se siente bien cada día | Depender del ecosistema Apple y de la conexión bancaria |
| Monarch | El hogar compartido como caso central y la detección de cargos que se repiten | Es el competidor directo en parejas y familias | Sus tableros configurables con muchos widgets: Firecent fija cuatro bloques en Home y cuatro gráficas |
| YNAB | Alta de transacción a un toque desde cualquier pantalla; avisos accionables arriba (lo que hay que confirmar o cubrir); el plan como decisión explícita del mes | El hábito de registrar se sostiene solo si capturar cuesta segundos | La obligación de asignar cada dólar y su vocabulario: tres bolsas se entienden en diez segundos |
| Revolut | Entra y sale del periodo comparados con el periodo anterior; el desglose del crédito en una tarjeta | Comparar contra "el mismo punto del mes pasado" es la lectura más útil de una gráfica | La mezcla de bolsas con saldos en varias monedas, que sus usuarios describen como confusa: en Firecent cada cuenta conserva su moneda y todo total va en la moneda principal con `≈` |

Lo que ninguno hace y es la diferencia de Firecent: privado o compartido **por cuenta** dentro del
mismo Space, Owe / Need / Want como eje único de plan y analíticas, planes a meses de tarjeta, y un
asistente cuyo único modo de escribir es una propuesta que el usuario aprueba.

## 7. Decisiones tomadas en este documento

| # | Decisión | Sección |
| --- | --- | --- |
| D1 | Las piezas comunes (tab bar, sidebar, alta rápida, selector de Space, toast) viven en `assets/proto.js` | 0 |
| D2 | Entre 768 y 1023 px se usa el layout mobile centrado | 2.2 |
| D3 | Fichas de categoría y de cuenta neutras; el color del enum `Colors` solo en avatares y labels | 3.1 |
| D4 | Borrar no pide confirmación: toast con `Undo` | 4.1 |
| D5 | El alcance Everything / Shared / Only you se conserva entre pantallas | 4.3 |
| D6 | Home en desktop agrega el bloque `Recent` | 5.1 |
| D7 | La categoría es obligatoria al capturar un gasto; el monto se teclea natural | 5.3 |
| D8 | La compra a meses cuenta completa en su fecha; el plan solo reparte la facturación | 5.5 |
| D9 | En el detalle de una tarjeta lo que se debe va sin signo bajo el rótulo `You owe`; en listas y totales va con `−` | 5.5 |
| D10 | El plan se llama `Budget` en la navegación y `the plan` en el texto | 5.6 |
| D11 | El marcador de ritmo se dibuja en las tres bolsas (como en Home) pero no en la barra total | 5.6 |
| D12 | `Above pace` = más de 15 puntos sobre el ritmo del mes | 5.6 |
| D13 | Analytics tiene cuatro gráficas y los cambios no usan rojo ni verde | 5.7 |
| D14 | Un ingreso recurrente se etiqueta `Expected` y se confirma al llegar; los pagos de tarjeta salen del estado de cuenta, no de una plantilla | 5.8 |
| D15 | Las deudas no entran en el Balance | 5.9 |
| D16 | Los chats son privados de cada persona; el asistente lee solo lo que esa persona ve | 5.10 |
| D17 | El selector de Space no muestra saldos | 5.11 |
| D18 | Onboarding de tres pasos (cuatro si el Space es compartido); lo demás continúa en el vacío de Home | 5.12 |

## 8. Lista de aceptación

Para cada pantalla construida:

- [ ] Usa solo utilidades y tokens de la sección 3. Ningún color en hexadecimal fuera del velo de hoja.
- [ ] Reutiliza los componentes E1–E20 con las mismas clases que `home.html`.
- [ ] Tiene los cuatro estados (`data`, `empty`, `loading`, `error`) y se ven desde el visor.
- [ ] Se ve bien en claro y en oscuro (`?theme=dark`).
- [ ] Todo objetivo táctil mide 44 px o más en mobile.
- [ ] Todo monto lleva `.num`, el formato de 4.2 y coincide con `mock-data.md`.
- [ ] Hay un solo relleno violeta de acción visible a la vez.
- [ ] Lo privado lleva candado; nada de Daniel que Maya no deba ver aparece.
- [ ] Barras con `role="progressbar"`, gráficas con `role="img"` y `View as table`, botones de
      ícono con `aria-label`.
- [ ] Layout desktop a 1440 px con sidebar, y mobile a 390 px con tab bar.
- [ ] `bun fable/build.mjs` no reporta íconos `MISSING`.
- [ ] La pantalla está registrada en `SCREENS` de `index.html`, con sus hojas.

Orden de construcción sugerido: `proto.js` (piezas comunes y alta rápida) → Transactions →
Accounts y Account detail → Budget → Recurring → Debts → Analytics → Assistant → Spaces y
Onboarding → More → Home desktop.
