"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { keepPreviousData } from "@tanstack/react-query";
import {
  ChartNoAxesColumnIncreasing,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { trpc } from "@app/api/client";

import {
  NatureSwatch,
  PageHeader,
  Sparkline,
  StateBlock,
  formatMoneyText,
} from "@/components/finance";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Period = "1m" | "3m" | "6m" | "12m";

export function AnalyticsView() {
  const locale = useLocale();
  const t = useTranslations("Analytics");
  const tShell = useTranslations("Shell");

  const [period, setPeriod] = useState<Period>("6m");
  const [changeMode, setChangeMode] = useState<"categories" | "merchants">(
    "categories",
  );
  const [tableCard, setTableCard] = useState<Record<string, boolean>>({});

  const query = trpc.analytics.overview.useQuery(
    { period },
    { placeholderData: keepPreviousData },
  );
  const data = query.data;

  const toggleTable = (id: string) =>
    setTableCard((prev) => ({ ...prev, [id]: !prev[id] }));

  const periodControl = (
    <ToggleGroup
      variant="segmented"
      value={[period]}
      onValueChange={(vals) => {
        const next = vals[0] as Period | undefined;
        if (next) setPeriod(next);
      }}
    >
      <ToggleGroupItem value="1m">{t("periods.1m")}</ToggleGroupItem>
      <ToggleGroupItem value="3m">{t("periods.3m")}</ToggleGroupItem>
      <ToggleGroupItem value="6m">{t("periods.6m")}</ToggleGroupItem>
      <ToggleGroupItem value="12m">{t("periods.12m")}</ToggleGroupItem>
    </ToggleGroup>
  );

  const curMonth = data?.cashFlow[data.cashFlow.length - 1];
  const savedPct =
    curMonth && curMonth.in > 0
      ? Math.round((curMonth.net / curMonth.in) * 100)
      : 0;
  const maxCashBar = Math.max(
    1,
    ...(data?.cashFlow.flatMap((c) => [c.in, c.out]) ?? [1]),
  );

  const curNatureTotal = curMonth
    ? curMonth.DEBO + curMonth.NECESITO + curMonth.QUIERO
    : 0;
  const owePct =
    curNatureTotal > 0 && curMonth
      ? Math.round((curMonth.DEBO / curNatureTotal) * 100)
      : 0;
  const needPct =
    curNatureTotal > 0 && curMonth
      ? Math.round((curMonth.NECESITO / curNatureTotal) * 100)
      : 0;
  const wantPct =
    curNatureTotal > 0 && curMonth
      ? Math.max(0, 100 - owePct - needPct)
      : 0;
  const maxStackTotal = Math.max(
    1,
    ...(data?.cashFlow.map((c) => c.DEBO + c.NECESITO + c.QUIERO) ?? [1]),
  );

  const diffRows =
    changeMode === "categories"
      ? (data?.changes.categories ?? [])
      : (data?.changes.merchants ?? []);
  const maxDiffVal = Math.max(1, ...diffRows.map((r) => r.current));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        back="/more"
        backLabel={tShell("nav.more")}
        desktopActions={periodControl}
      />

      <div className="flex flex-col gap-6 px-5 lg:px-0">
        <div className="lg:hidden">{periodControl}</div>

        {query.isPending ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} variant="plain" className="flex flex-col gap-3 p-4">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-36 w-full rounded-xl" />
              </Card>
            ))}
          </div>
        ) : query.isError || !data ? (
          <StateBlock
            kind="error"
            action={{ label: t("retry"), onClick: () => query.refetch() }}
          />
        ) : !data.hasHistory ? (
          <StateBlock
            kind="empty"
            icon={ChartNoAxesColumnIncreasing}
            title={t("emptyTitle")}
            body={t("emptyBody")}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Card 1 · Cash flow */}
            <Card variant="plain" className="flex flex-col gap-4 p-5">
              <div>
                <p className="text-[13px] text-muted-foreground">
                  {t("card1.question")}
                </p>
                <h2 className="mt-1 text-[17px] leading-[23px] font-semibold">
                  {curMonth
                    ? curMonth.net >= 0
                      ? t("card1.kept", {
                          amount: formatMoneyText(
                            locale,
                            curMonth.net,
                            data.currency,
                            { tone: "plain" },
                          ),
                          pct: String(savedPct),
                        })
                      : t("card1.spentMore", {
                          amount: formatMoneyText(
                            locale,
                            Math.abs(curMonth.net),
                            data.currency,
                            { tone: "plain" },
                          ),
                        })
                    : t("nothingInPeriod")}
                </h2>
              </div>

              {tableCard.c1 ? (
                <div className="overflow-x-auto text-[13px]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-[12px] text-muted-foreground">
                        <th className="py-1.5 font-medium">{t("table.month")}</th>
                        <th className="py-1.5 text-right font-medium">{t("table.in")}</th>
                        <th className="py-1.5 text-right font-medium">{t("table.out")}</th>
                        <th className="py-1.5 text-right font-medium">{t("table.net")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.cashFlow.map((c) => (
                        <tr key={c.key}>
                          <td className="py-1.5 font-medium">{c.label}</td>
                          <td className="num py-1.5 text-right text-positive">
                            {formatMoneyText(locale, c.in, data.currency, {
                              tone: "plain",
                            })}
                          </td>
                          <td className="num py-1.5 text-right">
                            {formatMoneyText(locale, c.out, data.currency, {
                              tone: "plain",
                            })}
                          </td>
                          <td className="num py-1.5 text-right font-medium">
                            {formatMoneyText(locale, c.net, data.currency, {
                              tone: "movement",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <svg
                    role="img"
                    aria-label={t("card1.question")}
                    viewBox={`0 0 ${Math.max(1, data.cashFlow.length) * 56} 140`}
                    className="h-36 w-full lg:h-48"
                  >
                    <line
                      x1="0"
                      y1="115"
                      x2={data.cashFlow.length * 56}
                      y2="115"
                      stroke="var(--border)"
                      strokeWidth="1"
                    />
                    {data.cashFlow.map((c, idx) => {
                      const x = idx * 56 + 10;
                      const inH = Math.max(2, (c.in / maxCashBar) * 100);
                      const outH = Math.max(2, (c.out / maxCashBar) * 100);
                      return (
                        <g key={c.key}>
                          <rect
                            x={x}
                            y={115 - inH}
                            width="16"
                            height={inH}
                            rx="4"
                            fill="var(--positive)"
                          />
                          <rect
                            x={x + 20}
                            y={115 - outH}
                            width="16"
                            height={outH}
                            rx="4"
                            fill="var(--muted-foreground)"
                            fillOpacity="0.55"
                          />
                          <text
                            x={x + 18}
                            y="132"
                            textAnchor="middle"
                            fontSize="11"
                            fill="var(--muted-foreground)"
                          >
                            {c.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-[3px] bg-positive" />
                      {t("table.in")}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-[3px] bg-muted-foreground/55" />
                      {t("table.out")}
                    </span>
                  </div>
                </div>
              )}

              <Button
                variant="text"
                size="sm"
                onClick={() => toggleTable("c1")}
                className="self-start px-0"
              >
                {tableCard.c1 ? t("viewAsChart") : t("viewAsTable")}
              </Button>
            </Card>

            {/* Card 2 · Where does it go? */}
            <Card variant="plain" className="flex flex-col gap-4 p-5">
              <div>
                <p className="text-[13px] text-muted-foreground">
                  {t("card2.question")}
                </p>
                <h2 className="mt-1 text-[17px] leading-[23px] font-semibold">
                  {curNatureTotal > 0
                    ? t("card2.summary", {
                        owe: String(owePct),
                        need: String(needPct),
                        want: String(wantPct),
                      })
                    : t("nothingInPeriod")}
                </h2>
              </div>

              {tableCard.c2 ? (
                <div className="overflow-x-auto text-[13px]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-[12px] text-muted-foreground">
                        <th className="py-1.5 font-medium">{t("table.month")}</th>
                        <th className="py-1.5 text-right font-medium">{t("nature.DEBO")}</th>
                        <th className="py-1.5 text-right font-medium">{t("nature.NECESITO")}</th>
                        <th className="py-1.5 text-right font-medium">{t("nature.QUIERO")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.cashFlow.map((c) => (
                        <tr key={c.key}>
                          <td className="py-1.5 font-medium">{c.label}</td>
                          <td className="num py-1.5 text-right">
                            {formatMoneyText(locale, c.DEBO, data.currency, {
                              tone: "plain",
                            })}
                          </td>
                          <td className="num py-1.5 text-right">
                            {formatMoneyText(locale, c.NECESITO, data.currency, {
                              tone: "plain",
                            })}
                          </td>
                          <td className="num py-1.5 text-right">
                            {formatMoneyText(locale, c.QUIERO, data.currency, {
                              tone: "plain",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Horizontal 100% bar */}
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                    {owePct > 0 && (
                      <div
                        className="h-full bg-nature-owe"
                        style={{ width: `${owePct}%` }}
                      />
                    )}
                    {needPct > 0 && (
                      <div
                        className="h-full bg-nature-need"
                        style={{ width: `${needPct}%` }}
                      />
                    )}
                    {wantPct > 0 && (
                      <div
                        className="h-full bg-nature-want"
                        style={{ width: `${wantPct}%` }}
                      />
                    )}
                  </div>

                  {/* Stacked monthly SVG columns */}
                  <svg
                    role="img"
                    aria-label={t("card2.question")}
                    viewBox={`0 0 ${Math.max(1, data.cashFlow.length) * 52} 115`}
                    className="h-28 w-full lg:h-36"
                  >
                    <line
                      x1="0"
                      y1="92"
                      x2={data.cashFlow.length * 52}
                      y2="92"
                      stroke="var(--border)"
                      strokeWidth="1"
                    />
                    {data.cashFlow.map((c, idx) => {
                      const x = idx * 52 + 16;
                      const hOwe = (c.DEBO / maxStackTotal) * 84;
                      const hNeed = (c.NECESITO / maxStackTotal) * 84;
                      const hWant = (c.QUIERO / maxStackTotal) * 84;
                      return (
                        <g key={c.key}>
                          <rect
                            x={x}
                            y={92 - hOwe}
                            width="20"
                            height={hOwe}
                            fill="var(--nature-owe)"
                          />
                          <rect
                            x={x}
                            y={92 - hOwe - hNeed}
                            width="20"
                            height={hNeed}
                            fill="var(--nature-need)"
                          />
                          <rect
                            x={x}
                            y={92 - hOwe - hNeed - hWant}
                            width="20"
                            height={hWant}
                            rx="3"
                            fill="var(--nature-want)"
                          />
                          <text
                            x={x + 10}
                            y="108"
                            textAnchor="middle"
                            fontSize="11"
                            fill="var(--muted-foreground)"
                          >
                            {c.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
                    {(["DEBO", "NECESITO", "QUIERO"] as const).map((n) => (
                      <span key={n} className="flex items-center gap-1.5">
                        <NatureSwatch nature={n} />
                        <span>{t(`nature.${n}`)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Button
                variant="text"
                size="sm"
                onClick={() => toggleTable("c2")}
                className="self-start px-0"
              >
                {tableCard.c2 ? t("viewAsChart") : t("viewAsTable")}
              </Button>
            </Card>

            {/* Card 3 · What changed since last month? */}
            <Card variant="plain" className="flex flex-col gap-4 p-5">
              <div>
                <p className="text-[13px] text-muted-foreground">
                  {t("card3.question")}
                </p>
                <h2 className="mt-1 text-[17px] leading-[23px] font-semibold">
                  {data.changes.totalDelta >= 0
                    ? t("card3.moreThanLast", {
                        amount: formatMoneyText(
                          locale,
                          data.changes.totalDelta,
                          data.currency,
                          { tone: "plain" },
                        ),
                      })
                    : t("card3.lessThanLast", {
                        amount: formatMoneyText(
                          locale,
                          Math.abs(data.changes.totalDelta),
                          data.currency,
                          { tone: "plain" },
                        ),
                      })}
                </h2>
              </div>

              <ToggleGroup
                variant="segmented"
                value={[changeMode]}
                onValueChange={(vals) => {
                  const next = vals[0] as "categories" | "merchants" | undefined;
                  if (next) setChangeMode(next);
                }}
                className="w-full"
              >
                <ToggleGroupItem value="categories" className="flex-1">
                  {t("card3.categories")}
                </ToggleGroupItem>
                <ToggleGroupItem value="merchants" className="flex-1">
                  {t("card3.merchants")}
                </ToggleGroupItem>
              </ToggleGroup>

              <div className="flex flex-col gap-3">
                {diffRows.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    {t("nothingInPeriod")}
                  </p>
                ) : (
                  diffRows.map((row) => (
                    <div key={row.name} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="truncate font-medium">{row.name}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="num font-semibold">
                            {formatMoneyText(locale, row.current, data.currency, {
                              tone: "plain",
                            })}
                          </span>
                          <span className="num inline-flex items-center gap-0.5 text-[12px] text-muted-foreground">
                            {row.delta > 0 && <TrendingUp className="size-3" />}
                            {row.delta < 0 && <TrendingDown className="size-3" />}
                            {row.delta > 0 ? "+" : ""}
                            {formatMoneyText(locale, row.delta, data.currency, {
                              tone: "plain",
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground/70"
                          style={{
                            width: `${Math.min(100, (row.current / maxDiffVal) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <p className="text-[12px] text-muted-foreground">
                {t("card3.comparedTo", { day: String(data.compareDay) })}
              </p>
            </Card>

            {/* Card 4 · Is the total growing? */}
            <Card variant="plain" className="flex flex-col gap-4 p-5">
              <div>
                <p className="text-[13px] text-muted-foreground">
                  {t("card4.question")}
                </p>
                <h2 className="mt-1 text-[17px] leading-[23px] font-semibold">
                  {data.balanceDelta >= 0
                    ? t("card4.up", {
                        amount: formatMoneyText(
                          locale,
                          data.balanceDelta,
                          data.currency,
                          { tone: "plain" },
                        ),
                      })
                    : t("card4.down", {
                        amount: formatMoneyText(
                          locale,
                          Math.abs(data.balanceDelta),
                          data.currency,
                          { tone: "plain" },
                        ),
                      })}
                </h2>
              </div>

              {tableCard.c4 ? (
                <div className="overflow-x-auto text-[13px]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-[12px] text-muted-foreground">
                        <th className="py-1.5 font-medium">{t("table.month")}</th>
                        <th className="py-1.5 text-right font-medium">{t("table.balance")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.balanceTrend.map((p, idx) => (
                        <tr key={`${p.label}-${idx}`}>
                          <td className="py-1.5 font-medium">{p.label}</td>
                          <td className="num py-1.5 text-right">
                            {formatMoneyText(locale, p.value, data.currency, {
                              tone: "plain",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div>
                  <Sparkline
                    points={data.balanceTrend.map((p) => p.value)}
                    ariaLabel={t("card4.question")}
                    className="h-36 w-full lg:h-48"
                  />
                  <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                    {data.balanceTrend.map((p, idx) => (
                      <span key={`${p.label}-${idx}`}>{p.label}</span>
                    ))}
                  </div>
                </div>
              )}

              <Button
                variant="text"
                size="sm"
                onClick={() => toggleTable("c4")}
                className="self-start px-0"
              >
                {tableCard.c4 ? t("viewAsChart") : t("viewAsTable")}
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
