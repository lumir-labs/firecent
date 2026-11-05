import React from "react";
import { Plane, Users, ArrowUpRight, Plus } from "lucide-react";

export function AuthHero() {
  return (
    <div className="relative hidden h-full w-full overflow-hidden bg-[#0B1220] lg:flex lg:flex-col lg:justify-between p-12 xl:p-16 text-white select-none">
      {/* ── Soft Ambient Lighting ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-[#FF6B3D]/10 blur-[140px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-32 h-[36rem] w-[36rem] rounded-full bg-[#7C5CFF]/20 blur-[150px]"
      />

      {/* ── Bottom Brand Wave (Anchored to bottom-right corner) ── */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 w-[45%] max-w-[380px] opacity-85"
        viewBox="0 0 420 320"
        fill="none"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="heroOrgV" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7C5CFF" />
            <stop offset="100%" stopColor="#3A2EDB" />
          </linearGradient>
          <linearGradient id="heroOrgO" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#FF3F3A" />
            <stop offset="100%" stopColor="#FFA64F" />
          </linearGradient>
          <linearGradient id="heroOrgL" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#E9E3FF" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        <path
          d="M0 320 C110 300 170 190 260 140 C330 100 380 85 420 40 L420 320 Z"
          fill="url(#heroOrgV)"
        />
        <path
          d="M50 320 C150 296 210 220 290 196 C345 180 390 170 420 140 L420 320 Z"
          fill="url(#heroOrgO)"
          fillOpacity="0.9"
        />
        <path
          d="M130 320 C220 296 300 268 420 246 L420 320 Z"
          fill="url(#heroOrgL)"
        />
      </svg>

      {/* ── Header: Minimal Brand Category ── */}
      <div className="relative z-10 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
          Finanzas en grupo
        </span>
        <span className="text-xs text-slate-500 font-medium">firecent.app</span>
      </div>

      {/* ── Center Stage: Clean, High-Fidelity Product Card ── */}
      <div className="relative z-10 my-auto py-6">
        <div className="mx-auto w-full max-w-[390px]">
          {/* Main Container Card */}
          <div className="rounded-2xl border border-white/10 bg-[#11192A]/90 p-5 shadow-2xl shadow-black/70 backdrop-blur-xl">
            {/* Group Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C5CFF]/15 text-[#A78BFA] border border-[#7C5CFF]/25">
                  <Plane className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white tracking-tight">
                    Viaje a Europa
                  </h4>
                  <p className="text-xs text-slate-400">
                    5 integrantes · Meta grupal
                  </p>
                </div>
              </div>

              {/* Members Avatar Stack */}
              <div className="flex -space-x-1.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#FF7A3D] text-[10px] font-medium text-white ring-2 ring-[#11192A]">
                  L
                </span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#7C5CFF] text-[10px] font-medium text-white ring-2 ring-[#11192A]">
                  M
                </span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#3b82f6] text-[10px] font-medium text-white ring-2 ring-[#11192A]">
                  A
                </span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-[10px] font-medium text-slate-300 ring-2 ring-[#11192A]">
                  +2
                </span>
              </div>
            </div>

            {/* Savings Goal Progress */}
            <div className="mt-5 rounded-xl bg-white/[0.03] p-3.5 border border-white/5">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs text-slate-400 font-medium">
                  Ahorro acumulado
                </span>
                <span className="text-xs font-semibold text-[#A78BFA]">
                  62%
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mb-2.5">
                <span className="text-2xl font-bold tracking-tight text-white">
                  $1,240
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  / $2,000
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#A78BFA]"
                  style={{ width: "62%" }}
                />
              </div>
            </div>

            {/* Recent Group Expense */}
            <div className="mt-3.5 flex items-center justify-between rounded-xl bg-white/[0.02] p-3 border border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF6B3D]/15 text-[#FF7A3D]">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-white">
                    Cena del equipo
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Dividido entre 4
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-200">
                -$28.50
              </span>
            </div>

            {/* Quick Action */}
            <div className="mt-3.5 flex gap-2">
              <button
                type="button"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#7C5CFF] to-[#FF6B3D] py-2 text-xs font-medium text-white shadow-sm transition hover:opacity-95 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nuevo gasto</span>
              </button>
              <button
                type="button"
                className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10 cursor-pointer"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Section: Confident Typography ── */}
      <div className="relative z-10 max-w-sm space-y-2">
        <h2 className="text-2xl xl:text-3xl font-bold tracking-tight text-white leading-tight">
          Metas más grandes,{" "}
          <span className="text-[#FF7A3D]">juntos.</span>
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          Organiza tus finanzas en grupo, comparte gastos y alcanza tus metas,
          todo en un solo lugar.
        </p>
      </div>
    </div>
  );
}
