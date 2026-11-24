# Fase 2 · Cuentas y movimientos (el núcleo)

> Estado: ⏳ lista para ejecutar · Depende de: Fase 1 completa · Lee antes: [README](README.md)

## Objetivo

Las dos cosas que el usuario hace todos los días: **registrar un movimiento** en tres toques y
**encontrarlo después**. Al terminar funcionan, con el diseño nuevo y datos reales: Transactions
(lista, filtros, detalle, edición, borrado con deshacer), el alta rápida, Accounts (lista y alta de
cuenta) y el detalle de cuenta.

**Fuera de alcance** (y qué hacer mientras tanto):

| Pieza del prototipo | Llega en | Mientras tanto |
| --- | --- | --- |
| Alcance `Shared / Only you`, candados, hoja `share`, `Who can see it` | Fase 4 | `ScopeControl` no se muestra. Todo se ve como hoy |
| `≈` conversión a moneda base | Fase 8 | Se muestra solo el monto en la moneda de la cuenta. Los totales se agrupan por moneda como hace hoy `dashboard.netWorth` |
| Recurrentes: chip `repeat` en filas, `Make recurring`, Coming up en detalle de cuenta | Fase 6 | Ocultos |
| `What makes up the balance`, `Record payment`, Installment plans, `Pay in installments` | Fase 7 | En tarjeta se muestra deuda, barra de crédito y fechas (los campos ya existen) |
| Relación con deuda en el detalle de movimiento | Fase 8 | Oculta |
| `Import a statement` en el vacío | Fase 8 | Oculto |

## Referencias

- `docs/prototype/SPEC.md` §5.2 (Transactions), §5.3 (alta rápida), §5.4 (Accounts), §5.5 (detalle).
- `docs/prototype/transactions.html`, `accounts.html`, `account.html`. Hojas con `?sheet=`.
- `docs/prototype/schema-gaps.md` §3 (solo `Category.type` y `Record.spendingNature`).
- Código actual: `packages/api/src/routers/records.ts`, `dashboard.ts`;
  `apps/web/app/[locale]/(protected)/(home)/transactions/`.

## Tareas y dependencias

```
2A Schema + API ──┬─► 2B Transactions ──► 2E Account detail
                  ├─► 2C Alta rápida
                  └─► 2D Accounts
```

2B, 2C y 2D pueden correr en paralelo: tocan carpetas distintas (ver "Archivos" de cada una).

| ID | Tarea | Depende de | Modelo | Estado |
| --- | --- | --- | --- | --- |
| 2A | Migración y routers | Fase 1 | **Opus** | ⏳ |
| 2B | Pantalla Transactions | 2A | **Opus** | ⏳ |
| 2C | Alta rápida (Add transaction) | 2A | **Opus** | ⏳ |
| 2D | Pantalla Accounts y alta de cuenta | 2A | **Sonnet** | ⏳ |
| 2E | Detalle de cuenta | 2B, 2D | **Sonnet** | ⏳ |

---

## 2A · Migración y routers

**Archivos:** `packages/db/prisma/schema.prisma` (+ migración), `packages/api/src/routers/`
(`records.ts`, nuevos `accounts.ts`, `categories.ts`, `labels.ts`), `packages/api/src/root.ts`,
`apps/web/scripts/demo/data.ts` y `seed-demo.ts`, `docs/ARCHITECTURE.md` (vía `docs:gen`).

### Migración `firecent_phase2` (solo aditiva, D10)

```prisma
model Category {
  // + agregar
  type RecordType @default(EXPENSE) // EXPENSE o INCOME. Las de INCOME ignoran spendingNature
}

model Record {
  // + agregar
  spendingNature SpendingNature? // null = hereda de la categoría; valor = override de este movimiento
}
```

Backfill en la misma migración (SQL): las categorías cuyos records son todos `INCOME` pasan a
`type = INCOME`. Actualiza el seed demo: `Paycheck` y `Other income` son de ingreso.

### Router `accounts` (nuevo)

Todas con `requirePermission(p.dashboard.basic)` y filtradas por `ctx.orgId` (copia el patrón de
`records.ts`: `requireOrg`, verificación de pertenencia antes de escribir).

| Procedimiento | Qué hace |
| --- | --- |
| `list` | Cuentas no borradas ni archivadas, con `balance` = suma de sus records (D7, misma regla que `dashboard.netWorth`), agrupadas en `cash` (CHECKING_ACCOUNT, CASH, BANK, GENERAL), `savings` (SAVINGS_ACCOUNT) y `cards` (CREDIT_CARD). Por tarjeta: `available = creditLimit − deuda`, `nextDueDate` calculada con `paymentDayType/paymentDay/paymentEveryDays`. Totales por grupo y héroe **por moneda**. Incluye `ownerId` para la Fase 4 |
| `get` | Una cuenta con `balance`, cambio desde el día 1 del mes, `in` y `out` del mes (incluye transferencias, como dice SPEC §5.5) |
| `create` | Tipos permitidos: CHECKING_ACCOUNT, SAVINGS_ACCOUNT, CASH, CREDIT_CARD (I-15). `userId` = quien la crea (D2). Si trae `currentBalance ≠ 0`, crea en la misma transacción un `Record` INCOME (o EXPENSE en tarjeta) con nota `Opening balance` (D7). Nombre repetido → `CONFLICT` con mensaje `That name is taken in this space.` |
| `update` | Nombre, color, últimos 4 (`accountNumber`), límite, fechas, APR, `displayCreditMode`, `excludeFromStats`. Solo el dueño (`userId`) puede editar (D2) |
| `adjustBalance` | Recibe el saldo real; crea un `Record` con la diferencia y nota `Balance adjustment` |
| `archive` | `archived = true`. Solo el dueño |

### Router `records` (ampliar el existente)

- `list` gana filtros: `search` (payee, nota o monto exacto), `month` (`YYYY-MM`), `type`,
  `natures[]`, `accountIds[]`, `categoryId`, `createdBy`, `minAmount`/`maxAmount` (sobre el valor
  absoluto), `labelIds[]`. Devuelve también por fila: `nature` efectiva (`record.spendingNature ??
  category.spendingNature`), `createdBy` con nombre e inicial, `labels`, `currency`.
- **Transferencias (D6):** `list` devuelve **una** fila por `transferGroupId`: la de salida con
  `from` y `to`. Si se filtra por una cuenta, se devuelve la fila de esa cuenta.
- `monthSummary({ month, ...filtros })`: `in`, `out` (sin transferencias), `count`, y neto por día.
- `get(id)`: detalle completo.
- `update(id, …)`: mismos campos que `create` más `spendingNature`. En transferencias actualiza las
  dos filas en una transacción.
- `delete(id)` y `restore(id)`: soft delete (`deletedAt`, `deletedBy`); en transferencias, las dos
  filas. `restore` sirve para el `Undo` del toast.
- `bulkUpdate({ ids, categoryId?, labelIds? })` y `bulkDelete({ ids })` para la barra de selección
  de desktop.
- `suggestions({ accountId?, type })`: lo que necesita el alta rápida:
  - `categories`: 7 categorías ordenadas por frecuencia en los últimos 90 días para esa franja
    horaria (±2 h) y esa cuenta, rellenando con las más usadas en general.
  - `repeats`: hasta 3 combinaciones frecuentes de payee + monto + categoría + cuenta (aparecen 3
    veces o más en 60 días). **No** son recurrentes (eso es Fase 6).
  - `lastAccountId`: la última cuenta usada por este miembro.
- `exportCsv({ ...filtros })`: CSV con fecha, payee, categoría, cuenta, monto, moneda, nota, labels.
- `create` gana `labelIds`, `spendingNature` y `payeeName` (crea el payee si no existe).

### Routers `categories` y `labels` (nuevos)

`categories.list({ type? })` con jerarquía y `spendingNature`; `labels.list()` y `labels.create`.
La gestión completa de ambos es Fase 10.

### Pruebas

En `packages/api/src/` (mismo estilo que los `.test.mjs` existentes): signo de montos por tipo (D1),
transferencia en dos filas y una sola fila en `list` (D6), `delete` + `restore` de una transferencia,
y que ningún procedimiento lee ni escribe filas de otra organización.

**Aceptación:** `bun run db:migrate` aplica sin pérdida de datos; pruebas en verde; `docs:gen` corrido.

---

## 2B · Pantalla Transactions

**Archivos:** `apps/web/app/[locale]/(protected)/(home)/transactions/` (reemplaza
`transactions-list.tsx` y `transaction-filters.tsx`), componentes nuevos de esta pantalla en su
`_components/`. Si un componente sirve fuera de aquí (lista por día, fila), va en
`components/finance/`.

Construye SPEC §5.2 completa, con estas piezas:

| Bloque | Componentes |
| --- | --- |
| Búsqueda + botón de filtros con contador | `Input size="touch"`, `Button size="icon-touch"` |
| Chips `All · Owe · Need · Want · Income · Transfers` | `Toggle variant="chip"` + `NatureSwatch` |
| Selector de mes con `in · out` | `monthSummary`, `Money` |
| Lista por día | `DayHeader` + `Card variant="plain"` + `TransactionRow`. Paginación infinita (`useInfiniteQuery` con el cursor existente) |
| Hoja Filters | `ResponsiveSheet` (desktop: popover de 360 px). Sin `Show` (Fase 4). El botón dice `Show N transactions` con el conteo en vivo |
| Hoja Detail | `ResponsiveSheet desktop="panel"`. `FieldRow` por campo; `Counts as` con `ToggleGroup variant="segmented"` y la nota `Changes only this transaction.`; acciones `Duplicate` y `Delete transaction` |
| `Edit` | Abre el formulario del alta rápida (2C) en modo edición |
| Borrar | Toast `Transaction deleted` + `Undo` (llama `restore`) |
| Desktop | Tabla con `components/ui/table.tsx` restyleada a N23, casillas y barra `N selected · Change category · Add label · Delete`; `Export CSV` |
| Estados | Vacío (`StateBlock` con `receipt` y el copy de §5.2), sin resultados, carga (esqueleto: búsqueda + dos días de tres filas), error |

La URL guarda el estado (`?month=2026-11&nature=QUIERO&q=...`), para que el filtro sobreviva a un
refresh y se pueda enlazar desde Home y desde el detalle de cuenta (`?account=3`).

**Mejora sobre el prototipo:** búsqueda por monto aproximado (`41` encuentra `$41.24`). Anótalo.

**Aceptación:** comparado con `transactions.html` a 390 y 1440 px, en claro y oscuro, en los cuatro
estados y con las hojas `filters` y `detail`. Con el seed demo, noviembre muestra 44 movimientos y
`$6,125.00 in · $4,812.14 out` (si no cuadra por la cuenta privada de Daniel, anótalo: se corrige en
la Fase 4).

---

## 2C · Alta rápida (Add transaction)

**Archivos:** `apps/web/components/finance/add-transaction/` (nuevo; lo usan el shell y
Transactions), y el punto del shell que hoy abre `add-record.tsx` (tarea 1D). Al terminar,
`transactions/_components/add-record.tsx` se elimina.

Construye SPEC §5.3:

- `ResponsiveSheet` sin título; en desktop, diálogo de 480 px sin teclado numérico.
- Tipo con `ToggleGroup variant="segmented"`: `Expense · Income · Transfer`.
- Monto con `Money size="sheet"`; teclado `AmountKeypad` (N9, componente nuevo en
  `components/finance/`). En desktop, campo con foco inicial; `Enter` guarda.
- `Repeat`: chips con `suggestions.repeats`. Tocar uno llena monto, categoría y cuenta.
- Rejilla de 8 categorías con `suggestions.categories` + `More` (lista completa agrupada por
  Owe/Need/Want con buscador). En desktop, combobox (`components/ui/combobox.tsx`) con las mismas
  sugerencias.
- Fila de contexto: cuenta (default `suggestions.lastAccountId`), fecha (`Today`), `Add note`.
- Botón `Save` / `Save $41.24` / `Pick a category`, con las reglas de habilitado de §5.3.
- `More details`: `Payee` (autocompletar con `components/base/base-autocomplete.tsx`; crea uno nuevo
  si no existe), `Note`, `Labels`. Sin `Pay in installments` (Fase 7).
- Transfer: `From` y `To` con `FieldRow`. Si las monedas difieren, campo `They receive` (el segundo
  record lleva ese monto). Nota `This records it in Firecent. It does not move money at your bank.`
- Al guardar: cierra, toast `Saved · Dining out −$41.24` con `Add details` (abre el detalle 2B).
- Error al guardar: la hoja no se cierra ni pierde datos; aviso `Couldn't save. Your entry is still here.`
- Modo edición (lo usa `Edit` de 2B): mismo formulario precargado.
- Atajo `N` (ya registrado en 1D) abre esta hoja.

**Mejora sobre el prototipo:** al elegir un payee conocido se preselecciona su categoría más usada.
Anótalo.

**Aceptación:** registrar un gasto con `+`, una categoría y `Save` (tres toques) a 390 px; registrar
ingreso y transferencia; editar; error simulado (servidor apagado) sin perder lo capturado.

---

## 2D · Pantalla Accounts y alta de cuenta

**Archivos:** `apps/web/app/[locale]/(protected)/(home)/accounts/page.tsx` (reemplaza el
placeholder de 1D) y su `_components/`.

Construye SPEC §5.4 con `accounts.list`:

- `PageHeader` `Accounts` con acción `plus`.
- Héroe `Balance` con `Money size="hero"`. Si hay más de una moneda, la principal en el héroe y las
  otras en una línea debajo (`+ MX$38,500.00`), como hace hoy `NetWorthCard`.
- Línea `$38,857.19 in accounts · −$2,458.72 on cards`.
- Tres grupos con `DayHeader` (reutilizado como encabezado de grupo con subtotal) y `AccountRow`.
  En tarjetas: meta `Due Nov 15` en `text-warning` si faltan 7 días o menos (sin monto del estado de
  cuenta hasta la Fase 7) y `available` debajo; respeta `displayCreditMode`.
- Fila `Debts` con `NavRow` (vista previa con la suma de `Debt` no pagadas; la pantalla es Fase 8).
- Hoja `Add account` (§5.4) sin `Who can see it` (Fase 4). Para tarjeta pide solo
  `Credit limit`, `Payment is due on` (se guarda en `paymentDay`) y `APR`. `Statement closes on` y
  `Pay it from` llegan en la Fase 7, porque el día de corte todavía no existe en el schema.
- Desktop: tres columnas (`grid-cols-3`) y Debts a todo lo ancho.
- Estados: vacío (`wallet`, copy de §5.4), carga (héroe + dos grupos de dos filas), error.

**Aceptación:** comparado con `accounts.html` a 390 y 1440 px; crear una cuenta de cada tipo; nombre
repetido muestra el error de §5.4.

---

## 2E · Detalle de cuenta

**Archivos:** `apps/web/app/[locale]/(protected)/(home)/accounts/[id]/` (nuevo).

Construye SPEC §5.5 con `accounts.get` y `records.list({ accountId })`:

- Cuenta normal: `PageHeader` con menú (`Edit account`, `Adjust balance`, `Archive`; `Make private`
  y `Share` en Fase 4), héroe `Balance`, `ChangeLine` `since Nov 1`, pastillas (`Badge`) de tipo y
  últimos 4, `StatPair` In/Out con `Includes transfers.`, y la lista por día de 2B (primeras 10 filas
  + `See all` → `/transactions?account=<id>`). Sin Coming up (Fase 6).
- Tarjeta de crédito: héroe `You owe` (sin signo), barra de crédito (`role="progressbar"`) con
  `available` y `of $limit`, tarjeta `Dates` (`Payment is due`, `APR`) y la lista. Sin `What makes
  up the balance` ni planes (Fase 7).
- Hojas `Edit account` (mismo formulario de 2D) y `Adjust balance` (campo con el saldo real, crea el
  ajuste). `Archive` con toast y `Undo`.
- Desktop: dos columnas como §5.5.
- Estados: carga con la forma de cada variante, error, y `No transactions in this account yet.`

**Aceptación:** comparado con `account.html?id=1` y `?id=3`; ajustar saldo cambia el héroe y crea
la fila `Balance adjustment`; solo el dueño ve `Edit` y `Archive` (D2).

---

## BUILD-QUESTIONS que cierra esta fase

#13–#17 (Transactions y alta), #18, #20, #22. Al cerrar, marca cada una con la decisión final en
`docs/prototype/BUILD-QUESTIONS.md`.

## Carpintería (Haiku)

| ID | Tarea | Después de |
| --- | --- | --- |
| 2H1 | Correr `bun run docs:gen` y revisar que `docs/ARCHITECTURE.md` lista los routers nuevos | 2A |
| 2H2 | Llaves `es` de Transactions, Accounts y del alta rápida; `check:i18n` en verde | 2B, 2C, 2D, 2E |
| 2H3 | Agregar `AmountKeypad` y los componentes nuevos de la fase a `/en/kit` y a `docs/COMPONENTS.md` | 2C |
| 2H4 | Marcar en `docs/prototype/BUILD-QUESTIONS.md` las preguntas que cierra la fase, con la decisión final | cierre de la fase |
| 2H5 | Actualizar la tabla de estado del README y el registro de esta fase | cierre de la fase |

## Cambios al prototipo

(Anota aquí cada mejora de diseño hecha en esta fase y repítela en `docs/prototype/SPEC.md`.)

## Registro

| Tarea | Fecha | Quién | Hecho | Archivos | Desvíos y pendientes |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
