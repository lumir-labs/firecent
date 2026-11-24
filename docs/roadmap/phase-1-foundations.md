# Fase 1 · Fundaciones de diseño

> Estado: ⏳ lista para ejecutar · Depende de: nada · Lee antes: [README](README.md)

## Objetivo

Que cualquier pantalla nueva se vea Firecent sin esfuerzo. Al terminar existen: los tokens de marca
en `tokens.css`, las primitivas de shadcn con las variantes de Firecent, una librería de componentes
de dominio en `apps/web/components/finance/`, el app shell nuevo (sidebar desktop y tab bar mobile)
y un seed con los datos de Maya y Daniel para comparar contra el prototipo.

**Fuera de alcance:** rediseñar pantallas (eso empieza en la Fase 2), la app nativa y los
componentes de chat, onboarding y presupuestos (llegan en sus fases).

## Referencias

- `docs/prototype/SPEC.md` §1 (principios), §2 (navegación), §3 (sistema de diseño), §4 (patrones).
- `docs/prototype/home.html`: fuente de las clases exactas de E1–E20.
- `docs/prototype/src/tokens.proposed.css`: tokens a incorporar.
- `docs/prototype/mock-data.md` §1–§3, §5, §8 para el seed.

## Tareas y dependencias

```
1A Tokens y tipografía ──► 1B Primitivas shadcn ──► 1C Componentes finance ──► 1D App shell
1E Seed demo  (independiente: puede correr en paralelo con 1A, 1B o 1C)
```

| ID | Tarea | Depende de | Modelo | Estado |
| --- | --- | --- | --- | --- |
| 1A | Tokens y tipografía | — | **Sonnet** | ✅ |
| 1B | Variantes de Firecent en primitivas shadcn | 1A | **Sonnet** | ✅ |
| 1C | Componentes de dominio (`components/finance/`) | 1B | **Opus** | ✅ |
| 1D | App shell: sidebar, tab bar, cabeceras, rutas | 1C | **Opus** | ⏳ |
| 1E | Seed de demo (Maya y Daniel) | — | **Sonnet** | ✅ |

---

## 1A · Tokens y tipografía

**Archivos:** `packages/lib/src/tokens/tokens.css`, `packages/lib/src/tokens/shadcn.theme.css`,
`packages/lib/src/globals.css`, `apps/web/app/[locale]/layout.tsx`.

0. **Primero compara, no sobrescribas a ciegas.** La marca ya existe en
   `C:\Users\Luis\Documents\02_PROFESIONAL\LUMIR\firecent\Marca` (`brand-kit.png`/`.svg`,
   `index.html` con la paleta, `fonts/` con Inter, logos claro/oscuro/mono, `app-icons/`) y parte ya
   está aplicada en `tokens.css` (por ejemplo `--primary: #5e54f0`, `--chart-*`). Haz una tabla
   token → valor actual → valor de Marca → valor de `tokens.proposed.css` y aplica solo lo que falta o
   difiere. Si Marca y `tokens.proposed.css` se contradicen, **gana Marca**, salvo que el valor de
   Marca no cumpla contraste AA (en ese caso usa el propuesto y anótalo). Revisa también si los logos
   de `apps/web/public/` son los de Firecent (`docs/COMPONENTS.md` todavía habla de "StackGoat"); si
   no lo son, repórtalo, pero no los cambies en esta tarea.
1. Copia a `tokens.css` los valores que falten de de `docs/prototype/src/tokens.proposed.css`, dentro de
   los mismos bloques `@variant light` y `@variant dark`. Overrides: `--background`, `--muted`,
   `--muted-foreground`, `--primary`, `--destructive`. Nuevos: `--positive`, `--warning`,
   `--primary-text`, `--nature-owe/need/want`, `--assistant`, `--assistant-border`,
   `--assistant-accent`, `--hero*`. **Cada variable nueva va en light y en dark** (lo exige Uniwind).
2. Cambia `--radius` a `0.75rem` en el `:root` de `tokens.css`. En `shadcn.theme.css`, `--radius-lg`
   ya apunta a `var(--radius)`; revisa que `--radius-xl` (0.75rem) y `2xl` (1rem) y `3xl` (1.5rem)
   queden como pide SPEC §3.3. Valores estáticos en rem (ver la nota del archivo sobre mobile).
3. Agrega a `shadcn.theme.css`, en su `@theme inline`, el mapeo de utilidades del bloque
   `@theme inline` de `tokens.proposed.css` (`--color-positive: var(--positive)`, etc.).
4. Tipografía: Inter ya se carga con `next/font` como `--font-sans`. Cámbiala a la variable
   (`Inter({ subsets: ["latin"], variable: "--font-sans", axes: ["opsz"] })`, sin lista de pesos) y
   revisa que el `<body>` use `font-sans` (hoy tiene `font-geist-sans`, que no existe). Merriweather y
   Fira Code no se usan en Firecent: déjalos si algo del boilerplate los usa; si no, quítalos.
5. En `globals.css` agrega:
   - `@utility num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }`
   - En `@layer base`: `html { font-optical-sizing: auto; }`, `body { font-size: 15px; line-height: 1.45; }`.
   - Foco: `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }`.
   - `@media (prefers-reduced-motion: reduce)` que anule transiciones y animaciones.
6. Revisa que **las pantallas de admin no se rompan** con el radio y el fondo nuevos
   (`/en/admin/users` en claro y oscuro). Si algo se ve mal, corrígelo en esa pantalla, no en el token.

**Aceptación:** `node scripts/check-tokens.mjs` en verde; `bun run typecheck --filter=@app/mobile`
en verde; en `/en/kit` los botones tienen radio de 12 px y el fondo es `#f4f6fa` en claro.

---

## 1B · Variantes de Firecent en primitivas shadcn

Las primitivas usan Base UI (`@base-ui/react`) y `cva`. **Agrega variantes; no cambies los
defaults**, porque admin y perfil las usan.

| Primitiva (`components/ui/`) | Cambio | Spec |
| --- | --- | --- |
| `button.tsx` | `size: "touch"` → `h-11 gap-2 rounded-xl px-4 text-[14px] font-semibold` y `"icon-touch"` → `size-11 rounded-full [&_svg]:size-[22px]`. `variant: "text"` → `text-primary-text font-medium hover:bg-accent` | E14, E15, E16, E2 |
| `badge.tsx` | Variantes `neutral`, `shared`, `private`, `warning`, `positive`, `error` con `h-6 rounded-full px-2 text-[12px]` | N10 |
| `card.tsx` | `variant: "plain"`: `rounded-2xl border bg-card p-0 gap-0 shadow-none` (las tarjetas de Firecent no tienen sombra ni padding propio) | E8 |
| `toggle-group.tsx` | `variant: "segmented"`: contenedor `h-11 rounded-xl bg-muted p-1`, item activo `bg-card text-foreground shadow-[0_1px_2px_rgb(11_18_32/0.12)]` | N5 |
| `toggle.tsx` | `variant: "chip"`: `h-9 rounded-full border bg-card px-3.5 text-[14px] font-medium`, presionado `border-transparent bg-foreground text-background` | N4 |
| `input.tsx` | `size: "touch"`: `h-12 rounded-xl px-3.5 text-[16px]` (16 px evita el zoom de iOS) | N8 |
| `empty.tsx` | Ajusta clases a N13 (ficha `size-14 rounded-2xl bg-muted`, título 17 px, cuerpo 14 px `max-w-[280px]`) mediante una variante, sin romper usos existentes | N13 |
| `alert.tsx` | Variantes `notice` (`bg-muted`) y `notice-warning` (`bg-warning/12`, ícono `text-warning`), `rounded-xl text-[13px]` | N14 |
| `sonner.tsx` | Toast oscuro sobre claro: `bg-foreground text-background rounded-2xl`, posición abajo; 6 s | N12 |
| `avatar.tsx` | Prop `color` (uno de los 10 del enum `Colors`) → `bg-brand-{c} text-brand-{c}-foreground`; tamaños 16, 28 y 40 px | N26 |
| `skeleton.tsx` | Sin cambio, salvo que no use el color correcto en oscuro | E18 |

Además crea `components/ui/responsive-sheet.tsx` (N6): en menos de 1024 px es un `Drawer` inferior
(asa, `rounded-t-3xl`, `max-h-[92dvh]`, velo `bg-[#0b1220]/50`); en `lg` es un `Dialog` de 480 px
(`desktop="dialog"`) o un panel derecho de 420 px (`desktop="panel"`, con `Sheet`). API:
`<ResponsiveSheet open onOpenChange title desktop="dialog|panel">`. Usa un hook
`useMediaQuery("(min-width: 1024px)")` nuevo en `apps/web/hooks/` (no cambies `use-mobile.ts`,
que usa 768 px y lo consume el sidebar actual).

**Nota de 1A:** `button.tsx` usa `rounded-md` y `rounded-[min(var(--radius-md),…)]`, no `--radius`, así que sus botones siguen en 6 px. La variante `touch` de esta tarea debe usar `rounded-xl` (12 px).

**Aceptación:** sección "Firecent · primitivas" en `/en/kit` con cada variante en claro y oscuro;
`/en/admin/users` se ve igual que antes.

---

## 1C · Componentes de dominio (`apps/web/components/finance/`)

Un archivo por componente, exportados desde `components/finance/index.ts`. Componentes de
presentación: reciben datos ya calculados, no llaman a tRPC. Textos por props o `useTranslations`.
Las clases exactas están en la columna Spec (SPEC §3.4 y §3.5).

| Componente | Props principales | Spec |
| --- | --- | --- |
| `Money` | `value` (unidades mayores, D8), `currency`, `size: "hero" \| "sheet" \| "card" \| "row-strong" \| "row" \| "inline"`, `tone: "movement" \| "upcoming" \| "plain"`, `kind?: "EXPENSE" \| "INCOME" \| "TRANSFER"`, `approx?`, `dimCents?` (hero). Usa `moneyParts` de `apps/web/lib/money.ts` | E3, §4.2 |
| `ChangeLine` | `value`, `currency`, `context` ("this month") | E4 |
| `Sparkline` | `points: number[]`, `ariaLabel`. SVG propio, `viewBox 0 0 100 72`, curva con tensión 0.3 | E5 |
| `SplitBar` | `shared`, `onlyYou`, `currency`, `hrefShared`, `hrefOnlyYou` | E6 |
| `SectionHeader` | `title`, `action?: { label, href }` | E7 |
| `StatPair` | `items: [{ icon, label, value, currency }]` (2) | E9 |
| `NatureSwatch` | `nature: "DEBO" \| "NECESITO" \| "QUIERO"` → cuadrito `size-2.5 rounded-[3px]` | §3.3 |
| `NatureBar` | `nature`, `spent`, `planned`, `currency`, `pace` (0–1) | E10 |
| `PaceLegend` | `label` | E20 |
| `UpcomingRow` | `date`, `title`, `amount`, `currency`, `kind`, `subtitle`, `mode: "auto" \| "manual" \| "expected" \| "due"`, `dueInDays?`, `href` | E11 |
| `CardTotalFooter` | `label`, `value`, `currency`, `action?` | E12 |
| `AssistantCard` | `eyebrow`, `title`, `body`, `actions`, `onDismiss` | E13 |
| `FirecentMark` | `variant: "color" \| "mono"`, `className`. SVG inline desde `docs/prototype/assets/brand/icon.svg` | íconos |
| `StepList` | `steps: [{ title, body, done, active, href }]` | E19 |
| `PageHeader` | `title`, `back?: href`, `actions?` (mobile: N1; desktop: título 24 px + acciones) | N1 |
| `TransactionRow` | `title`, `category: { icon, name }`, `account`, `amount`, `currency`, `kind`, `private?`, `addedBy?: { initial, color, name }`, `secondary?` | N2, §4.3 |
| `DayHeader` | `date`, `net`, `currency` | N3 |
| `ScopeControl` | `value: "everything" \| "shared" \| "only-you"`, `onChange`. Basado en `ToggleGroup variant="segmented"`. Se oculta si el Space tiene un solo miembro | N5, §4.3 |
| `FieldRow` | `label`, `value`, `onClick?` / `href?` | N7 |
| `NavRow` | `icon`, `label`, `preview?`, `href` | N15 |
| `AccountRow` | `name`, `type` (`AccountType`), `last4?`, `balance`, `currency`, `private?`, `secondary?` | N16 |
| `StateBlock` | `kind: "empty" \| "error" \| "no-results"`, `icon?`, `title?`, `body?`, `action?`. Copy por defecto de SPEC §4.1 para error y sin resultados | N13, §4.1 |
| `CategoryIcon` | `icon` (nombre lucide guardado en `Category.icon`), `size`. Ficha neutra `bg-muted` | §3.1 |

Notas:

- `Money` es **el único** lugar que decide signo, color y formato. Reglas de SPEC §4.2: en
  movimientos, gasto `−$41.24` en tinta, ingreso `+$2,975.00` en `text-positive`, transferencia sin
  signo en `text-muted-foreground`; en pagos por venir, gasto sin signo. Otra moneda: monto en la
  moneda de la cuenta y debajo `≈ −$56.85` (prop `converted`).
- Íconos: `lucide-react`. Mapa de íconos de navegación en SPEC §3.5 (al final).
- Agrega la sección "Firecent · componentes" en `/en/kit` con cada componente en sus estados
  (incluido skeleton) y en claro y oscuro.
- Actualiza `docs/COMPONENTS.md` con una sección "Web: `components/finance/*`" (tabla
  componente → uso).

**Aceptación:** `/en/kit` muestra los 23 componentes; comparados con `docs/prototype/home.html` a
390 px no hay diferencias visibles de tamaño, color ni espaciado.

---

## 1D · App shell

Reemplaza la navegación actual de `(home)` por la de SPEC §2.

**Archivos:** `apps/web/app/[locale]/(protected)/(home)/layout.tsx`, `_components/user-sidebar.tsx`,
`_components/header.tsx`, `_components/navlinks-responsive.tsx` (se sustituye),
`components/common/org-switcher.tsx` (se rediseña) y los archivos nuevos que hagan falta en
`(home)/_components/shell/`.

1. **Sidebar desktop** (N22, `lg` en adelante): reutiliza `components/ui/sidebar.tsx` restyleado a
   `w-60 bg-sidebar px-3 py-4`. Orden: selector de Space (E1, en popover de 288 px) → botón violeta
   `Add transaction` → Home, Transactions, Accounts, Budget, Analytics, Recurring, Debts → separador →
   Assistant → separador → Settings y el usuario abajo. El usuario abre el menú actual
   (`user-menus.tsx`) con perfil, tema, idioma, admin (si tiene permiso) y salir.
2. **Tab bar mobile** (E17, menos de 1024 px): Home, Transactions, **+**, Assistant, More. Se oculta
   cuando hay una hoja abierta. Entre 768 y 1023 px el contenido va centrado a `max-w-[560px]` (D5).
3. **Cabecera**: en mobile, cada pantalla raíz muestra el selector de Space (E1) y la campana (E2);
   las hijas usan `PageHeader` con flecha atrás. En desktop: título de página + `Ask` + campana.
4. **Rutas nuevas** con una página mínima (`StateBlock` vacío con el título de la sección y el texto
   `Coming soon`), para que la navegación esté completa: `/accounts`, `/budget`, `/analytics`,
   `/recurring`, `/debts`, `/assistant`, `/settings`, `/more` (solo mobile; en desktop redirige a
   `/settings`), `/notifications`. Cada fase reemplaza su página.
5. **Botón +** y `Add transaction`: por ahora abren el diálogo actual de
   `transactions/_components/add-record.tsx` dentro de `ResponsiveSheet`. El rediseño es la tarea 2C.
6. **Atajos**: `N` abre el alta y `Esc` cierra la hoja. El resto de atajos es Fase 10.
7. **Notas de 1B para esta tarea:** pasa `closeLabel` traducido a `ResponsiveSheet` (el default es `Close`); usa `initialFocus` en el primer campo de cada hoja; toasts de Firecent con `firecentToast()`. Decidir si el `Toaster` global pasa a `position="bottom-center" mobileOffset={{ bottom: 96 }}` (mueve también los toasts del admin).
8. `/profile`, `/organization`, `/billing` y `/invitations` siguen funcionando: se llega a ellos
   desde Settings (desktop) y More (mobile).
9. i18n: namespace nuevo `Shell` (navegación, `Add transaction`, `Coming soon`, `Ask`) en en y es.
   Quita las llaves que dejen de usarse del boilerplate solo si ninguna otra pantalla las usa.

**Aceptación:** a 390 px se ve como el tab bar de `home.html`; a 1440 px como el sidebar de
`transactions.html`; entre 768 y 1023 px el contenido va centrado a 560 px; el botón + abre el alta
y se puede crear un movimiento; el admin sigue accesible para root.

---

## 1E · Seed de demo

> ⚠️ **La base de datos ya tiene datos reales.** El usuario tiene backup en el esquema `dev`, pero el
> seed **jamás** borra ni modifica nada que no haya creado él mismo. Prohibido correr
> `db push --force-reset`, `migrate reset`, `TRUNCATE` o cualquier borrado sin filtro.

**Archivos nuevos:** `apps/web/scripts/seed-demo.ts`, `apps/web/scripts/demo/data.ts`. Script en el
`package.json` raíz: `"db:seed:demo": "bun apps/web/scripts/seed-demo.ts"`.

1. Transcribe `mock-data.md` §1, §2, §3, §5 y §8 a `demo/data.ts` (datos tipados, montos en
   centavos). Solo lo que existe hoy en el schema; lo marcado con `+` se ignora en esta fase.
2. **Convierte según las decisiones** del README: montos con signo (D1); cada transferencia y pago de
   tarjeta como dos `Record` con `transferGroupId` (D6); saldo de cada cuenta = suma de sus records,
   así que agrega un `Record` INCOME `Opening balance` el 1 de junio para cuadrar los saldos de §2 (D7).
3. **Todo va en Spaces nuevos, marcados como demo**:
   - `Organization` `name: "Maya & Daniel (demo)"`, `slug: "demo-maya-daniel"` (con todos los datos).
   - `Organization` `name: "Personal (demo)"`, `slug: "demo-personal"` (vacío, para los estados vacíos).
   - Usuarios `maya@demo.test` (Maya Torres) y `daniel@demo.test` (Daniel Reyes), con
     `emailVerified: true`, `isOnboarded: true` y rol `user`. Si ya existen, se reutilizan sin tocar
     sus otros datos.
   - Flag opcional `--member=<email>`: agrega a un usuario existente (por ejemplo el del dueño del
     repo) como `member` del Space demo, para verlo con su propia sesión. Solo crea la fila `Member`.
4. **Fechas relativas**: el mock asume que hoy es 2026-11-12. Desplaza todas las fechas por
   `hoy − 2026-11-12` para que el demo siempre se vea "al día". Flag `--fixed` para no desplazar.
5. **Idempotencia segura**:
   - Si los Spaces demo no existen, los crea.
   - Si existen y no se pasó `--reset`, no hace nada y lo dice.
   - Con `--reset`, borra **solo** las filas cuyo `organizationId` sea el de las organizaciones con
     slug exacto `demo-maya-daniel` o `demo-personal` (records, cuentas, categorías, payees, labels,
     deudas, miembros) y las recrea, todo dentro de una transacción. Los usuarios demo no se borran.
   - Antes de escribir, imprime a qué base apunta (host, base y schema de `DATABASE_URL`, sin
     contraseña) y cuántas filas va a crear o borrar.
   - Se niega a correr si `NODE_ENV=production`.
6. Las cuentas privadas de Daniel se crean con `userId` de Daniel. La privacidad todavía no se
   aplica (llega en la Fase 4), así que deja el comentario `// visibility: PRIVATE (Fase 4)`.
7. Documenta el comando y sus flags en `docs/README.md` (sección "Where to start").

**Aceptación:** `bun run db:seed:demo` crea los Spaces; correrlo otra vez no cambia nada; `--reset`
los recrea igual; el número de filas **fuera** de los Spaces demo es el mismo antes y después
(compáralo con un `count` por tabla); como Maya, en `/en/transactions` aparecen los 44 movimientos de
noviembre. El total del Home **incluye** la cuenta privada de Daniel (la privacidad llega en la
Fase 4): anota la diferencia contra el mock.

---

## Carpintería (Haiku)

Se lanzan después de la tarea que las origina, cuando el orquestador ya revisó su diff.

| ID | Tarea | Después de |
| --- | --- | --- |
| 1H1 | Sección "Firecent · primitivas" en `/en/kit` con cada variante de 1B, en claro y oscuro | 1B |
| 1H2 | Sección "Firecent · componentes" en `/en/kit` con cada componente de 1C y su skeleton | 1C |
| 1H3 | Tabla "Web: `components/finance/*`" en `docs/COMPONENTS.md` (componente, props clave, uso) | 1C |
| 1H4 | Llaves `es` de los namespaces nuevos (`Shell`, `Finance`) copiando la estructura de `en`; `check:i18n` en verde | 1C, 1D |
| 1H5 | Documentar `db:seed:demo` en `docs/README.md` y correr `bun run docs:gen` | 1E |
| 1H7 | Pasar "Cambios al prototipo" de esta fase a `docs/prototype/SPEC.md` (§3.2–§3.5, §4.2) | 1C |
| 1H6 | Actualizar la tabla de estado del README y el registro de esta fase | cierre de la fase |

Si una tarea de arriba ya hizo su parte de carpintería, la de Haiku se marca ✅ sin lanzarla.

## Cambios al prototipo

Pendientes de pasar a `docs/prototype/SPEC.md` (tarea de carpintería 1H7):

- (1C) Variante `surface="hero"` en Money, ChangeLine, Sparkline, SplitBar, StatPair y ScopeControl; tiles con `hero-foreground/5` y `/10` en vez de `white/*`; icono Money out con `text-nature-want`.
- (1C) Monedas en dólares no-USD se muestran `MX$`, `CA$`; USD queda `$`.
- (1C) NatureBar en `destructive` y "over plan" para lector al pasarse; neto negativo del día en gris (solo lo positivo en verde).
- (1C) ChangeLine a la baja en tinta con `trending-down`; cero en gris con `minus`.
- (1C) StepList con check en pasos hechos y `aria-current="step"` en el activo.
- (1C) Un solo `h1` por pantalla: 28 px raíz, 17 px hija, 24 px desktop.
- (1C) Segunda línea de filas a 12 px y montos de fila `font-semibold` (como el HTML); CardTotalFooter `py-3` 13 px; botones de AssistantCard a 44 px.
- (1C) Cifra héroe 44/48 px (SPEC) en vez de 42/46 px del HTML.

## Registro

| Tarea | Fecha | Quién | Hecho | Archivos | Desvíos y pendientes |
| --- | --- | --- | --- | --- | --- |
| 1A | 2026-11-13 | Sonnet | Tokens de Marca + propuestos (16 utilidades nuevas, radios 2xl/3xl), Inter variable con `opsz`, body `font-sans` 15 px, `.num`, foco, reduced-motion. Quitado Merriweather (sin uso) | `tokens.css`, `shadcn.theme.css`, `globals.css`, `[locale]/layout.tsx` | Dark `--primary` `#7758fb` en lugar del `#7c5cff` de Marca (AA). Radio de 12 px en botones pasa a 1B. Revisión visual de `/en/admin/users` pendiente (requiere sesión). `bun run typecheck` completo falla en `@app/lib` (`bun:test`) y `lint` web tiene 20 errores, ambos preexistentes. Logos de `public/` ya son Firecent; `COMPONENTS.md:109` aún dice StackGoat (1H3). |
| 1B | 2026-11-13 | Sonnet | Variantes aditivas (defaults intactos): `Button` `variant="text"`, `size="touch"/"icon-touch"`; `Badge` `neutral/shared/private/warning/positive/error`; `Card variant="plain"`; `Toggle variant="chip"/"segmented"` + `ToggleGroup variant="segmented"` (chips: `spacing={2}`); `Input size="touch"`; `Empty variant="state"` + `EmptyMedia variant="icon"`; `Alert` `notice/notice-warning`; `Avatar color=<Colors>` + tamaños `xs/md/lg`; `firecentToast()` en `sonner.tsx`. Nuevos: `ui/responsive-sheet.tsx` (`desktop="dialog"|"panel"`, `hideTitle`, `closeLabel`), `hooks/use-media-query.ts`. Sección `kit/_sections/firecent-primitives.tsx` | `components/ui/{button,badge,card,toggle,toggle-group,input,empty,alert,avatar,sonner}.tsx`, `ui/responsive-sheet.tsx`, `hooks/use-media-query.ts`, `kit/page.tsx`, `kit/_sections/firecent-primitives.tsx` | Toaster global sin cambios (80 toasts usan `richColors`); N12 es opt-in con `firecentToast()`. La posición abajo es decisión de 1D. Revisado a 375 y ~1024 px, no a 1440. Sin revisión de admin ni de Escape real ni swipe. |
| 1C | 2026-11-13 | Opus | 23 componentes en `components/finance/` (+ `index.ts`, `types.ts`, `utils.ts`), con skeleton y `surface="hero"` donde aplica. Extras: `formatMoneyText`, `LoadingRegion`, `ACCOUNT_TYPE_ICON`, `FirecentMark variant="logo"`. Namespace i18n `Finance` (en/es). Sección `kit/_sections/firecent-components.tsx`. `COMPONENTS.md` actualizado | `components/finance/**`, `kit/_sections/firecent-components.tsx`, `kit/page.tsx`, `messages/{en,es}.json`, `docs/COMPONENTS.md`, `.claude/launch.json` (configs `web-3100` y `docs-prototype`) | Verificado por el orquestador a 1440 px en `/en/kit`. Pendiente decisión: fichas de ícono neutras (SPEC) vs. con color de categoría (HTML); default neutro, `color` opt-in. Sin hover de Sparkline ni `View as table` (Fase 3). Dark de página completa, foco por teclado y lector de pantalla sin verificar. |
| 1E | 2026-11-13 | Sonnet | `seed-demo.ts` + `demo/data.ts`, script `db:seed:demo` (flags `--reset`, `--fixed`, `--member`, `--help`), doc en `docs/README.md`. Borrado solo por `organizationId` de slugs demo, en transacción; valida saldos contra mock §2 antes de escribir. Incluye Debts §7. Historia Jun–Oct generada determinista con los totales de §8 | `apps/web/scripts/seed-demo.ts`, `apps/web/scripts/demo/data.ts`, `package.json`, `docs/README.md` | **Verificado por el orquestador (2026-11-13):** seed, repetición (no-op) y `--reset` OK; filas fuera de demo idénticas antes y después; 7 saldos = mock §2; noviembre 44 movimientos, in $6,125.00, out $4,812.14 (con Liverpool convertido; sin convertir suma MX$1,050.00 crudos). Revisión en navegador como Maya pendiente. Conteos (fuera de demo): Organization 2, User 1, Member 2, BankAccount 11, Category 55, Payee 218, Label 0, Record 2861, Debt 37. Si no existe el rol `user`, `ensureRole` lo crea (fuera de los Spaces demo; es lo mismo que hace un sign-up). BBVA en MXN suma sin convertir (conversión en Fase 8). §0 menciona una cuenta privada de Daniel que §2 no define: no se inventó. |
