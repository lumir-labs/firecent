"use client";

import * as React from "react";
import { Bell, CircleAlert, Info, Lock, Plus, Receipt, Users } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { firecentToast } from "@/components/ui/sonner";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const AVATAR_COLORS = [
  "DEFAULT",
  "GRAY",
  "BROWN",
  "ORANGE",
  "YELLOW",
  "GREEN",
  "BLUE",
  "PURPLE",
  "PINK",
  "RED",
] as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Samples() {
  const [scope, setScope] = React.useState<string[]>(["everything"]);
  const [chips, setChips] = React.useState<string[]>(["need"]);

  return (
    <div className="space-y-6">
      <Row label='Button · size="touch" (h-11, 12 px) / "icon-touch" / variant="text"'>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="touch">
            <Plus /> Add transaction
          </Button>
          <Button size="touch" variant="outline">
            Try again
          </Button>
          <Button size="touch" variant="text">
            Clear filters
          </Button>
          <Button size="touch" variant="text" disabled>
            Disabled
          </Button>
          <Button size="icon-touch" variant="ghost" aria-label="Notifications">
            <Bell />
          </Button>
          <Button size="icon-touch" aria-label="Add">
            <Plus />
          </Button>
        </div>
      </Row>

      <Row label="Badge · neutral, shared, private, warning, positive, error">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">Pending</Badge>
          <Badge variant="shared">
            <Users /> Shared
          </Badge>
          <Badge variant="private">
            <Lock /> Only you
          </Badge>
          <Badge variant="warning">Due in 2 days</Badge>
          <Badge variant="positive">On track</Badge>
          <Badge variant="error">Overdue</Badge>
          <Badge variant="neutral">
            <Receipt /> Receipt
          </Badge>
        </div>
      </Row>

      <Row label='Card · variant="plain" (rounded-2xl, border, no shadow/padding)'>
        <Card variant="plain" className="divide-y">
          <div className="flex min-h-14 items-center justify-between px-4">
            <span className="text-muted-foreground">Category</span>
            <span className="font-medium">Entertainment</span>
          </div>
          <div className="flex min-h-14 items-center justify-between px-4">
            <span className="text-muted-foreground">Account</span>
            <span className="font-medium">Joint Checking</span>
          </div>
        </Card>
      </Row>

      <Row label='ToggleGroup · variant="segmented" (single)'>
        <ToggleGroup
          variant="segmented"
          value={scope}
          onValueChange={(v) => v.length && setScope(v)}
          aria-label="Scope"
        >
          <ToggleGroupItem value="everything">Everything</ToggleGroupItem>
          <ToggleGroupItem value="shared">Shared</ToggleGroupItem>
          <ToggleGroupItem value="only-you">Only you</ToggleGroupItem>
        </ToggleGroup>
      </Row>

      <Row label='Toggle · variant="chip" (aria-pressed → inverted)'>
        <div className="flex flex-wrap gap-2">
          {["All", "Owe", "Need", "Want"].map((c) => {
            const v = c.toLowerCase();
            return (
              <Toggle
                key={v}
                variant="chip"
                pressed={chips.includes(v)}
                onPressedChange={(on) =>
                  setChips((p) => (on ? [...p, v] : p.filter((x) => x !== v)))
                }
              >
                {c}
              </Toggle>
            );
          })}
        </div>
      </Row>

      <Row label='Input · size="touch" (h-12, 16 px) vs default'>
        <div className="space-y-2">
          <Input size="touch" placeholder="Search payee, note or amount" />
          <Input size="touch" aria-invalid defaultValue="Invalid value" />
          <Input placeholder="Default input (unchanged)" />
        </div>
      </Row>

      <Row label="Alert · notice / notice-warning">
        <div className="space-y-2">
          <Alert variant="notice">
            <Info />
            <AlertDescription>
              Balances update when you add a transaction.
            </AlertDescription>
          </Alert>
          <Alert variant="notice-warning">
            <CircleAlert />
            <AlertDescription>
              Couldn&apos;t save. Your entry is still here.
            </AlertDescription>
          </Alert>
        </div>
      </Row>

      <Row label='Empty · variant="state" (N13)'>
        <Card variant="plain">
          <Empty variant="state">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Receipt />
              </EmptyMedia>
              <EmptyTitle>No transactions yet</EmptyTitle>
              <EmptyDescription>
                Add your first one with the + button, or import a statement and
                approve what gets saved.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="touch">
                <Plus /> Add transaction
              </Button>
              <Button size="touch" variant="text">
                Import
              </Button>
            </EmptyContent>
          </Empty>
        </Card>
      </Row>

      <Row label="Avatar · 16 / 28 / 40 px and the 10 Colors">
        <div className="flex flex-wrap items-center gap-2">
          <Avatar size="xs" color="PURPLE">
            <AvatarFallback>M</AvatarFallback>
          </Avatar>
          <Avatar size="md" color="PURPLE">
            <AvatarFallback>M</AvatarFallback>
          </Avatar>
          <Avatar size="lg" color="PURPLE">
            <AvatarFallback>M</AvatarFallback>
          </Avatar>
          <span className="mx-1 h-6 w-px bg-border" />
          {AVATAR_COLORS.map((c) => (
            <Avatar key={c} size="md" color={c} title={c}>
              <AvatarFallback>{c[0]}</AvatarFallback>
            </Avatar>
          ))}
        </div>
      </Row>

      <Row label="Skeleton">
        <Card variant="plain" className="space-y-3 p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-10 w-2/3 rounded-xl" />
          <Skeleton className="h-4 w-full" />
        </Card>
      </Row>
    </div>
  );
}

export function FirecentPrimitives() {
  const [sheet, setSheet] = React.useState<null | "dialog" | "panel">(null);

  return (
    <section className="space-y-4" aria-labelledby="fc-primitives">
      <div>
        <h2 id="fc-primitives" className="text-lg font-semibold tracking-tight">
          Firecent · primitivas
        </h2>
        <p className="text-sm text-muted-foreground">
          Variantes de 1B sobre shadcn. Izquierda en claro, derecha en oscuro
          (contenedor <code className="font-mono text-xs">.dark</code>).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-background p-4">
          <Samples />
        </div>
        <div className="dark rounded-2xl border bg-background p-4 text-foreground">
          <Samples />
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground">
          ResponsiveSheet (drawer &lt; 1024 px; en lg dialog 480 o panel 420) y
          toast Firecent
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="touch" variant="outline" onClick={() => setSheet("dialog")}>
            Open (desktop=dialog)
          </Button>
          <Button size="touch" variant="outline" onClick={() => setSheet("panel")}>
            Open (desktop=panel)
          </Button>
          <Button
            size="touch"
            variant="outline"
            onClick={() =>
              firecentToast("Transaction deleted", {
                action: { label: "Undo", onClick: () => {} },
              })
            }
          >
            Firecent toast
          </Button>
        </div>
      </div>

      <ResponsiveSheet
        open={sheet !== null}
        onOpenChange={(o) => !o && setSheet(null)}
        title="Add transaction"
        desktop={sheet ?? "dialog"}
      >
        <div className="space-y-3 px-5">
          <Input size="touch" placeholder="Payee" />
          <Input size="touch" placeholder="Amount" inputMode="decimal" />
          <Button size="touch" className="w-full" onClick={() => setSheet(null)}>
            Save
          </Button>
        </div>
      </ResponsiveSheet>
    </section>
  );
}
