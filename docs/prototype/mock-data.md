# Firecent · mock data

Un solo set para todas las pantallas. Extiende el comentario inicial de `home.html` sin cambiar
ninguna cifra ya aprobada. Los nombres de modelos y campos son los de `schema.prisma`; lo marcado
con `+` todavía no existe y está definido en `schema-gaps.md`.

## 0. Reglas

- **Montos en centavos** (`Int`), siempre positivos. El signo lo da `type`: `EXPENSE` resta,
  `INCOME` suma, `TRANSFER` resta en `accountId` y suma en `transferAccountId`.
  Excepción: `BankAccount.balance` es con signo; en tarjetas, negativo = se debe.
- **Formato**: `en-US`, `$1,234.56`. Negativo con `−` (U+2212), nunca guion. MXN se muestra
  `MX$38,500.00`. Estimado lleva `~` delante.
- **Hoy**: jueves 12 de noviembre de 2026. Mes de 30 días, día 12 → ritmo **40%**, quedan **18 días**.
- **Moneda base del Space**: USD. Tipo de cambio fijo en todo el mock: **18.47 MXN por USD**.
- **Quién mira**: Maya. Toda cifra agrega solo cuentas que Maya puede ver. Daniel tiene una cuenta
  privada que Maya no ve: nunca se dibuja ni se cuenta.
- Las transferencias y los pagos de tarjeta **no** cuentan como Money in ni Money out.

## 1. Usuarios y Spaces

| User | id | firstName / lastName | email | avatar |
| --- | --- | --- | --- | --- |
| Maya | `u_maya` | Maya / Torres | maya@example.com | inicial `M`, `bg-brand-purple` |
| Daniel | `u_daniel` | Daniel / Reyes | daniel@example.com | inicial `D`, `bg-brand-orange` |

| Space (`Organization`) | id | miembros | rol de Maya | moneda base | estado |
| --- | --- | --- | --- | --- | --- |
| Maya & Daniel | `sp_home` | Maya, Daniel | owner | USD | **activo**, con datos |
| Personal | `sp_personal` | Maya | owner | USD | vacío (es el estado *empty* de todas las pantallas) |
| Torres family | `sp_family` | Maya, Elena, Luis, Sofía | member | USD | solo aparece en el selector |

Invitación pendiente en `sp_home`: ninguna. Notificaciones de Maya: 2 sin leer.

| Notificación | kind | texto | leída |
| --- | --- | --- | --- |
| n1 | `CARD_DUE` | Sapphire Reserve payment due Sunday · $1,512.80 | no |
| n2 | `MEMBER_ACTIVITY` | Daniel added Costco · $211.36 | no |
| n3 | `BUDGET` | Your November plan is set | sí |

## 2. Cuentas (`BankAccount`)

| id | name | type | currency | visibility+ | userId | balance (¢) | muestra |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Joint Checking | CHECKING_ACCOUNT | USD | SHARED | u_daniel | 842055 | $8,420.55 |
| 2 | Emergency Fund | SAVINGS_ACCOUNT | USD | SHARED | u_maya | 2430000 | $24,300.00 |
| 3 | Sapphire Reserve | CREDIT_CARD | USD | SHARED | u_daniel | −184632 | −$1,846.32 |
| 4 | Maya's Checking | CHECKING_ACCOUNT | USD | PRIVATE | u_maya | 391218 | $3,912.18 |
| 5 | Cash | CASH | USD | PRIVATE | u_maya | 14000 | $140.00 |
| 6 | BBVA México | SAVINGS_ACCOUNT | MXN | PRIVATE | u_maya | 3850000 | MX$38,500.00 ≈ $2,084.46 |
| 7 | Amex Gold | CREDIT_CARD | USD | PRIVATE | u_maya | −61240 | −$612.40 |

`accountNumber` (últimos 4): 1 → 4821, 2 → 9034, 3 → 7719, 4 → 2260, 6 → 5512, 7 → 1008.

| Total | ¢ | muestra |
| --- | --- | --- |
| Shared (1+2+3) | 3087423 | $30,874.23 |
| Only you (4+5+6+7) | 552424 | $5,524.24 |
| **Balance** | 3639847 | **$36,398.47** |
| Activos (1,2,4,5,6) | 3885719 | $38,857.19 |
| Tarjetas (3,7) | −245872 | −$2,458.72 |

Saldos al 1 de noviembre (apertura) y movimiento del mes:

| Cuenta | 1 nov (¢) | entra | sale | hoy (¢) |
| --- | --- | --- | --- | --- |
| Joint Checking | 756542 | 315000 sueldo + 180000 transfer | 409487 gastos | 842055 |
| Emergency Fund | 2430000 | 0 | 0 | 2430000 |
| Sapphire Reserve | −172125 | 0 | 12507 cargos | −184632 |
| Maya's Checking | 314153 | 297500 sueldo | 30435 gastos + 190000 transfers | 391218 |
| Cash | 13000 | 10000 transfer | 9000 gastos | 14000 |
| BBVA México | MX$39,550.00 ($2,141.31 → 214131) | 0 | MX$1,050.00 ($56.85 → 5685) | 208446 |
| Amex Gold | −47140 | 0 | 14100 cargos | −61240 |
| **Total** | **3508561** | | | **3639847** (+131286) |

### Tarjetas de crédito

| | Sapphire Reserve (3) | Amex Gold (7) |
| --- | --- | --- |
| creditLimit | 1200000 | 800000 |
| Balance (se debe) | 184632 | 61240 |
| Available = límite − balance | 1015368 ($10,153.68) | 738760 ($7,387.60) |
| Utilización | 15.4% | 7.7% |
| statementDay+ (corte) | 21 | 3 |
| paymentDay (pago) | 15 | 28 |
| interestRate (APR) | 24.99 | 21.24 |
| displayCreditMode | CREDIT_BALANCE | CREDIT_BALANCE |
| Estado de cuenta abierto | corte 21 oct, vence **15 nov**: 151280 | corte 3 nov, vence **28 nov**: 26890 |
| · compras del periodo | 143781 | 14390 |
| · mensualidad de planes | 7499 | 12500 |
| · pago mínimo | 3500 | 3500 |
| Cargos desde el corte | 18354 (22–31 oct 5847 + nov 12507) | 9350 (4–12 nov) |
| Planes aún no facturados | 14998 | 25000 |
| Suma = balance | 151280 + 18354 + 14998 = 184632 | 26890 + 9350 + 25000 = 61240 |
| Se paga desde | Joint Checking | Maya's Checking |
| Próximo corte (proyección) | 21 nov: 18354 + 1549 Netflix + 7499 = 27402 | 3 dic: 9350 + 12500 = 21850 |

### Installment plans (`InstallmentPlan`+)

| id | cuenta | compra | fecha | total | plazo | mensualidad | interés | facturadas | restante |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ip1 | Sapphire Reserve | Dyson V15 · Best Buy | 10 jul 2026 | 44994 | 6 | 7499 | 0% | **4 of 6** | 14998, termina con el corte del 21 dic |
| ip2 | Amex Gold | Carry-on · Away | 20 oct 2026 | 37500 | 3 | 12500 | 0% | **1 of 3** | 25000, termina con el corte del 3 ene |

La compra completa es un `Record` EXPENSE en su fecha (categoría Household / Shopping). El plan solo
reparte cómo la factura la tarjeta.

## 3. Categorías (`Category`)

`spendingNature` en el enum → etiqueta: `DEBO` Owe, `NECESITO` Need, `QUIERO` Want.

| id | name | nature | icon (Lucide) | límite nov (¢)+ | gastado nov (¢) |
| --- | --- | --- | --- | --- | --- |
| 1 | Rent | DEBO | building-2 | 215000 | 215000 |
| 2 | Car loan | DEBO | car | 32000 | 32000 |
| 3 | Student loan | DEBO | graduation-cap | 38500 | 0 |
| 4 | Insurance | DEBO | shield | 19500 | 0 |
| 5 | Groceries | NECESITO | shopping-cart | 90000 | 70946 |
| 6 | Transport | NECESITO | bus | 30000 | 25020 |
| 7 | Phone & internet | NECESITO | wifi | 18000 | 17999 |
| 8 | Utilities | NECESITO | zap | 22000 | 5875 |
| 9 | Health | NECESITO | heart-pulse | 15000 | 8235 |
| 10 | Household | NECESITO | lamp | sin límite | 6490 |
| 11 | Pets | NECESITO | paw-print | sin límite | 6124 |
| 12 | Dining out | QUIERO | utensils | 45000 | 31369 |
| 13 | Entertainment | QUIERO | ticket | 25000 | 21209 |
| 14 | Subscriptions | QUIERO | tv | 8000 | 4047 |
| 15 | Shopping | QUIERO | shopping-bag | sin límite | 13115 |
| 16 | Fitness | QUIERO | dumbbell | sin límite | 12100 |
| 17 | Gifts | QUIERO | gift | sin límite | 11685 |
| 18 | Paycheck | (ingreso, null) | briefcase | | 612500 |
| 19 | Other income | (ingreso, null) | coins | | 0 |

Labels: `Trip: Lisbon` (BLUE), `Reimbursable` (GREEN), `Tax` (GRAY). Solo uno en uso: record 1038
lleva `Reimbursable`.

## 4. Plan de noviembre (`Budget`+)

`Budget { month: 2026-11-01, expectedIncome: 927500 }` (Daniel 315000 × 2 + Maya 297500 × 1).

| Bolsa | plan (¢) | gastado (¢) | % | queda (¢) | límites asignados | sin asignar |
| --- | --- | --- | --- | --- | --- | --- |
| Owe | 330000 | 247000 | 74.8 | 83000 | 305000 | 25000 |
| Need | 240000 | 140689 | 58.6 | 99311 | 175000 | 65000 |
| Want | 170000 | 93525 | 55.0 | 76475 | 78000 | 92000 |
| **Total** | **740000** | **481214** | 65.0 | **258786** | | |

- Left to spend $2,587.86 → **$143.77 a day for 18 days**.
- Ingreso esperado 927500 − plan 740000 = **187500 sin planear** ($1,875.00).
- Promedio de gasto jun–oct: 850588 ($8,505.88). El plan es 110588 menor ($1,105.88).
- Es el primer mes con plan (creado el 1 nov).

Estado de cada límite (ritmo 40%; `Above pace` = más de 55% gastado):

| Categoría | gastado / límite | % | queda | por día | estado |
| --- | --- | --- | --- | --- | --- |
| Rent | 215000 / 215000 | 100 | 0 | | Paid |
| Car loan | 32000 / 32000 | 100 | 0 | | Paid |
| Student loan | 0 / 38500 | 0 | 38500 | | Due Nov 20 |
| Insurance | 0 / 19500 | 0 | 19500 | | Due Nov 22 and 24 |
| Groceries | 70946 / 90000 | 78.8 | 19054 | 1059 | Above pace |
| Transport | 25020 / 30000 | 83.4 | 4980 | 277 | Above pace |
| Phone & internet | 17999 / 18000 | 100 | 1 | | Paid |
| Utilities | 5875 / 22000 | 26.7 | 16125 | 896 | On pace |
| Health | 8235 / 15000 | 54.9 | 6765 | 376 | On pace |
| Dining out | 31369 / 45000 | 69.7 | 13631 | 757 | Above pace |
| Entertainment | 21209 / 25000 | 84.8 | 3791 | 211 | Above pace |
| Subscriptions | 4047 / 8000 | 50.6 | 3953 | | On pace (Netflix pending) |

Alcance (filtro *Everything / Shared / Only you*) de noviembre:

| | Everything | Shared | Only you |
| --- | --- | --- | --- |
| Money in | 612500 | 315000 | 297500 |
| Money out | 481214 | 421994 | 59220 |
| Net (in − out) | +131286 | −106994 | +238280 |
| Transferencia entre alcances | 0 | +180000 | −180000 |
| Cambio de saldo | +131286 | +73006 | +58280 |

## 5. Movimientos de noviembre (`Record`), 44 en total

Orden de la lista: más reciente primero. `¢` es `amount`. Cuenta: JC Joint Checking, SR Sapphire
Reserve, MC Maya's Checking, CA Cash, BB BBVA México, AG Amex Gold. `by` = `createdBy`
(M Maya, D Daniel, R generado por un recurrente).

| id | fecha | payee | category | type | ¢ | cta | by | nota |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1044 | 12 | DoorDash | Dining out | EXPENSE | 4124 | JC | M | |
| 1043 | 12 | McNally Jackson | Shopping | EXPENSE | 2531 | AG | M | |
| 1042 | 12 | Union Sq Greenmarket | Groceries | EXPENSE | 3800 | CA | M | |
| 1041 | 11 | Ticketmaster | Entertainment | EXPENSE | 14260 | JC | M | note "Bleachers, 2 tickets" |
| 1040 | 11 | Blue Bottle | Dining out | EXPENSE | 675 | AG | M | |
| 1039 | 11 | Costco | Groceries | EXPENSE | 21136 | JC | D | |
| 1038 | 11 | Target | Household | EXPENSE | 6490 | JC | D | label Reimbursable |
| 1037 | 10 | Paper Source | Gifts | EXPENSE | 6000 | MC | M | |
| 1036 | 10 | Kindle | Entertainment | EXPENSE | 1299 | AG | M | |
| 1035 | 10 | iCloud+ | Subscriptions | EXPENSE | 299 | SR | R | |
| 1034 | 10 | National Grid | Utilities | EXPENSE | 5875 | JC | R | manual, estimado era ~5800 |
| 1033 | 10 | Trader Joe's | Groceries | EXPENSE | 9362 | JC | M | |
| 1032 | 9 | Liverpool | Gifts | EXPENSE | 105000 MXN | BB | M | `refCurrencyAmount` 5685 |
| 1031 | 9 | Joe's Pizza | Dining out | EXPENSE | 2875 | JC | D | |
| 1030 | 9 | Sweetgreen | Dining out | EXPENSE | 1645 | AG | M | |
| 1029 | 9 | Chewy | Pets | EXPENSE | 6124 | JC | M | |
| 1028 | 9 | Dr. Patel | Health | EXPENSE | 4000 | JC | M | note "Copay" |
| 1027 | 8 | Amazon | Shopping | EXPENSE | 6784 | JC | D | |
| 1026 | 8 | Max | Subscriptions | EXPENSE | 1849 | SR | R | |
| 1025 | 8 | Shell | Transport | EXPENSE | 4820 | JC | D | |
| 1024 | 7 | Street fair | Entertainment | EXPENSE | 2200 | CA | M | |
| 1023 | 7 | Via Carota | Dining out | EXPENSE | 8460 | SR | M | |
| 1022 | 7 | Whole Foods | Groceries | EXPENSE | 15288 | JC | M | |
| 1021 | 6 | AMC Theatres | Entertainment | EXPENSE | 3450 | JC | M | |
| 1020 | 6 | Barry's | Fitness | EXPENSE | 3200 | AG | M | |
| 1019 | 6 | CVS Pharmacy | Health | EXPENSE | 4235 | MC | M | |
| 1018 | 6 | (transfer) | | TRANSFER | 180000 | MC → JC | R | "Maya's share" |
| 1017 | 6 | Lumen Labs | Paycheck | INCOME | 297500 | MC | R | "Maya's paycheck" |
| 1016 | 5 | The Dead Rabbit | Dining out | EXPENSE | 3000 | CA | M | |
| 1015 | 5 | Spotify | Subscriptions | EXPENSE | 1899 | SR | R | subió de 1699 |
| 1014 | 5 | Spectrum | Phone & internet | EXPENSE | 6999 | JC | R | |
| 1013 | 5 | Toyota Financial | Car loan | EXPENSE | 32000 | JC | R | ligado a la deuda d1 |
| 1012 | 4 | (transfer) | | TRANSFER | 10000 | MC → CA | M | "ATM" |
| 1011 | 4 | Chelsea Piers Fitness | Fitness | EXPENSE | 8900 | JC | R | |
| 1010 | 4 | Trader Joe's | Groceries | EXPENSE | 8617 | JC | M | |
| 1009 | 3 | Glossier | Shopping | EXPENSE | 3800 | AG | M | |
| 1008 | 3 | Metro-North | Transport | EXPENSE | 16800 | MC | M | note "Monthly pass" |
| 1007 | 3 | MTA OMNY | Transport | EXPENSE | 3400 | MC | M | |
| 1006 | 2 | Lucali | Dining out | EXPENSE | 9640 | JC | D | |
| 1005 | 2 | Verizon | Phone & internet | EXPENSE | 11000 | JC | R | |
| 1004 | 2 | Northwind Design | Paycheck | INCOME | 315000 | JC | R | "Daniel's paycheck" |
| 1003 | 1 | Blue Bottle | Dining out | EXPENSE | 950 | AG | M | |
| 1002 | 1 | Whole Foods | Groceries | EXPENSE | 12743 | JC | M | |
| 1001 | 1 | Parkside Apartments | Rent | EXPENSE | 215000 | JC | R | |

Encabezados de día (neto del día en USD, las transferencias no cuentan) y saldo total al cierre:

| día | encabezado | neto (¢) | Balance al cierre (¢) |
| --- | --- | --- | --- |
| 12 | Today | −10455 | 3639847 |
| 11 | Yesterday | −42561 | 3650302 |
| 10 | Tue, Nov 10 | −22835 | 3692863 |
| 9 | Mon, Nov 9 | −20329 | 3715698 |
| 8 | Sun, Nov 8 | −13453 | 3736027 |
| 7 | Sat, Nov 7 | −25948 | 3749480 |
| 6 | Fri, Nov 6 | +286615 | 3775428 |
| 5 | Thu, Nov 5 | −43898 | 3488813 |
| 4 | Wed, Nov 4 | −17517 | 3532711 |
| 3 | Tue, Nov 3 | −24000 | 3550228 |
| 2 | Mon, Nov 2 | +294360 | 3574228 |
| 1 | Sun, Nov 1 | −228693 | 3279868 |

Resultados de búsqueda y filtros que la UI debe poder mostrar con estos datos:

- Buscar `whole` → 1022, 1002 (2 resultados, $280.31).
- Filtro Account = Sapphire Reserve → 1035, 1026, 1023, 1015 (4, $125.07).
- Filtro Want → 22 movimientos, $935.25. Need → 16, $1,406.89. Owe → 2, $2,470.00.
- Filtro Only you → 15 gastos, $592.20, más 1017 y las dos transferencias.
- Filtro Added by Daniel → 1039, 1038, 1031, 1027, 1025, 1006 (6, $517.45).

Frecuentes para el alta rápida (fila *Repeat*), en este orden: Blue Bottle $6.75 · Dining out · Amex
Gold; Trader Joe's · Groceries · Joint Checking (sin monto); MTA OMNY $34.00 · Transport · Maya's Checking.

## 6. Recurrentes (`Recurring`+)

| id | name | ¢ | cuándo | cuenta | modo | categoría | próxima | estado nov |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rc1 | Rent · Parkside Apartments | 215000 | mensual, día 1 | JC | AUTO | Rent | Dec 1 | pagado (1001) |
| rc2 | Verizon | 11000 | mensual, día 2 | JC | AUTO | Phone & internet | Dec 2 | pagado |
| rc3 | Chelsea Piers Fitness | 8900 | mensual, día 4 | JC | AUTO | Fitness | Dec 4 | pagado |
| rc4 | Car loan · Toyota Financial | 32000 | mensual, día 5 | JC | AUTO | Car loan | Dec 5 | pagado |
| rc5 | Spectrum | 6999 | mensual, día 5 | JC | AUTO | Phone & internet | Dec 5 | pagado |
| rc6 | Spotify Duo | 1899 | mensual, día 5 | SR | AUTO | Subscriptions | Dec 5 | pagado |
| rc7 | Max | 1849 | mensual, día 8 | SR | AUTO | Subscriptions | Dec 8 | pagado |
| rc8 | iCloud+ | 299 | mensual, día 10 | SR | AUTO | Subscriptions | Dec 10 | pagado |
| rc9 | National Grid | ~5800 | mensual, día 10 | JC | MANUAL | Utilities | Dec 10 | confirmado en 5875 |
| rc10 | Netflix | 1549 | mensual, día 14 | SR | AUTO | Subscriptions | **Nov 14** | pendiente |
| rc11 | Con Edison | ~9400 | mensual, día 18 | JC | MANUAL | Utilities | **Nov 18** | pendiente |
| rc12 | Student loan · Nelnet | 38500 | mensual, día 20 | MC | AUTO | Student loan | Nov 20 | pendiente |
| rc13 | Geico | 14800 | mensual, día 22 | JC | AUTO | Insurance | Nov 22 | pendiente |
| rc14 | Lemonade Renters | 4700 | mensual, día 24 | JC | AUTO | Insurance | Nov 24 | pendiente |
| rc15 | Daniel's paycheck | +315000 | días 2 y 16 | JC | ingreso | Paycheck | **Nov 16** | 1 de 2 recibido |
| rc16 | Maya's paycheck | +297500 | mensual, día 6 | MC | ingreso | Paycheck | Dec 6 | recibido |
| rc17 | Maya's share | 180000 | mensual, día 6 | MC → JC | AUTO | (transfer) | Dec 6 | hecho |
| rc18 | Emergency Fund top-up | 75000 | mensual, día 20 | JC → EF | AUTO | (transfer) | Nov 20 | pendiente |

- Con Edison, últimos tres: 8812 (ago), 10140 (sep), 9247 (oct) → promedio 9400.
- Cambios de precio en 2026: Netflix 1299 → 1549 (ene), Max 1549 → 1849 (jun), Spotify Duo
  1699 → 1899 (nov). Suma **+750 al mes**, +9000 al año.
- Pagos recurrentes (rc1–rc14): **352695 al mes** ($3,526.95) en 14 pagos. Pagado en noviembre:
  283821. Falta: 68949 (Netflix 1549 + Con Edison ~9400 + Nelnet 38500 + Geico 14800 + Lemonade 4700).
- Suscripciones (rc6, rc7, rc8, rc10): 5596 al mes.
- Ingreso recurrente: 927500 al mes.

Coming up (próximos 7 días, 13–19 nov), tal como está en Home:

| fecha | fila | monto | segunda línea | marca |
| --- | --- | --- | --- | --- |
| Sat 14 | Netflix | $15.49 | On Sapphire Reserve | Auto |
| Sun 15 | Pay Sapphire Reserve | $1,512.80 | From Joint Checking | Due in 3 days |
| Mon 16 | Daniel's paycheck | +$3,150.00 | Into Joint Checking | Expected |
| Wed 18 | Con Edison | ~$94.00 | You confirm the amount | Manual |

To pay in the next 7 days: **$1,622.29**. Resto del mes: Fri 20 Student loan · Nelnet $385.00 (Auto),
Fri 20 Emergency Fund top-up $750.00 (Transfer), Sun 22 Geico $148.00 (Auto), Tue 24 Lemonade
Renters $47.00 (Auto), Sat 28 Pay Amex Gold $268.90 (Due in 16 days).
Los pagos de tarjeta salen de `CardStatement`+, no de `Recurring`+.

## 7. Deudas (`Debt`)

| id | type | name | amount | remainingAmount | creationDate | payBackDate | cuenta | visibilidad+ | nota |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| d1 | ME_TO_ANYONE | Toyota Financial | 1840000 | 1120000 | 5 oct 2024 | 5 oct 2029 | JC | SHARED | Car loan. $320.00 al mes, 35 pagos restantes |
| d2 | ME_TO_ANYONE | Nelnet | 2400000 | 808500 | 20 ago 2021 | 20 jul 2028 | MC | PRIVATE | Student loan. $385.00 al mes, 21 pagos |
| d3 | ME_TO_ANYONE | Elena Torres | 150000 | 60000 | 2 may 2026 | 28 feb 2027 | MC | PRIVATE | Moving costs. Sin calendario fijo |
| d4 | ANYONE_TO_ME | Leo Reyes | 60000 | 35000 | 15 ago 2026 | 15 dic 2026 | JC | SHARED | Lent for car repair |
| d5 | ANYONE_TO_ME | Sofía Torres | 7130 | 7130 | 11 nov 2026 | 30 nov 2026 | JC | SHARED | Her concert ticket (mitad de 1041) |

- **You owe**: 1988500 ($19,885.00) en 3. **Owed to you**: 42130 ($421.30) en 2.
- Pagado: d1 39.1% (720000 de 1840000), d2 66.3%, d3 60.0%, d4 41.7% (25000 de 60000), d5 0%.
- Historial de d4: 10000 el 12 sep, 15000 el 20 oct. Historial de d3: 30000 el 1 jul, 30000 el 1 sep, 30000 el 1 oct.
- Las deudas **no** entran en el Balance de Home (ver SPEC, Debts).

## 8. Historia para Analytics

Balance al inicio de cada mes (¢): jun 3124000, jul 3158420, ago 3290275, sep 3331240, oct 3461893,
nov 3508561, hoy 3639847.

| Mes | Money in | Money out | Net | Owe | Need | Want |
| --- | --- | --- | --- | --- | --- | --- |
| Jun | 927500 | 893080 | +34420 | 325500 | 279035 | 288545 |
| Jul | 927500 | 795645 | +131855 | 325500 | 251220 | 218925 |
| Aug | 927500 | 886535 | +40965 | 325500 | 263490 | 297545 |
| Sep | 927500 | 796847 | +130653 | 329700 | 258832 | 208315 |
| Oct | 927500 | 880832 | +46668 | 329700 | 284617 | 266515 |
| Nov (al día 12) | 612500 | 481214 | +131286 | 247000 | 140689 | 93525 |

- Reparto de noviembre: Owe 51%, Need 29%, Want 20% (redondeo por resto mayor).
- Tasa de ahorro de noviembre al día: 21.4%.
- Mismo punto del mes pasado (1–12 oct): 465530 = Owe 247000 + Need 131840 + Want 86690.
  Noviembre va **+15684 (+3.4%)**.

| Categoría | nov 1–12 | oct 1–12 | cambio |
| --- | --- | --- | --- |
| Groceries | 70946 | 59820 | +11126 (+18.6%) |
| Dining out | 31369 | 26840 | +4529 (+16.9%) |
| Transport | 25020 | 24410 | +610 (+2.5%) |
| Entertainment | 21209 | 9600 | +11609 (+120.9%) |
| Phone & internet | 17999 | 17999 | 0 |
| Shopping | 13115 | 20375 | −7260 (−35.6%) |

Comercios de noviembre: Parkside Apartments 215000 (1), Toyota Financial 32000 (1), Whole Foods
28031 (2), Costco 21136 (1), Trader Joe's 17979 (2), Metro-North 16800 (1).

Serie de la línea de balance (24 puntos de jun 1 a hoy, dólares enteros). Sustituye las tres
últimas posiciones del arreglo de `home.html` para que coincida con el 1 de noviembre:

```
31240, 31010, 31620, 31890, 31450, 32080, 32410, 32150, 32760, 33020, 32690, 33340,
33610, 33280, 33950, 34320, 34010, 34590, 34880, 34610, 35086, 35190, 34888, 36398
```

## 9. Asistente

Insights (`Insight`+) de Maya en `sp_home`:

| id | status | título | cuerpo | acción principal |
| --- | --- | --- | --- | --- |
| in1 | NEW (el de Home) | Spotify went up $2.00 this month | Duo is now $18.99. It is the third subscription to raise its price this year, after Netflix and Max. Together they cost you $7.50 more each month. | Review subscriptions |
| in2 | NEW | Groceries is running above pace | $709.46 of $900.00 spent with 18 days left. At $10.59 a day you stay inside the limit. | See Groceries |
| in3 | NEW | Chewy looks like a monthly payment | Orders on Sep 9, Oct 9 and Nov 9, between $58 and $64. | Add as recurring |
| in4 | ACTED | Your plan is $1,105.88 below your average | You spent $8,505.88 a month from June to October. | See the plan |

Hilos (`AssistantThread`+): "Subscriptions that went up" (hoy), "November so far" (Nov 9), "Amex
statement import" (Nov 4).

Hilo abierto, "Subscriptions that went up":

1. **Maya**: Which subscriptions went up this year?
2. **Assistant**: Three of them. Together they cost you **$7.50 more a month**, or $90.00 a year.

   | | Was | Now | Since |
   | --- | --- | --- | --- |
   | Netflix | $12.99 | $15.49 | Jan |
   | Max | $15.49 | $18.49 | Jun |
   | Spotify Duo | $16.99 | $18.99 | Nov |

   Fuente (chip): `Based on 31 transactions · Jan 1 to Nov 12`.
   Sugerencias: `Show all subscriptions` · `What else repeats?`
3. **Maya**: What else repeats?
4. **Assistant**: Chewy does. You ordered on Sep 9, Oct 9 and Nov 9, between $58 and $64. It is not
   in Recurring yet, so it does not show in Coming up.
   **Propuesta** (`AssistantProposal`+, status `PENDING`):
   - Encabezado: `Add a recurring payment`
   - Filas: Name `Chewy` · Amount `~$61.24` · When `Monthly on the 9th` · From `Joint Checking` ·
     Category `Pets · Need` · Mode `Manual, you confirm the amount`
   - Botones: `Approve` · `Edit` · `Dismiss`
   - Pie: `Nothing changes until you approve.`

Propuesta ya aprobada (en el hilo "November so far"): `Set a limit` · Subscriptions `$80.00 a month`
· `Approved by you · Nov 9` · `Undo`.

Preguntas sugeridas con el chat vacío: `How are we doing this month?` · `What changed since October?`
· `Find subscriptions I could cut` · `Import a statement`.
