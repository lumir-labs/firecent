# Fase 3 · Home

> Estado: ⏳ lista para ejecutar (3B espera la decisión H1) · Depende de: Fases 1 y 2 · Lee antes: [README](README.md)

## Objetivo

Que en diez segundos el usuario sepa **cuánto tiene, cómo va el mes y qué viene**. Reemplaza el
Home actual (`NetWorthCard` sola) por el diseño de `docs/prototype/home.html`, en mobile y desktop,
con datos reales.

## Referencias

- `docs/prototype/home.html`: **es la referencia visual** (la versión de Gemini). Abre con
  `?state=data|empty|loading|error` y `?theme=dark`. El comentario al inicio trae las cifras del mock.
- `docs/prototype/SPEC.md` §5.1. **Ojo:** `home.html` se apartó de §5.1 (ver H1). Donde difieran,
  manda la decisión H1.
- Código actual: `apps/web/app/[locale]/(protected)/(home)/page.tsx`, `_components/net-worth-card.tsx`,
  `_components/dashboard/`, `packages/api/src/routers/dashboard.ts` (`netWorth` ya calcula balance,
  cambio del mes, in/out y tiene `scope: "me" | "household"`).

## Decisión pendiente del usuario

**H1 · Qué bloques lleva el Home.** El `home.html` de Gemini tiene siete bloques, más de lo que pide
el principio "máximo 4–5 bloques" del brief:

| # | Bloque en `home.html` | Datos disponibles en Fase 3 |
| --- | --- | --- |
| 1 | Balance (tarjeta oscura `hero` con alcance y línea de 6 meses) | ✅ (alcance en Fase 4) |
| 2 | `November category limits` (barra apilada + 5 límites) | ⚠️ Los límites son de Budget (Fase 5) |
| 3 | `Needs your attention` | ⚠️ Mezcla avisos de recurrentes y tarjetas |
| 4 | `Accounts` (mezcla de cuentas en barra) | ✅ |
| 5 | `Recent activity` | ✅ |
| 6 | `Coming up` | ⚠️ Solo pagos de tarjeta hasta la Fase 6 |
| 7 | Insight del asistente | ❌ Fase 8 |

Recomendación (aplicar si el usuario no dice otra cosa):

- **Mobile, 4 bloques:** Balance → This month → Coming up → Insight.
  `Needs your attention` se funde con Coming up (lo vencido o por confirmar sube arriba con
  `text-warning`). `Accounts` sale del Home porque el split del Balance ya lleva a Accounts.
  `Recent activity` sale porque está a un toque en el tab Transactions.
- **Desktop (hay espacio):** los mismos 4 + `Recent activity` en la columna derecha.
- **This month** antes de la Fase 5: `StatPair` Money in / Money out + barra de gasto por
  Owe / Need / Want (sin plan) + enlace `Set a plan` (lleva a `/budget`). Cuando exista Budget, se
  convierte en los límites de `home.html`.

---

## Tareas

| ID | Tarea | Depende de | Modelo | Estado |
| --- | --- | --- | --- | --- |
| 3A | API del Home | Fase 2 | **Sonnet** | ⏳ |
| 3B | Pantalla Home (mobile y desktop) | 3A y H1 | **Opus** | ⏳ |

## 3A · API del Home

**Archivos:** `packages/api/src/routers/dashboard.ts` (y su prueba).

Procedimiento nuevo `dashboard.home({ month })`, en una sola llamada:

| Campo | Cálculo |
| --- | --- |
| `balance` | El de `netWorth` (`scope: "household"`), por moneda: `primary` + `others` |
| `change` | Cambio del mes del balance principal |
| `trend` | Saldo al día 1 de cada uno de los últimos 6 meses y hoy (7 puntos) con agregación SQL por mes. Sin modelo `BalanceSnapshot` mientras sea rápido (menos de 200 ms con el seed demo); si no, documentarlo como pendiente |
| `split` | `null` hasta la Fase 4. Luego `{ shared, onlyYou }` |
| `month` | `in`, `out` (sin transferencias ni pagos de tarjeta), `byNature: { DEBO, NECESITO, QUIERO }` usando la nature efectiva (`record.spendingNature ?? category.spendingNature`), `pace` (día del mes / días del mes), `daysLeft` |
| `upcoming` | Próximos 7 días. En esta fase solo pagos de tarjeta: por cada `CREDIT_CARD` con `paymentDay`, su próxima fecha y la deuda actual como monto (`mode: "due"`, `dueInDays`). Recurrentes llegan en la Fase 6 |
| `recent` | Últimos 5 movimientos (misma forma que `records.list`) |
| `insight` | `null` hasta la Fase 8 |
| `isEmpty` | `true` si el Space no tiene cuentas |

`netWorth` se mantiene mientras algo lo use; si al terminar 3B nada lo usa, se elimina junto con
`net-worth-card.tsx`.

**Aceptación:** prueba con el seed demo: balance, in/out y byNature cuadran con el comentario de
`home.html` (salvo la cuenta privada de Daniel hasta la Fase 4; anotar la diferencia).

## 3B · Pantalla Home

**Archivos:** `apps/web/app/[locale]/(protected)/(home)/page.tsx` y `(home)/_components/home/`
(nuevo). Se borran `net-worth-card.tsx` y `_components/dashboard/` si quedan sin uso.

Con los bloques de H1 y solo componentes de `components/finance/` (si falta uno, se agrega allí):

| Bloque | Componentes |
| --- | --- |
| Cabecera mobile | La del shell (selector de Space + campana). Desktop: saludo `Good afternoon, Maya` (24 px) + fecha y Space en 13 px gris, `Ask assistant`, campana, `Add transaction` |
| Balance | Tarjeta `bg-hero text-hero-foreground` de `home.html`: rótulo, `Money size="hero"`, `ChangeLine`, `Sparkline` (desktop: `h-[180px]`, marcas `Jun … Nov` y regla al pasar el cursor) y `SplitBar` solo si `split` no es `null`. Las variables `--hero*` ya existen desde 1A |
| This month | `StatPair` + barra de natures (`NatureSwatch` y leyenda con `PaceLegend`) + `SectionHeader` con `Set a plan` o `Budget` |
| Coming up | `SectionHeader` (`See all` oculto hasta la Fase 6) + `Card variant="plain"` con `UpcomingRow`. Sin filas: `Nothing due in the next 7 days.` (14 px gris dentro de la tarjeta) |
| Insight | `AssistantCard`, oculto mientras `insight` sea `null` |
| Recent (desktop) | `SectionHeader` `Recent activity` + `All transactions` → `/transactions`, y 5 `TransactionRow` |

Rejilla desktop de 12 columnas como §5.1 (Balance 1–7, This month 8–12, Coming up 1–7, Insight y
Recent 8–12). Enlaces: el split lleva a `/accounts`, una fila de tarjeta a `/accounts/<id>`, `Budget`
a `/budget`.

**Estados** (todos con la cabecera visible):

- Vacío (`isEmpty`): Balance `$0.00` en gris y `StepList` `Three steps to a full picture` (agregar
  una cuenta → registrar un movimiento → hacer un plan), con el paso activo según lo que ya exista.
  Es el principio del onboarding: cada paso abre su hoja.
- Carga: esqueletos con la forma final (mobile en una columna, desktop en dos).
- Error: `StateBlock kind="error"`.

**Aceptación:** comparado con `home.html` a 390 y 1440 px, claro y oscuro, en los cuatro estados
(el vacío con el Space `Personal` del seed). Sin más de 4 bloques en mobile salvo que H1 diga otra
cosa. Lighthouse de accesibilidad de 95 o más.

---

## BUILD-QUESTIONS que cierra esta fase

#9–#12. Al cerrar, marca cada una con la decisión final en `docs/prototype/BUILD-QUESTIONS.md`.

## Carpintería (Haiku)

| ID | Tarea | Después de |
| --- | --- | --- |
| 3H1 | Borrar `net-worth-card.tsx`, `_components/dashboard/` y `dashboard.netWorth` si ya nada los importa (verificar con búsqueda), y sus llaves i18n huérfanas | 3B |
| 3H2 | Llaves `es` del Home; `check:i18n` en verde | 3B |
| 3H3 | Marcar BUILD-QUESTIONS #9–#12 y actualizar estado y registro | cierre de la fase |

## Cambios al prototipo

(Anota aquí cada mejora de diseño hecha en esta fase y repítela en `docs/prototype/SPEC.md`.)

## Registro

| Tarea | Fecha | Quién | Hecho | Archivos | Desvíos y pendientes |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
