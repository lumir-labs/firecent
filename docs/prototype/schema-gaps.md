# Firecent · huecos del schema

Qué hay que **agregar** a `packages/db/prisma/schema.prisma` para que las pantallas de `SPEC.md`
funcionen, y dónde el requerimiento y el schema se contradicen.

**Regla**: el schema solo crece. No se borra ni se renombra ningún modelo, campo o valor de enum,
porque las tablas ya tienen datos. Todo campo nuevo es opcional o tiene default, para que las filas
existentes sigan siendo válidas sin backfill obligatorio.

Sustituye la sección "Campos y modelos que faltan en el schema" de `design-notes.md`.

## 1. Resumen

| Área | Enums nuevos | Campos nuevos en modelos existentes | Modelos nuevos |
| --- | --- | --- | --- |
| Spaces y privacidad | `AccountVisibility`, `SpaceKind` | `BankAccount.visibility`, `Organization.displayName / kind / baseCurrency`, `Debt.userId / visibility / currency`, `Member.defaultAccountId` | `ExchangeRate`, `BalanceSnapshot` |
| Presupuestos | | `Category.type`, `Record.spendingNature`, `Record.excludeFromStats` | `Budget`, `BudgetNature`, `BudgetCategory` |
| Recurrentes | `RecurringMode`, `RecurringFrequency`, `OccurrenceStatus` | `Record.recurringId` | `Recurring`, `RecurringOccurrence` |
| Tarjetas e Installment plans | `InstallmentStatus` | `BankAccount.statementDay / openingBalance`, `Record.installmentPlanId / statementId / transferAmount` | `CardStatement`, `InstallmentPlan` |
| IA | `InsightStatus`, `ProposalStatus`, `ProposalKind`, `MessageRole`, `RecordSource` | `Record.source / proposalId` | `Insight`, `AssistantThread`, `AssistantMessage`, `AssistantProposal`, `ImportFile`, `Notification` |

## 2. Spaces y privacidad

```prisma
enum AccountVisibility {
  SHARED   // todos los miembros del Space
  PRIVATE  // solo BankAccount.userId
}

enum SpaceKind {
  PERSONAL // creado al registrarse, un solo miembro, no admite invitaciones
  SHARED
}

model BankAccount {
  // + agregar
  visibility     AccountVisibility @default(SHARED)
  statementDay   Int?              // día de corte, solo CREDIT_CARD (sección 5)
  openingBalance Int               @default(0) // ver inconsistencia I-9
}

model Organization {
  // + agregar
  displayName  String?            // nombre que ve el usuario; ver inconsistencia I-11
  kind         SpaceKind @default(SHARED)
  baseCurrency String    @default("USD")
}

model Member {
  // + agregar
  defaultAccountId Int? // cuenta preseleccionada en el alta rápida, por miembro y Space
}

model Debt {
  // + agregar
  userId     String?
  visibility AccountVisibility @default(SHARED)
  currency   String            @default("USD")
}

model ExchangeRate {
  id        Int      @id @default(autoincrement())
  base      String   // "USD"
  quote     String   // "MXN"
  rate      Decimal  @db.Decimal(18, 8) // unidades de quote por 1 de base: 18.47
  date      DateTime @db.Date
  createdAt DateTime @default(now())

  @@unique([base, quote, date])
}

model BalanceSnapshot {
  id             Int      @id @default(autoincrement())
  organizationId String   @db.Uuid
  accountId      Int
  date           DateTime @db.Date
  balance        Int      // en la moneda de la cuenta
  refBalance     Int      // en la moneda base del Space, al tipo de ese día

  @@unique([accountId, date])
  @@index([organizationId, date])
}
```

Reglas que la API debe cumplir (no son campos):

- **Default `SHARED`** para las cuentas existentes: hoy todo miembro ya las ve, así que el default
  conserva el comportamiento actual.
- Un `Record`, un `Recurring`, un `CardStatement` y un `InstallmentPlan` heredan la visibilidad de
  su cuenta. No llevan campo propio.
- Una transferencia entre una cuenta privada y una compartida: el otro miembro ve la pata en la
  cuenta compartida con el texto `From a private account` / `To a private account`, sin nombre ni saldo.
- **Toda agregación se calcula por espectador**: balance, Money in/out, bolsas, analíticas y lo que
  el asistente puede leer. Nunca se guarda un total del Space que mezcle cuentas privadas.
- Cambiar una cuenta de `PRIVATE` a `SHARED` expone su historial completo. La UI lo confirma con
  texto explícito. De `SHARED` a `PRIVATE` solo lo puede hacer el dueño (`userId`).
- `Session.activeOrganizationId` ya existe y es lo que usa el selector de Space. No falta nada ahí.
- `Member.role` ya existe (`owner`, `admin`, `member`). Solo `owner` y `admin` invitan y editan el plan.

## 3. Presupuestos

```prisma
model Category {
  // + agregar
  type RecordType @default(EXPENSE) // EXPENSE o INCOME; las de ingreso llevan spendingNature = null
}

model Record {
  // + agregar
  spendingNature   SpendingNature? // null = hereda de la categoría; valor = el usuario lo cambió en este movimiento
  excludeFromStats Boolean         @default(false) // no cuenta en Money in/out ni en el plan (prestar y cobrar una deuda)
}

model Budget {
  id             Int       @id @default(autoincrement())
  organizationId String    @db.Uuid
  month          DateTime  @db.Date // primer día del mes
  expectedIncome Int       @default(0)
  createdBy      String?
  updatedBy      String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  organization Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  natures      BudgetNature[]
  categories   BudgetCategory[]

  @@unique([organizationId, month])
}

model BudgetNature {
  id       Int            @id @default(autoincrement())
  budgetId Int
  nature   SpendingNature
  amount   Int

  budget Budget @relation(fields: [budgetId], references: [id], onDelete: Cascade)

  @@unique([budgetId, nature])
}

model BudgetCategory {
  id         Int @id @default(autoincrement())
  budgetId   Int
  categoryId Int
  amount     Int

  budget   Budget   @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@unique([budgetId, categoryId])
}
```

- **Decisión**: el plan es del Space y está en su moneda base. La suma de límites de categoría de
  una bolsa no puede superar la bolsa (validación de API, mensaje en SPEC).
- **Decisión**: sin acumulado entre meses en v1. Al abrir un mes sin plan se ofrece copiar el anterior.
- `Envelope` y `Record.envelopeId` se quedan y dejan de mostrarse (inconsistencia I-1).
- **Decisión (deudas)**: pagar una deuda propia es un `Record` EXPENSE normal (cuenta en Owe) ligado
  por `Debt.records`. Prestar dinero y cobrarlo son `Record` con `excludeFromStats = true`: mueven
  el saldo de la cuenta pero no son gasto ni ingreso. `Debt.remainingAmount` baja con cada pago ligado.
  Los intereses no se modelan en v1.

## 4. Recurrentes

```prisma
enum RecurringMode {
  AUTO   // el día que toca se crea el Record solo
  MANUAL // el día que toca se pide confirmar (y capturar el monto si es estimado)
}

enum RecurringFrequency {
  WEEKLY
  MONTHLY
  YEARLY
}

enum OccurrenceStatus {
  PENDING
  CONFIRMED
  SKIPPED
}

model Recurring {
  id                Int                @id @default(autoincrement())
  organizationId    String             @db.Uuid
  name              String
  type              RecordType         @default(EXPENSE)
  amount            Int
  isEstimate        Boolean            @default(false) // se muestra con "~"
  accountId         Int
  transferAccountId Int?
  categoryId        Int?
  payeeId           Int?
  mode              RecurringMode      @default(MANUAL)
  frequency         RecurringFrequency @default(MONTHLY)
  interval          Int                @default(1) // cada N semanas, meses o años
  daysOfMonth       Int[]              @default([]) // MONTHLY: [1] o [2, 16]; 31 = último día
  startDate         DateTime           @db.Date
  nextDate          DateTime?          @db.Date
  endDate           DateTime?          @db.Date
  pausedAt          DateTime?
  note              String?
  createdBy         String?
  updatedBy         String?
  deletedBy         String?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
  deletedAt         DateTime?

  occurrences RecurringOccurrence[]

  @@index([organizationId])
  @@index([nextDate])
}

model RecurringOccurrence {
  id          Int              @id @default(autoincrement())
  recurringId Int
  dueDate     DateTime         @db.Date
  amount      Int              // el esperado en ese momento
  status      OccurrenceStatus @default(PENDING)
  recordId    Int?             @unique // el Record creado al confirmar
  decidedBy   String?
  decidedAt   DateTime?

  recurring Recurring @relation(fields: [recurringId], references: [id], onDelete: Cascade)

  @@unique([recurringId, dueDate])
}

model Record {
  // + agregar
  recurringId Int?
}
```

- **Decisión**: `AUTO` es la única vía por la que se crea un `Record` sin un toque del usuario, y
  solo después de que él activó ese modo en esa plantilla (lo dice el requerimiento).
- **Decisión**: un ingreso recurrente usa `mode = MANUAL` y la UI lo etiqueta `Expected`. El día
  que toca pregunta `Did it arrive?`.
- El historial de cambios de precio se deriva de los `Record` con ese `recurringId`. No se guarda.
- Pausar = `pausedAt`. No se borra la plantilla ni sus ocurrencias.

## 5. Tarjetas e Installment plans

```prisma
enum InstallmentStatus {
  ACTIVE
  PAID_OFF
  CANCELLED // liquidado antes de tiempo
}

model CardStatement {
  id                Int       @id @default(autoincrement())
  organizationId    String    @db.Uuid
  accountId         Int
  closingDate       DateTime  @db.Date
  dueDate           DateTime  @db.Date
  statementBalance  Int       // lo que se debe pagar para no generar intereses
  purchasesAmount   Int       @default(0)
  installmentAmount Int       @default(0) // suma de mensualidades de ese corte
  minimumPayment    Int?
  paidAmount        Int       @default(0)
  paidAt            DateTime?
  paymentRecordId   Int?      // el TRANSFER con el que se pagó
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@unique([accountId, closingDate])
  @@index([organizationId, dueDate])
}

model InstallmentPlan {
  id                Int               @id @default(autoincrement())
  organizationId    String            @db.Uuid
  accountId         Int
  recordId          Int               @unique // la compra original, por el total
  name              String?           // si falta se usa el payee de la compra
  totalAmount       Int
  installments      Int               // 3, 6, 9, 12, 18, 24
  installmentAmount Int               // la última absorbe el redondeo
  interestRate      Float             @default(0) // 0 = "0% interest"
  firstClosingDate  DateTime          @db.Date // corte en el que se factura la primera
  status            InstallmentStatus @default(ACTIVE)
  createdBy         String?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  deletedAt         DateTime?

  @@index([organizationId])
  @@index([accountId])
}

model Record {
  // + agregar
  installmentPlanId Int?
  statementId       Int? // en qué corte quedó facturado (conciliación)
  transferAmount    Int? // TRANSFER entre monedas: lo que llega, en la moneda de transferAccountId
}
```

- **Decisión**: la compra a meses es **un** `Record` EXPENSE por el total en la fecha de compra. La
  deuda existe desde ese día, así que el balance y el Money out son honestos. El plan solo reparte
  cómo la factura la tarjeta: cada corte incluye una mensualidad; el resto queda como "not yet billed".
- **Decisión**: mensualidades facturadas = número de cortes desde `firstClosingDate` hasta hoy,
  con tope en `installments`. Se calcula, no se guarda.
- **Decisión**: `BankAccount.balance` de una tarjeta es negativo cuando se debe.
  `Available = creditLimit + balance`.
- **Decisión**: la UI solo ofrece día de pago mensual. `PaymentDayType.EVERY_X_DAYS` y
  `paymentEveryDays` se conservan para filas existentes y no se exponen.
- `displayCreditMode` ya existe y se respeta: decide cuál de las dos cifras va en grande en la
  fila de la tarjeta.
- Pendiente para una fase posterior (no bloquea): `AccountType.LOAN`, para que un préstamo cuente
  en el Balance como pasivo. Agregar un valor a un enum es aditivo.

## 6. IA

```prisma
enum InsightStatus {
  NEW
  DISMISSED
  ACTED
}

enum MessageRole {
  USER
  ASSISTANT
}

enum ProposalKind {
  CREATE_RECORDS
  UPDATE_RECORDS
  CREATE_RECURRING
  UPDATE_RECURRING
  UPDATE_BUDGET
  CREATE_DEBT
}

enum ProposalStatus {
  PENDING
  APPROVED
  REJECTED
  UNDONE
  EXPIRED
}

enum RecordSource {
  MANUAL
  RECURRING
  IMPORT
  ASSISTANT
  API
}

model Insight {
  id             Int           @id @default(autoincrement())
  organizationId String        @db.Uuid
  userId         String        // a quién se le muestra; se calcula con lo que esa persona puede ver
  kind           String        // "PRICE_INCREASE", "PACE", "RECURRING_CANDIDATE", ...
  title          String
  body           String
  payload        Json?         // ids y cifras para la acción principal
  status         InsightStatus @default(NEW)
  createdAt      DateTime      @default(now())
  decidedAt      DateTime?

  @@index([organizationId, userId, status])
}

model AssistantThread {
  id             Int       @id @default(autoincrement())
  organizationId String    @db.Uuid
  userId         String    // los hilos son privados de quien los abre
  title          String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  messages AssistantMessage[]

  @@index([organizationId, userId])
}

model AssistantMessage {
  id        Int         @id @default(autoincrement())
  threadId  Int
  role      MessageRole
  content   String
  sources   Json?       // { recordCount, from, to, filters } para el chip "Based on…"
  fileId    Int?        // ImportFile adjunto
  createdAt DateTime    @default(now())

  thread AssistantThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@index([threadId])
}

model AssistantProposal {
  id             Int            @id @default(autoincrement())
  organizationId String         @db.Uuid
  userId         String
  threadId       Int?
  messageId      Int?
  insightId      Int?
  kind           ProposalKind
  summary        String         // "Add a recurring payment"
  payload        Json           // el cambio exacto que se aplicaría
  status         ProposalStatus @default(PENDING)
  decidedBy      String?
  decidedAt      DateTime?
  result         Json?          // ids creados o valores previos, para Undo
  createdAt      DateTime       @default(now())

  @@index([organizationId, userId, status])
}

model ImportFile {
  id             Int      @id @default(autoincrement())
  organizationId String   @db.Uuid
  userId         String
  accountId      Int?
  fileName       String
  mimeType       String
  storageKey     String
  status         String   @default("uploaded") // uploaded, parsed, failed
  createdAt      DateTime @default(now())
}

model Notification {
  id             Int       @id @default(autoincrement())
  organizationId String    @db.Uuid
  userId         String
  kind           String    // "CARD_DUE", "RECURRING_CONFIRM", "MEMBER_ACTIVITY", "BUDGET", "PROPOSAL"
  title          String
  payload        Json?
  readAt         DateTime?
  createdAt      DateTime  @default(now())

  @@index([userId, readAt])
}

model Record {
  // + agregar
  source     RecordSource @default(MANUAL)
  proposalId Int?
}
```

- **Regla dura**: el asistente no escribe en `Record`, `Recurring`, `Budget*`, `Debt` ni
  `BankAccount`. Solo crea filas `AssistantProposal` en `PENDING`. La escritura la hace la API
  cuando un usuario aprueba, y deja `decidedBy`, `decidedAt` y `result`.
- El asistente lee con los permisos de `userId`. Nunca ve cuentas privadas de otro miembro.
- `ApiKey` es del Space y no de un miembro, así que hoy una llave (y el servidor MCP) podría leer
  cuentas privadas. **Decisión**: una llave actúa con la visibilidad de `ApiKey.createdById`.

## 7. Inconsistencias entre requerimiento y schema

| # | El requerimiento dice | El schema tiene | Decisión |
| --- | --- | --- | --- |
| I-1 | "`Envelope` se elimina, presupuestos desde cero" | `Envelope`, `Record.envelopeId`, `Organization.envelopes` | No se borra. Se deja de leer y escribir. Los presupuestos usan `Budget*`. |
| I-2 | "`Organization` se renombra en Fase 3" | `@@map("organization")` | No se renombra nunca. "Space" es solo la etiqueta de la UI. |
| I-3 | "montos siempre `Int` centavos" | `BankAccount.balanceDisplay Float` | Se deja de leer. Se sigue escribiendo `balance / 100` mientras exista código que lo use. |
| I-4 | "multi-moneda por cuenta" | `BankAccount.currency` sin moneda base ni tipos de cambio. `Record.refCurrencyAmount` sin definir contra qué moneda | `Organization.baseCurrency` + `ExchangeRate`. `refCurrencyAmount` = monto en la moneda base al tipo del día del movimiento; se llena solo si la cuenta no está en la moneda base. |
| I-5 | "privacidad: cuenta privada o compartida" | Nada. Todo miembro ve todo | `BankAccount.visibility` (sección 2). |
| I-6 | "tarjetas completo con MSI" | `creditLimit`, `paymentDay`, `interestRate`, `displayCreditMode`. Sin corte, estados de cuenta ni planes | Sección 5. |
| I-7 | "recurrentes plantilla + auto/manual" | Nada | Sección 4. |
| I-8 | "IA analista completo", "jamás auto-confirma dinero real" | Solo `ApiKey` y `apps/mcp` | Sección 6. Ningún camino de escritura sin `AssistantProposal` aprobada. |
| I-9 | "balances en memoria se reemplazan por agregación SQL" | `BankAccount.balance` guardado | `balance` se mantiene como caché que la API actualiza en la misma transacción que el `Record`. Fuente de verdad = `openingBalance` + suma de `Record`. Backfill: `openingBalance = balance − suma de records` por cuenta. |
| I-10 | "i18n `es/en`" | | La UI se escribe en inglés. El enum `SpendingNature` (`DEBO`, `NECESITO`, `QUIERO`) no cambia; se traduce al mostrar: Owe, Need, Want. |

Dentro del schema, sin que el requerimiento lo mencione:

| # | Problema | Decisión |
| --- | --- | --- |
| I-11 | `Organization.name @unique` es global: dos personas no pueden tener un Space "Personal" o "Home" | `name` pasa a ser un identificador interno único (`personal-<userId>`, o el slug). La UI lee y edita `displayName`. |
| I-12 | `BankAccount @@unique([organizationId, name])`: si Daniel crea una cuenta privada "Cash", Maya no puede crear la suya, y el error le revela que existe | **Requiere aprobación del dueño del repo**: cambiar el índice a `[organizationId, userId, name]`. No pierde datos, pero modifica una restricción existente. Mientras tanto, la API devuelve el genérico `That name is taken in this space.` |
| I-13 | `Record.transfer Boolean` duplica `type = TRANSFER`. `transferGroupId` no tiene relación | Una transferencia es **un** `Record` con `type = TRANSFER`, `accountId` = origen y `transferAccountId` = destino. `transfer` se escribe en `true` por compatibilidad. `transferGroupId` no se usa. |
| I-14 | `Record.amount` no dice si lleva signo | Siempre positivo; el signo lo da `type`. |
| I-15 | `AccountType` mezcla `GENERAL` y `BANK` con tipos concretos | La UI ofrece Checking, Savings, Cash y Credit card. `GENERAL` se muestra como "Other" y `BANK` como "Bank" en filas existentes; no se pueden elegir al crear. |
| I-16 | `PaymentType` (`CASH`, `CREDIT_CARD`, `WEB_PAYMENT`, default `CASH`) no cubre débito ni transferencia, y `paymentTypeLocal` no tiene uso definido | No se muestra. Se escribe `CREDIT_CARD` si la cuenta es tarjeta y `CASH` en lo demás. |
| I-17 | `Category.spendingNature` tiene default `NECESITO` aunque la categoría sea de ingreso | `Category.type` (sección 3). Ingreso → `spendingNature = null`. |
| I-18 | El enum `Colors` existe pero `BankAccount.color`, `Category.color` y `Label.color` son `String?` | Se guarda el nombre del enum en mayúsculas (`"PURPLE"`). Se pinta con `bg-brand-{color} text-brand-{color}-foreground`. |
| I-19 | `Debt` no tiene moneda, dueño ni visibilidad. `creationDate` convive con `createdAt` | Sección 2. `creationDate` = cuándo nació la deuda (editable); `createdAt` = cuándo se capturó. |
| I-20 | `Record.recordDate` es opcional y la hora va aparte en `recordTime` | La API siempre llena `recordDate`. `recordTime` solo si el usuario la da. |
| I-21 | `Record.customCategory`, `warrantyInMonth`, `gpsLatitude / gpsLongitude / gpsAccuracy` no tienen uso en el requerimiento | No aparecen en la UI de v1. Se conservan. |
| I-22 | `Label` no tiene único por Space y nombre | Validación en API. Agregar el índice único requiere limpiar duplicados antes. |
| I-23 | El modelo `Account` es el de autenticación (better-auth) y `BankAccount` el financiero | En la UI, "Account" siempre es `BankAccount`. |
