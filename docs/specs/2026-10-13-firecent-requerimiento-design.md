# Firecent — Requerimiento completo y diseño (SaaS finanzas personales)

> Fecha: 2026-10-13 · Enfoque aprobado: **A Evolutivo por fases, sin romper lo que funciona**
> Target de migración: boilerplate **bpthree** (turborepo `apps/web|mobile|mcp` + `packages/api|db|lib|env`)
> Repo actual (Next.js monolito con Server Actions) aporta el **dominio**; bpthree aporta la **plataforma**.
> Estado: spec en revisión — NO pasar a `writing-plans` hasta aprobación explícita.

## 1. Entendimiento acordado

**Propósito (6 meses):** SaaS multi-usuario de finanzas personales estilo Wallet, pero propio.
Éxito = web usable por Spaces compartidos + base lista para app móvil + agentes.

**Lo que el usuario dijo (respuestas):**

- SaaS multi-usuario · spec modular **core + fases** · multi-moneda **por cuenta**
  (cada tarjeta/ahorro/banco en su moneda) · privacidad **cuenta privada o compartida**
- Tarjetas **completo con MSI** · `Envelope` **se elimina, presupuestos desde cero**
- Recurrentes **plantilla + auto/manual** · IA **analista completo**

**Supuestos explícitos:** montos siempre `Int` centavos; `Organization` se presenta como
**Space** en UI (tabla se renombra en Fase 3, no antes); i18n `es/en` desde bpthree;
balances actuales en memoria se reemplazan por agregación SQL; IA jamás auto-confirma
dinero real salvo recurrente en modo `auto` ya autorizado.
