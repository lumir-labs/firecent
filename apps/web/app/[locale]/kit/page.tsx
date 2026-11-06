"use client";

import * as React from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import {
  Plane,
  Users,
  Plus,
  ArrowUpRight,
  Check,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Wallet,
  Search,
  Sun,
  Moon,
  CreditCard,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

export default function UiKitPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [notify, setNotify] = React.useState(true);
  const [equalSplit, setEqualSplit] = React.useState(true);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground antialiased selection:bg-primary/20">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <Image
              src="/logo.svg"
              alt="Firecent"
              width={112}
              height={28}
              className="dark:hidden h-6 w-auto shrink-0"
              priority
            />
            <Image
              src="/logo_d.svg"
              alt="Firecent"
              width={112}
              height={28}
              className="hidden dark:block h-6 w-auto shrink-0"
              priority
            />
            <span className="hidden sm:inline-block text-xs text-muted-foreground font-medium pl-3 border-l border-border">
              UI System
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="gradient"
              size="sm"
              className="hidden sm:inline-flex"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo gasto</span>
            </Button>

            {mounted && (
              <Button
                variant="outline"
                size="icon"
                onClick={toggleTheme}
                title="Cambiar tema"
                aria-label="Cambiar tema"
                className="h-8 w-8"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-slate-700" />
                )}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="mx-auto max-w-6xl w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8 sm:space-y-12">
        {/* ── Overview Header (No vibe-coded sparkles or tacky eyebrows) ── */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="max-w-2xl space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Firecent Design System
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Catálogo de componentes shadcn/ui y tokens semánticos oficiales. Primario celeste-azul (
              <code className="font-mono text-primary text-xs">#5E54F0</code>) y variante de botón con gradiente corporativo (
              <code className="font-mono text-xs">#5E54F0 → #FF6B3D</code>).
            </p>
          </div>
        </section>

        {/* ── 1. Paleta de Color Semántica ── */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Colores del Tema
            </h2>
            <p className="text-xs text-muted-foreground">
              Tokens configurados en <code className="font-mono text-[11px]">packages/lib/src/tokens/tokens.css</code>.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3">
            <div className="rounded-lg border border-border bg-card p-2.5 space-y-2">
              <div className="h-9 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-medium text-xs">
                Primary
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-medium truncate">Celeste / Azul</p>
                <p className="text-[11px] font-mono text-muted-foreground truncate">
                  #5E54F0
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-2.5 space-y-2">
              <div className="h-9 rounded-md bg-[#FF6B3D] flex items-center justify-center text-white font-medium text-xs">
                Orange
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-medium truncate">Fire Orange</p>
                <p className="text-[11px] font-mono text-muted-foreground truncate">
                  #FF6B3D
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-2.5 space-y-2">
              <div className="h-9 rounded-md bg-gradient-to-r from-[#5E54F0] via-[#7C5CFF] to-[#FF6B3D] flex items-center justify-center text-white font-medium text-xs">
                Gradient
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-medium truncate">Azul a Naranja</p>
                <p className="text-[11px] font-mono text-muted-foreground truncate">
                  Brand Accent
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-2.5 space-y-2">
              <div className="h-9 rounded-md bg-[#0B1220] flex items-center justify-center text-white font-medium text-xs">
                Navy
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-medium truncate">Brand Navy</p>
                <p className="text-[11px] font-mono text-muted-foreground truncate">
                  #0B1220
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-2.5 space-y-2">
              <div className="h-9 rounded-md bg-secondary flex items-center justify-center text-secondary-foreground font-medium text-xs">
                Secondary
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-medium truncate">Secondary</p>
                <p className="text-[11px] font-mono text-muted-foreground truncate">
                  Neutral Light
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-2.5 space-y-2">
              <div className="h-9 rounded-md bg-muted flex items-center justify-center text-muted-foreground font-medium text-xs">
                Muted
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-medium truncate">Muted</p>
                <p className="text-[11px] font-mono text-muted-foreground truncate">
                  Surface
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Botones & Variantes ── */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Botones
            </h2>
            <p className="text-xs text-muted-foreground">
              Variante <code className="font-mono text-[11px]">gradient</code> y variantes oficiales del componente Button.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Variantes de estilo
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="gradient">
                  <span>Gradient (Azul a Naranja)</span>
                </Button>
                <Button variant="default">
                  <span>Primary</span>
                </Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="link">Link</Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Tamaños y con icono
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="gradient" size="xs">
                  <span>Extra Small</span>
                </Button>
                <Button variant="gradient" size="sm">
                  <span>Small</span>
                </Button>
                <Button variant="gradient" size="default">
                  <span>Default</span>
                </Button>
                <Button variant="gradient" size="lg">
                  <span>Large</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
                <Button variant="gradient" size="icon" aria-label="Nuevo">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button variant="default" size="icon" aria-label="Viaje">
                  <Plane className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" aria-label="Grupo">
                  <Users className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. Tarjetas de Experiencia de Producto ── */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Tarjetas de Producto
            </h2>
            <p className="text-xs text-muted-foreground">
              Patrones para metas compartidas, desglose de gastos y fondos del grupo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Meta Grupal Card */}
            <Card className="flex flex-col justify-between">
              <CardHeader className="pb-3 px-4 sm:px-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Plane className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm sm:text-base font-semibold">
                      Viaje a Europa
                    </CardTitle>
                    <CardDescription className="text-xs">
                      5 integrantes · Meta compartida
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 px-4 sm:px-5">
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-xs">
                    <div>
                      <span className="text-xl sm:text-2xl font-bold text-foreground">
                        $1,240
                      </span>
                      <span className="text-muted-foreground ml-1">/ $2,000</span>
                    </div>
                    <span className="font-semibold text-primary">62%</span>
                  </div>
                  <Progress value={62} />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <div className="flex -space-x-1.5 shrink-0">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#FF7A3D] text-[10px] font-bold text-white ring-2 ring-card">
                      L
                    </span>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#5E54F0] text-[10px] font-bold text-white ring-2 ring-card">
                      M
                    </span>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#0ea5e9] text-[10px] font-bold text-white ring-2 ring-card">
                      A
                    </span>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-foreground ring-2 ring-card">
                      +2
                    </span>
                  </div>
                  <span>Faltan $760</span>
                </div>
              </CardContent>
              <CardFooter className="pt-2 px-4 sm:px-5">
                <Button variant="gradient" className="w-full">
                  <Plus className="h-4 w-4" />
                  <span>Aportar al viaje</span>
                </Button>
              </CardFooter>
            </Card>

            {/* Gasto Dividido Card */}
            <Card className="flex flex-col justify-between">
              <CardHeader className="pb-3 px-4 sm:px-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FF6B3D]/10 text-[#FF6B3D]">
                      <Receipt className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-sm sm:text-base font-semibold">
                        Cena del equipo
                      </CardTitle>
                      <CardDescription className="text-xs">
                        14 oct · Oficina
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10 shrink-0"
                  >
                    <Check className="h-3 w-3 mr-1" /> Saldado
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 px-4 sm:px-5">
                <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pagado por Laura:</span>
                    <span className="font-medium text-foreground">$114.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tu parte (1 de 4):</span>
                    <span className="font-semibold text-[#FF6B3D]">-$28.50</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>Transferido automáticamente</span>
                </p>
              </CardContent>
              <CardFooter className="pt-2 px-4 sm:px-5 flex gap-2">
                <Button variant="outline" className="flex-1">
                  Ver recibo
                </Button>
                <Button variant="default" className="flex-1">
                  Dividir otro
                </Button>
              </CardFooter>
            </Card>

            {/* Saldo de Grupo Card */}
            <Card className="flex flex-col justify-between md:col-span-2 lg:col-span-1">
              <CardHeader className="pb-3 px-4 sm:px-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-sm sm:text-base font-semibold">
                        Fondos Disponibles
                      </CardTitle>
                      <CardDescription className="text-xs">
                        3 grupos activos
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-[11px] font-normal text-muted-foreground shrink-0"
                  >
                    Al día
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 px-4 sm:px-5">
                <div>
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight">
                    $4,850.00
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Saldo total consolidado
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-border p-2.5">
                    <p className="text-muted-foreground">Por cobrar</p>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      +$120.00
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-2.5">
                    <p className="text-muted-foreground">Por pagar</p>
                    <p className="font-semibold text-[#FF6B3D] mt-0.5">
                      -$45.00
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-2 px-4 sm:px-5">
                <Button variant="gradient" className="w-full">
                  <span>Transferir o Retirar</span>
                  <ArrowUpRight className="h-4 w-4 ml-1" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* ── 4. Formularios & Controles ── */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Formularios y Controles
            </h2>
            <p className="text-xs text-muted-foreground">
              Campos de entrada, interruptores y medidores.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <Field>
                <FieldLabel htmlFor="search-kit">Buscar gasto o grupo</FieldLabel>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <Search className="text-muted-foreground" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="search-kit"
                    placeholder="Ej. Hospedaje, Restaurante..."
                  />
                </InputGroup>
              </Field>

              <Field>
                <FieldLabel htmlFor="amount-kit">Monto a dividir ($ USD)</FieldLabel>
                <Input
                  id="amount-kit"
                  type="number"
                  placeholder="0.00"
                  defaultValue="150.00"
                  className="font-mono"
                />
              </Field>

              <Field className="sm:col-span-2 lg:col-span-1">
                <FieldLabel htmlFor="email-kit">Correo o alias</FieldLabel>
                <Input
                  id="email-kit"
                  placeholder="nombre@ejemplo.com"
                />
              </Field>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5 pr-2">
                  <p className="text-xs font-medium">Notificaciones</p>
                  <p className="text-[11px] text-muted-foreground">Alertas al registrar gastos</p>
                </div>
                <Switch checked={notify} onCheckedChange={setNotify} />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5 pr-2">
                  <p className="text-xs font-medium">División equitativa</p>
                  <p className="text-[11px] text-muted-foreground">Partes iguales por defecto</p>
                </div>
                <Checkbox
                  checked={equalSplit}
                  onCheckedChange={(c) => setEqualSplit(!!c)}
                />
              </div>

              <div className="rounded-lg border border-border p-3 space-y-1.5 sm:col-span-2 lg:col-span-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-muted-foreground">Meta mensual</span>
                  <span className="text-primary font-semibold">50%</span>
                </div>
                <Progress value={50} />
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. Feedback y Preguntas ── */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Feedback y Notificaciones
            </h2>
            <p className="text-xs text-muted-foreground">
              Alertas de estado, estados vacíos y acordeones.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertTitle className="text-xs font-semibold">Meta alcanzada al 60%</AlertTitle>
                <AlertDescription className="text-xs">
                  El grupo &quot;Viaje a Europa&quot; superó el aporte previsto para esta semana.
                </AlertDescription>
              </Alert>

              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-xs font-semibold">Gasto pendiente</AlertTitle>
                <AlertDescription className="text-xs">
                  Hay un cargo de $28.50 pendiente de aprobación por el organizador.
                </AlertDescription>
              </Alert>

              <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Estado de sincronización</p>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-7 w-7 rounded-md shrink-0" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <h3 className="text-xs font-semibold text-foreground mb-1">
                Preguntas frecuentes
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Operaciones comunes en grupos y balances.
              </p>
              <Accordion>
                <AccordionItem value="item-1">
                  <AccordionTrigger className="text-xs sm:text-sm py-2.5">
                    ¿Cómo se compensan los saldos?
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground">
                    Firecent minimiza transferencias entre integrantes calculando deudas netas automáticas.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger className="text-xs sm:text-sm py-2.5">
                    ¿Se pueden exportar reportes?
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground">
                    Sí, cada grupo genera balances detallados listos para descargar en PDF o planilla.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger className="text-xs sm:text-sm py-2.5">
                    ¿Quién puede registrar gastos?
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground">
                    Cualquier miembro invitado al grupo con permisos de participante.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </section>

        {/* ── 6. Actividad Reciente (Tabs & Data Table) ── */}
        <section className="space-y-3 pb-8">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Actividad Reciente
            </h2>
            <p className="text-xs text-muted-foreground">
              Pestañas de filtrado con tabla de transacciones de scroll horizontal autónomo.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-4">
            <Tabs defaultValue="todos" className="w-full">
              {/* Header with clean tabs and period indicator */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
                <TabsList className="grid grid-cols-3 w-full sm:w-[320px] h-9">
                  <TabsTrigger value="todos" className="text-xs">
                    Todos
                  </TabsTrigger>
                  <TabsTrigger value="pendientes" className="text-xs">
                    Pendientes
                  </TabsTrigger>
                  <TabsTrigger value="saldados" className="text-xs">
                    Saldados
                  </TabsTrigger>
                </TabsList>
                <span className="text-xs text-muted-foreground font-medium sm:text-right">
                  Período: Octubre 2026
                </span>
              </div>

              {/* Table with contained overflow */}
              <TabsContent value="todos" className="mt-3">
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table className="w-full min-w-[500px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-semibold">Concepto</TableHead>
                        <TableHead className="text-xs font-semibold">Grupo</TableHead>
                        <TableHead className="text-xs font-semibold">Fecha</TableHead>
                        <TableHead className="text-xs font-semibold">Pagado por</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Monto</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium whitespace-nowrap text-xs">
                          <span className="inline-flex items-center gap-2">
                            <Plane className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>Boletos de avión</span>
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          Viaje Europa
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          14 Oct
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          Carlos R.
                        </TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap text-xs">
                          $680.00
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-primary/10 text-primary border-transparent px-2 py-0"
                          >
                            Aprobado
                          </Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium whitespace-nowrap text-xs">
                          <span className="inline-flex items-center gap-2">
                            <Receipt className="h-3.5 w-3.5 text-[#FF6B3D] shrink-0" />
                            <span>Cena del equipo</span>
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          Oficina
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          12 Oct
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          Laura G.
                        </TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap text-xs">
                          $114.00
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 px-2 py-0"
                          >
                            Saldado
                          </Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium whitespace-nowrap text-xs">
                          <span className="inline-flex items-center gap-2">
                            <CreditCard className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>Alojamiento Airbnb</span>
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          Viaje Europa
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          08 Oct
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          Mario S.
                        </TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap text-xs">
                          $420.00
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-primary/10 text-primary border-transparent px-2 py-0"
                          >
                            Aprobado
                          </Badge>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="pendientes">
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No hay gastos pendientes en este período.
                </div>
              </TabsContent>

              <TabsContent value="saldados">
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Todos los saldos están al día.
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </main>
    </div>
  );
}
