# Firecent · Roadmap de UI

> Creado: 2026-11-12 · Última actualización: 2026-11-12
> Este folder es la **memoria del proyecto** para construir la UI. Cualquier agente que retome el
> trabajo en un chat nuevo empieza aquí y no necesita nada de conversaciones anteriores.

## Qué es esto

Firecent es un SaaS de finanzas personales (web + app) que se va a vender y compite con Copilot
Money, Monarch, YNAB y Revolut. Este repo es un boilerplate (StackGoat) ya funcionando: auth,
permisos, admin, i18n, tRPC, MCP. Sobre él se construye la UI de Firecent tomando como referencia
visual el prototipo HTML que está en [`docs/prototype/`](../prototype/).

| Documento | Para qué |
| --- | --- |
| Este README | Estado, decisiones, reglas y protocolo de trabajo con agentes |
| [`phase-1-foundations.md`](phase-1-foundations.md) | Fase 1, lista para ejecutar |
| [`phase-2-accounts-transactions.md`](phase-2-accounts-transactions.md) | Fase 2, lista para ejecutar |
| [`phase-3-home.md`](phase-3-home.md) | Fase 3, lista para ejecutar |
| `phase-N-*.md` (4 en adelante) | Se escriben al cerrar la fase anterior (ver "Siguientes fases") |
| [`../prototype/SPEC.md`](../prototype/SPEC.md) | Especificación visual: tokens, componentes E1–E20 y N1–N26, pantallas §5 |
| [`../prototype/mock-data.md`](../prototype/mock-data.md) | Datos de demo coherentes (Maya y Daniel) |
| [`../prototype/schema-gaps.md`](../prototype/schema-gaps.md) | Cambios de schema propuestos (ver correcciones abajo) |
| [`../prototype/BUILD-QUESTIONS.md`](../prototype/BUILD-QUESTIONS.md) | Dudas del prototipo; cada fase cierra las suyas |
| [`../COMPONENTS.md`](../COMPONENTS.md), [`../CONVENTIONS.md`](../CONVENTIONS.md), [`../TRPC.md`](../TRPC.md) | Reglas del boilerplate. Obligatorias |

Para ver el prototipo: abre `docs/prototype/index.html` en el navegador (funciona desde disco).
Cada pantalla abre sola con parámetros, por ejemplo `transactions.html?theme=dark&state=empty`.

---

## Estado

| Fase | Entrega | Estado | Doc |
| --- | --- | --- | --- |
| 0 | Decisiones bloqueantes | ✅ Cerrada (ver tabla de decisiones) | este README |
| 1 | Tokens, componentes de marca, app shell, seed de demo | ⏳ Lista para ejecutar | [phase-1](phase-1-foundations.md) |
| 2 | Accounts, Transactions, alta rápida | ⏳ Lista (depende de 1) | [phase-2](phase-2-accounts-transactions.md) |
| 3 | Home | ⏳ Lista (depende de 1 y 2; 3B espera la decisión H1) | [phase-3](phase-3-home.md) |
| 4 | Spaces y privacidad | 📝 Resumen abajo | — |
| 5 | Budget | 📝 Resumen abajo | — |
| 6 | Recurring y Notifications | 📝 Resumen abajo | — |
| 7 | Tarjetas e Installment plans | 📝 Resumen abajo | — |
| 8 | Debts, Analytics, Assistant | 📝 Resumen abajo | — |
| 9 | App nativa (Expo) | 📝 Resumen abajo | — |
| 10 | Onboarding, Settings, pulido | 📝 Resumen abajo | — |

Leyenda: ⏳ lista para ejecutar · 🚧 en curso · ✅ hecha · 📝 solo resumen, falta detallar.
**Quien termine una tarea actualiza esta tabla y el registro de su fase.**

---

## Decisiones tomadas (no volver a preguntar)

| # | Tema | Decisión | Consecuencia |
| --- | --- | --- | --- |
| D1 | Signo de `Record.amount` | **Con signo**, como ya hace el repo: gasto y salida de transferencia negativos; ingreso y entrada positivos. | `schema-gaps` I-14 y `mock-data §0` ("siempre positivos") **no aplican**. El seed convierte. |
| D2 | Dueño de una cuenta | Una cuenta tiene **un solo dueño** (`BankAccount.userId`). El dueño puede compartirla con el Space; nadie más la edita. El índice `@@unique([organizationId, name])` **no cambia**. | `schema-gaps` I-12 queda rechazado. Si un nombre choca, la API responde `That name is taken in this space.` sin decir de quién es. |
| D3 | Idioma | Inglés es la fuente (copy del prototipo). Cada pantalla trae su `es` en la misma tarea. | `check:i18n` en verde siempre. |
| D4 | Prototipo | Vive en `docs/prototype/` (copia del de Gemini). El `fable/` de la raíz es un diseño descartado: **no usarlo**. | Las mejoras de diseño se anotan en `docs/prototype/SPEC.md`. |
| D5 | Ancho 768–1023 px | Layout mobile centrado a `max-w-[560px]` con tab bar. Sidebar desde `lg` (1024 px). | Cierra BUILD-QUESTIONS #4. |
| D6 | Transferencias | Se quedan como hoy: **dos** `Record` (salida y entrada) ligados por `transferGroupId`. | `schema-gaps` I-13 no aplica. Las listas muestran **una** fila por transferencia (la de salida, o la de entrada si la salida no es visible). |
| D7 | Balance de una cuenta | Suma de sus `Record` (regla actual de `dashboard.ts`). `BankAccount.balance` no es fuente de verdad. | `openingBalance` de `schema-gaps` I-9 **no se agrega**: el saldo inicial es un `Record` INCOME con nota `Opening balance`. |
| D8 | Unidades en la API | La DB guarda centavos; los routers devuelven **unidades mayores** (`amount / 100`), como `records.list`. La UI nunca divide entre 100. | Un solo lugar convierte: el router. |
| D9 | Nombres en la UI | `Organization` = **Space**. `DEBO/NECESITO/QUIERO` = **Owe / Need / Want** (siempre en ese orden). MSI = **Installment plans**. `BankAccount` = **Account**. | Los enums y tablas no cambian. |
| D10 | Schema | Solo crece: campos y modelos nuevos opcionales o con default. Nunca borrar ni renombrar (`Envelope` se queda en DB y se oculta en la UI). Una migración por fase. | Ver `docs/prototype/schema-gaps.md`, aplicando D1, D2, D6 y D7. |

---

## Reglas de construcción (todas las fases)

1. **Componentes reutilizables primero.** Antes de escribir JSX de una pantalla, busca en este orden:
   `apps/web/components/finance/` (los de Firecent) → `components/ui/` (shadcn) →
   `components/base/` y `components/common/`. Si existe algo parecido, **mejóralo** (variante nueva,
   prop nueva) en lugar de duplicarlo. Ninguno está escrito en piedra, pero un cambio en `ui/` no
   puede romper las pantallas de admin: agrega variantes, no cambies los defaults.
2. **Una pantalla no define estilos sueltos.** Si una combinación de clases se repite dos veces, es
   un componente en `components/finance/`. Las clases de cada componente salen de `SPEC.md §3`.
3. **Tokens, no hexadecimales.** Colores solo por utilidades (`bg-card`, `text-positive`,
   `bg-nature-need`…). El único hex permitido es el velo de hojas.
4. **Cuatro estados por pantalla**: datos, vacío, carga (skeleton con la forma final) y error. Claro
   y oscuro. Ver `SPEC.md §4.1`.
5. **Mobile-first.** Se construye a 390 px y luego se adapta con `lg:` a 1440 px.
6. **Server components por defecto**; `"use client"` solo en hojas interactivas. Datos vía tRPC
   (`packages/api`), con `requirePermission(p.dashboard.basic)` y siempre filtrado por `ctx.orgId`.
7. **i18n** en `packages/lib/src/messages/{en,es}.json`, mismas llaves en ambos.
8. **Montos** solo con el componente `<Money>` (Fase 1). Nunca formatear a mano.
9. **Accesibilidad**: objetivos táctiles de 44 px, `aria-label` en botones de ícono, barras con
   `role="progressbar"`, gráficas con `role="img"` y `View as table`.
10. **Mejorar el prototipo está permitido** (es una referencia, no un contrato), pero cada cambio de
    diseño se anota en la sección "Cambios al prototipo" del doc de la fase **y** en `SPEC.md`.

### Definition of done de una tarea

- `bun run typecheck` y `bun run lint` en verde (o el `--filter` del workspace tocado).
- `bun run --cwd apps/web check:i18n` en verde si se tocaron mensajes.
- `node scripts/check-tokens.mjs` en verde si se tocó `tokens.css`.
- Si cambió schema, rutas o API: `bun run docs:gen` y commit de `docs/ARCHITECTURE.md`.
- Revisión visual hecha (ver "Cómo verificar en el navegador") o, si el agente no tiene navegador,
  dicho explícitamente en su reporte para que el orquestador la haga.
- Registro de la fase actualizado (qué se hizo, archivos, desvíos, pendientes).
- **Sin commit** salvo que el usuario lo pida.

---

## Protocolo de trabajo con agentes

El trabajo se reparte entre un **orquestador** (el chat principal) y **subagentes**, uno por tarea.

### Orquestador

1. Lee este README y el doc de la fase activa.
2. Elige la siguiente tarea `⏳` cuyas dependencias estén `✅`.
3. Lanza un subagente con el prompt de abajo y el **modelo** que indica la tarea. Dos subagentes corren en paralelo **solo** si sus
   tareas no tocan los mismos archivos (cada tarea lista sus archivos).
4. Cuando el subagente termina: revisa el diff, corre los checks, hace la revisión visual y
   actualiza el estado (tabla de arriba y registro de la fase).
5. Al cerrar una fase, escribe el doc detallado de la siguiente con el mismo formato.

### Qué modelo usa cada tarea

Cada tarea de los docs de fase trae una columna **Modelo**. El orquestador la pasa al lanzar el
subagente (`model: "opus" | "sonnet" | "haiku"`). Criterio:

| Modelo | Cuándo | Ejemplos |
| --- | --- | --- |
| **Opus** | Crítica: si sale mal cuesta datos, seguridad o la calidad visual que vende el producto. Decisiones de arquitectura o UX con muchas piezas | Migraciones y routers que escriben dinero, filtros de privacidad, componentes base de marca, app shell, pantallas núcleo (Transactions, alta rápida, Home) |
| **Sonnet** | Mediana: sigue un patrón ya establecido o una spec clara, con algo de criterio | Variantes de shadcn, pantallas que reutilizan componentes ya hechos, routers de solo lectura, seed |
| **Haiku** | Carpintería: mecánica, sin decisiones de diseño, fácil de verificar | Traducir llaves `es`, secciones de `/kit`, actualizar `COMPONENTS.md`, cerrar BUILD-QUESTIONS, correr `docs:gen`, actualizar estado y registros |

Reglas:

- Si una tarea mezcla trabajo crítico y carpintería, el orquestador puede partirla: la parte
  crítica con Opus o Sonnet y la carpintería después con Haiku (ver "Carpintería" en cada fase).
- Si un subagente Sonnet o Haiku se atora, reporta dudas de diseño o falla dos veces la
  verificación, la tarea se relanza con el modelo de arriba. No se insiste con el mismo.
- La revisión visual y la del diff las hace siempre el orquestador.

### Prompt para un subagente

```text
Eres un ingeniero frontend senior trabajando en el repo Firecent (C:\01_DEV\05_Profesional\LUMIR\firecent).
Lee primero, en este orden:
1. docs/roadmap/README.md (decisiones y reglas: obligatorias)
2. docs/roadmap/<doc de la fase>, sección de la tarea <ID>
3. Las secciones de docs/prototype/SPEC.md y los HTML que la tarea cita
4. docs/COMPONENTS.md y docs/CONVENTIONS.md
Haz SOLO la tarea <ID>. Toca solo los archivos que la tarea lista; si necesitas otro, justifícalo en tu reporte.
Al terminar:
- Corre los checks del "Definition of done".
- Llena el registro de la tarea en el doc de la fase (hecho, archivos, desvíos, pendientes).
- No hagas commit.
- Reporta: qué hiciste, qué no pudiste verificar y cualquier decisión que tomaste.
```

### Cómo verificar en el navegador

- `bun run dev:web` y abre `http://localhost:3000/en/...`.
- `/en/kit` es pública: ahí se ven los componentes de `components/finance/` sin iniciar sesión.
- Para pantallas privadas, entra como la usuaria demo (Fase 1, tarea 1E): en `/en/auth/login`
  escribe `maya@demo.test`; el magic link sale impreso en la consola del servidor de Next (no hay
  SMTP en local). Abre ese link.
- Revisa a 390 px y a 1440 px, en claro y oscuro, y compara con el HTML del prototipo abierto
  en otra pestaña.

---

## Siguientes fases (resumen; se detallan al llegar)

### Fase 4 · Spaces y privacidad
Pantallas: selector de Space y miembros (`SPEC §5.11`), hoja `share` de cuenta (`§5.5`).
Schema (`schema-gaps §2`, con D2): `AccountVisibility` y `BankAccount.visibility`, `SpaceKind`,
`Organization.displayName / kind / baseCurrency`, `Member.defaultAccountId`,
`Debt.userId / visibility / currency`. **Filtro de visibilidad en todas las consultas** (records,
accounts, dashboard), con una prueba por router que verifique que Maya no ve lo privado de Daniel.
El split Shared / Only you del Home pasa a ser real. Cierra BUILD-QUESTIONS #7, #19, #23.

### Fase 5 · Budget
`SPEC §5.6`. Schema `§3`: `Budget`, `BudgetNature`, `BudgetCategory`; `Record.spendingNature`
(override de la categoría). Router `budgets`. Mejora: proponer el primer plan con el promedio de
3 meses. Cierra BUILD-QUESTIONS #23–#25.

### Fase 6 · Recurring y Notifications
`SPEC §5.8` y `§5.13`. Schema `§4` y `Notification` (`§6`). Job diario de ocurrencias (Auto crea
el `Record`; Manual crea un aviso). Enciende Coming up en Home.

### Fase 7 · Tarjetas e Installment plans
`SPEC §5.5` (tarjeta, hojas `pay-card` y `plan`). Schema `§5`. Pago de tarjeta = transferencia (D6).

### Fase 8 · Debts, Analytics, Assistant
`SPEC §5.9`, `§5.7`, `§5.10`. Multi-moneda con `ExchangeRate` (I-4). El asistente usa
herramientas de `apps/mcp`; toda escritura pasa por una `AssistantProposal` aprobada.

### Fase 9 · App nativa (Expo)
Porta pantallas ya validadas en web: shell → alta rápida → Transactions → Home → Accounts → resto.
Componentes equivalentes en `apps/mobile/src/components/finance/` con los mismos nombres. Puede
correr en paralelo desde la Fase 3 si la app es prioridad comercial.

### Fase 10 · Onboarding, Settings y pulido
`SPEC §5.12` y `§5.13`. Command palette (Ctrl+K), atajos `G` + letra, listas virtualizadas,
auditoría AA, capturas para la landing.
