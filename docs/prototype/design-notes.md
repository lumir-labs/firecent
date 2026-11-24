# Firecent · notas de diseño

> Estado: **dirección visual (Home mobile) aprobada**. Este documento explica el porqué de la
> dirección. Para construir el resto se usa [`SPEC.md`](SPEC.md) (pantallas, sistema de diseño y
> copy), [`mock-data.md`](mock-data.md) (datos) y [`schema-gaps.md`](schema-gaps.md) (lo que falta
> en el schema; sustituye la última sección de este archivo).

## Cómo ver el prototipo

- Abre `fable/index.html` (funciona desde disco, sin red). Arriba están los toggles de
  dispositivo, tema (claro, oscuro o ambos lado a lado) y estado (con datos, vacío, carga).
- Cada pantalla es un HTML propio (`home.html`) que también abre sola: `home.html?theme=dark&state=empty`.
- `bun fable/build.mjs` regenera `assets/app.css` y `assets/icons.js`. El CSS se compila con el
  Tailwind v4 del repo **contra los tokens reales** (`packages/lib/src/globals.css`) más
  `src/tokens.proposed.css`. Las utilidades del prototipo (`bg-card`, `text-muted-foreground`,
  `border-border`…) son las mismas que ya genera shadcn en web y Uniwind en mobile.

## Principios

1. **Un número, luego el contexto.** Cada pantalla abre con la cifra que responde su pregunta
   (aquí: cuánto tengo) sin tarjeta alrededor. Las tarjetas se reservan para grupos de filas.
2. **El color significa algo o no está.** Violeta = lo que puedes tocar y lo compartido.
   Verde = dinero que entra. Ámbar = vence pronto. Arena + flama = habla el asistente.
   Un gasto normal va en tinta neutra: gastar no es un error.
3. **Quién lo ve, siempre visible.** La diferencia de Firecent es que las finanzas son de un
   Space. El balance se parte en *Shared* y *Only you*, y las cuentas privadas llevan candado.
4. **Owe / Need / Want es el eje del producto.** Mismo orden, mismos tres colores de marca
   (tinta, violeta, naranja) en Home, Presupuestos y Analíticas.
5. **El asistente propone, el usuario aprueba.** Todo lo que viene de IA vive en la superficie
   arena y termina en una acción explícita. Nunca hay un movimiento de dinero implícito.
6. **Calma antes que densidad.** Máximo cuatro bloques en Home, una sola acción violeta por
   pantalla (el botón +), sin sombras decorativas ni gradientes de relleno.

## Decisiones clave

| Tema | Decisión | Por qué |
| --- | --- | --- |
| Navegación mobile | Home, Transactions, **+**, Assistant, More | Acordado: el asistente tiene tab propio. Presupuestos, Cuentas, Analíticas, Recurrentes y Deudas viven en More y se alcanzan desde Home (enlace *Budget*, filas de *Coming up*, split del balance). |
| Ícono del asistente | La flama de la marca, mono en reposo y a color cuando habla | Evita el destello genérico de "IA" y usa el activo más reconocible de la marca. |
| Naturaleza del gasto | `DEBO/NECESITO/QUIERO` se muestra como **Owe / Need / Want** | Acordado. El enum no cambia. |
| Compras a meses | **Installment plans** ("3 of 12", "0% interest") | Término neutro e internacional; MSI queda como etiqueta local si se vende en México. |
| Presupuesto | Híbrido: plan mensual con tres bolsas (Owe/Need/Want) y límites opcionales por categoría | Se entiende en diez segundos y escala a detalle. Es aditivo: `Envelope` no se toca. |
| Marcador de ritmo | Raya vertical en cada barra = hoy (40% del mes) | Dice si vas adelantado sin recurrir a rojo ni a texto de alarma. |
| Montos | `$` y centavos más pequeños y en gris; números tabulares en todo el producto | La parte entera es lo que se lee de un vistazo. |
| Signos | Ingreso `+$` en verde con flecha; gasto sin signo en listas de pagos, `−$` en movimientos | El color nunca es el único indicador: siempre hay signo, ícono o texto. |
| Tipografía | Solo Inter Variable (eje óptico activo: los números grandes toman el corte Display) | Es la tipografía de la marca; un solo archivo cubre texto y display. |
| Estados | Vacío = invitación con tres pasos reales; carga = esqueleto con la forma final | El vacío de Home es el principio del onboarding, no una ilustración. |
| Autocontenido | CSS compilado, fuente e íconos locales | Abre sin CDN; los íconos salen del `lucide-react` instalado. |

### Home (mobile)

Cuatro bloques, en orden de pregunta:

1. **Balance**: patrimonio neto del Space visible para el usuario, cambio en el mes, tendencia de
   6 meses y split *Shared / Only you*.
2. **November**: entradas y salidas del mes, las tres bolsas contra el plan y lo que queda por día.
3. **Coming up**: próximos 7 días. Cada fila dice de dónde sale o a dónde entra y su modo
   (*Auto*, *Manual*, *Expected*, *Due in 3 days*).
4. **Insight del asistente**: un hallazgo concreto con cifra y una acción.

Datos mock (coherentes para todas las pantallas; el detalle está comentado al inicio de `home.html`):
Maya Torres en el Space *Maya & Daniel*. Balance $36,398.47 = $30,874.23 compartido + $5,524.24
privado. Noviembre: $6,125.00 entran, $4,812.14 salen (Owe $2,470.00 + Need $1,406.89 + Want
$935.25), neto +$1,312.86. Plan $7,400.00, quedan $2,587.86 para 18 días ($143.77 al día).

## Propuesta de ajustes a `tokens.css`

Archivo listo para fusionar: [`src/tokens.proposed.css`](src/tokens.proposed.css) (misma forma
que `tokens.css`; toda variable existe en `light` y `dark`, como exige Uniwind). Ratios medidos
con la fórmula WCAG 2.1.

**Cambios a tokens existentes**

| Token | Antes | Después | Motivo |
| --- | --- | --- | --- |
| `--radius` | `0.5rem` | `0.75rem` | Tarjetas `rounded-2xl` (16px), controles 12px, hojas 24px. El radio marca jerarquía. |
| `--background` (light) | `#f8fafc` | `#f4f6fa` | Es el Gray 50 de la marca; la tarjeta blanca se separa sin sombra. |
| `--muted` (light) | `#f4f6fa` | `#eef1f6` | Un paso bajo el nuevo fondo (pistas de barras, fichas de fecha). |
| `--muted-foreground` (light) | `#64748b` | `#566275` | 4.40:1 sobre `muted` no llega a AA; ahora 5.46:1. |
| `--destructive` (light) | `#ef4444` | `#dc2626` | Como texto sobre blanco: 3.76:1 → 4.83:1. |
| `--destructive` (dark) | `#ef4444` | `#f87171` | Como texto sobre tarjeta: 4.66:1 → 6.35:1. |
| `--primary` (dark) | `#7c5cff` | `#7758fb` | Texto blanco encima: 4.35:1 → 4.59:1. |
| `--muted` (dark) | `#131b2e` | `#17202f` | Más separación de pistas sobre tarjeta. |

**Tokens nuevos**

| Token | Light | Dark | Uso |
| --- | --- | --- | --- |
| `--positive` | `#047857` | `#34d399` | Dinero que entra (5.48:1 / 9.13:1). |
| `--warning` | `#b45309` | `#fbbf24` | Vence pronto, por encima del ritmo. |
| `--primary-text` | `#5046e0` | `#a99bff` | Primario usado como texto o enlace (el relleno violeta no alcanza AA como texto en oscuro). |
| `--nature-owe` | `#334155` | `#a9b4c6` | Bolsa Owe. |
| `--nature-need` | `#5e54f0` | `#9a88fb` | Bolsa Need. |
| `--nature-want` | `#f9622f` | `#ff7a3d` | Bolsa Want. El Fire Orange puro da 2.83:1 sobre blanco; este llega a 3:1 para gráficos. |
| `--assistant` | `#fff7f0` | `#1e1714` | Superficie del asistente (Sand de la marca). |
| `--assistant-border` | `#fbdcc8` | `#3d261b` | Borde de esa superficie. |
| `--assistant-accent` | `#c2410c` | `#ffa983` | Texto de acento del asistente (4.89:1 / 9.47:1). |

Sombras: el prototipo no usa las sombras actuales (`0 4px 8px -1px / 10%`) en tarjetas; separa
con borde y contraste de superficie. Propuesta: dejar sombra solo para elementos flotantes
(hojas, popovers, botón +).

## Campos y modelos que faltan en el schema

Todo es **aditivo**: nada se borra ni se renombra, porque ya hay datos. `Envelope` y
`Record.envelopeId` se quedan como están y simplemente dejan de mostrarse.

Lo que ya exige el Home:

| Necesidad en la UI | Hoy | Propuesta |
| --- | --- | --- |
| Cuenta privada o compartida (split *Shared / Only you*, candado) | No existe | `BankAccount.visibility` enum `SHARED \| PRIVATE` (default `SHARED`). El dueño es el `userId` que ya existe. |
| Balance en una sola moneda con cuentas en varias | `currency` por cuenta, sin moneda base | `Organization.baseCurrency` (default `"USD"`) y modelo `ExchangeRate { base, quote, rate, date }`. `Record.refCurrencyAmount` ya existe para el monto convertido. |
| Tendencia del balance (línea de 6 meses) | Solo el saldo actual | `BalanceSnapshot { accountId, date, balance }` diario, o agregación SQL sobre `Record`. El snapshot es más barato de leer. |
| Plan del mes y bolsas Owe/Need/Want | `Envelope` (se abandona) | `Budget { organizationId, month, expectedIncome }`, `BudgetNature { budgetId, nature, amount }`, `BudgetCategory { budgetId, categoryId, amount }` (opcional). |
| *Coming up*: recurrentes en auto o manual | No existe | `Recurring { type, amount, isEstimate, accountId, transferAccountId, categoryId, payeeId, mode AUTO \| MANUAL, frequency, interval, nextDate, endDate }` y `Record.recurringId` para enlazar lo generado. |
| Pago de tarjeta con saldo al corte ("Statement $1,512.80") | `paymentDay`, sin corte | `BankAccount.statementDay` y `CardStatement { accountId, closingDate, dueDate, statementBalance, minimumPayment, paidAt }`. |
| Insight del asistente (descartar, actuar) | No existe | `Insight { organizationId, userId, kind, title, body, payload Json, status NEW \| DISMISSED \| ACTED, createdAt }`. |
| Notificaciones (campana con no leídas) | No existe | `Notification { userId, organizationId, kind, payload Json, readAt }`. |
| Avatares de miembros | `User.image` | Suficiente; se usa la inicial si falta. |

Se irán sumando al diseñar cada pantalla (planes a meses, etiquetas en el registro rápido,
conciliación de estados de cuenta, pagos parciales de deudas).
