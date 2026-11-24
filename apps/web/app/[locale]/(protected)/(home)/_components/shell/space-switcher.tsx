"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Loader2, Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { firecentToast } from "@/components/ui/sonner";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useShell, type SwitcherSpace } from "./shell-context";

function initialOf(name: string) {
  return name.trim().charAt(0).toUpperCase() || "S";
}

function SpaceList({
  spaces,
  activeId,
  busyId,
  onSelect,
  onManage,
}: {
  spaces: SwitcherSpace[];
  activeId: string | null;
  busyId: string | null;
  onSelect: (id: string) => void;
  onManage: () => void;
}) {
  const t = useTranslations("Shell");

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
      <div className="mt-1 border-t pt-1">
        <Link
          href="/organization"
          onClick={onManage}
          className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Users className="size-4 shrink-0" />
          <span>{t("manageSpaces")}</span>
        </Link>
      </div>
    </div>
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
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { spaces, activeSpace, activeSpaceId } = useShell();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!activeSpace) return null;

  async function handleSelect(nextId: string) {
    if (nextId === activeSpaceId) {
      setOpen(false);
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
      setOpen(false);
      router.refresh();
    } catch {
      firecentToast(t("spaceSwitchError"));
    } finally {
      setBusyId(null);
    }
  }

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
            onSelect={handleSelect}
            onManage={() => setOpen(false)}
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
            onSelect={handleSelect}
            onManage={() => setOpen(false)}
          />
        </div>
      </ResponsiveSheet>
    </>
  );
}
