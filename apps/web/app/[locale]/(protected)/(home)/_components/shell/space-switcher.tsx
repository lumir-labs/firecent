"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { firecentToast } from "@/components/ui/sonner";
import { useMediaQuery } from "@/hooks/use-media-query";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useShell, type SwitcherSpace } from "./shell-context";

function initialOf(name: string) {
  return name.trim().charAt(0).toUpperCase() || "S";
}

function useSpaceSwitch(onComplete?: () => void) {
  const t = useTranslations("Shell");
  const router = useRouter();
  const { spaces, activeSpace, activeSpaceId } = useShell();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function selectSpace(nextId: string) {
    if (nextId === activeSpaceId) {
      onComplete?.();
      return;
    }
    setBusyId(nextId);
    try {
      const { error } = await authClient.organization.setActive({
        organizationId: nextId,
      });
      if (error) {
        firecentToast(error.message || t("spaceSwitchError"));
        return;
      }
      onComplete?.();
      router.refresh();
    } catch {
      firecentToast(t("spaceSwitchError"));
    } finally {
      setBusyId(null);
    }
  }

  return { spaces, activeSpace, activeSpaceId, busyId, selectSpace };
}

function SpaceList({
  spaces,
  activeId,
  busyId,
  onSelect,
}: {
  spaces: SwitcherSpace[];
  activeId: string | null;
  busyId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {spaces.map((space) => {
        const selected = space.id === activeId;
        const loading = busyId === space.id;
        return (
          <button
            key={space.id}
            type="button"
            disabled={busyId !== null}
            onClick={() => onSelect(space.id)}
            className={cn(
              "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-accent",
              selected && "bg-accent/70",
            )}
          >
            <Avatar size="md" color={selected ? "PURPLE" : "GRAY"}>
              <AvatarFallback>{initialOf(space.name)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">
              {space.name}
            </span>
            {loading ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : selected ? (
              <Check className="size-4 shrink-0 text-primary-text" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Compact Space switcher embedded inside the desktop user menu popover.
 * Keeps space switching one click away without occupying the top of the sidebar.
 */
export function SpaceMenuGroup({ onSwitched }: { onSwitched?: () => void }) {
  const t = useTranslations("Shell");
  const { spaces, activeSpace, activeSpaceId, busyId, selectSpace } =
    useSpaceSwitch(onSwitched);

  if (!activeSpace) return null;

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {t("spaces")}
      </DropdownMenuLabel>
      <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto overscroll-contain">
        {spaces.map((space) => {
          const selected = space.id === activeSpaceId;
          const loading = busyId === space.id;
          return (
            <DropdownMenuItem
              key={space.id}
              closeOnClick={false}
              disabled={busyId !== null}
              onClick={() => void selectSpace(space.id)}
              className={cn(
                "min-h-9 rounded-xl px-2 py-1.5",
                selected && "bg-primary/8 font-medium",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-lg text-[11px] font-semibold",
                  selected
                    ? "bg-primary/15 text-primary-text"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {initialOf(space.name)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                {space.name}
              </span>
              {loading ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : selected ? (
                <Check className="size-3.5 shrink-0 text-primary-text" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </div>
    </DropdownMenuGroup>
  );
}

/**
 * Firecent E1 Space selector.
 * Desktop: 288 px popover anchored to trigger. Mobile: ResponsiveSheet drawer.
 */
export function SpaceSwitcher({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "mobile";
}) {
  const t = useTranslations("Shell");
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [open, setOpen] = useState(false);
  const { spaces, activeSpace, activeSpaceId, busyId, selectSpace } =
    useSpaceSwitch(() => setOpen(false));

  if (!activeSpace) return null;

  const triggerContent = (
    <>
      <Avatar size="md" color="PURPLE" className="shrink-0">
        <AvatarFallback>{initialOf(activeSpace.name)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-left text-[14px] font-semibold text-foreground">
        {activeSpace.name}
      </span>
      <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
    </>
  );

  if (variant === "sidebar" || isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label={t("switchSpace")}
          className={cn(
            "flex h-11 w-full items-center gap-2.5 rounded-xl px-2 transition-colors hover:bg-accent",
            variant === "mobile" && "w-auto max-w-[220px] px-1.5",
          )}
        >
          {triggerContent}
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} className="w-72 rounded-2xl p-2">
          <p className="px-3 py-1.5 text-[12px] font-medium text-muted-foreground">
            {t("spaces")}
          </p>
          <SpaceList
            spaces={spaces}
            activeId={activeSpaceId}
            busyId={busyId}
            onSelect={selectSpace}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={t("switchSpace")}
        onClick={() => setOpen(true)}
        className="flex h-11 max-w-[240px] items-center gap-2 rounded-full pr-2 pl-1 transition-colors hover:bg-accent"
      >
        {triggerContent}
      </button>
      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title={t("spaces")}
        closeLabel={t("close")}
      >
        <div className="px-4">
          <SpaceList
            spaces={spaces}
            activeId={activeSpaceId}
            busyId={busyId}
            onSelect={selectSpace}
          />
        </div>
      </ResponsiveSheet>
    </>
  );
}
