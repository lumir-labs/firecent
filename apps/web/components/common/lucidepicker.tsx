"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { cn, normalizeForSearch } from "@/lib/utils";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  Command,
} from "@/components/ui/command";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { UseCatalogFnResult } from "@/lib/general-types";
import { toast } from "sonner";
import { queryClient } from "@/providers/query-provider";
import { useRouter } from "@/i18n/navigation";
import * as LucideIcons from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─────────────────────────────────────────────
// Props — controlled component with external value
// ─────────────────────────────────────────────

export type BaseDialogSelectProps = {
  /** Externally controlled value. When it changes, the component syncs. */
  value?: number | string | null;
  onChangeAction?: (
    id: number | string | undefined,
  ) => Promise<{ data?: boolean; error?: string }> | void;
  useCatalogFn?: () => UseCatalogFnResult;
  canEdit?: boolean;
  forceImage?: boolean;
  variant?: "ghost" | "outline";
  children?: React.ReactNode;
  /**
   * Callback executed when trying to create a new item.
   * If this prop is provided, the create button is shown when there are no results.
   */
  onCreateAction?: (query: string) => void;
  /** Used in placeholders and labels (pass it already translated). */
  itemLabel?: string;
  useDot?: boolean;
  placeholder?: string;
  disabled?: boolean;
  invalidateQueries?: string[][];
  refresh?: boolean;
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

const EXCLUDED = new Set([
  "LucideProvider",
  "LucideIcon",
  "default",
  "createLucideIcon",
]);

export default function IconPicker({
  value,
  children,
  onChangeAction,
  canEdit = true,
  onCreateAction,
  itemLabel,
  invalidateQueries,
  useDot = false,
  forceImage = false,
  placeholder,
  disabled = false,
  variant = "outline",
  refresh,
}: BaseDialogSelectProps) {
  const t = useTranslations("Common");
  const label = itemLabel ?? t("catalog.iconItem");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  // FIX #1: internal state synced with the external value (controlled component).
  const [selectedId, setSelectedId] = useState<
    number | string | undefined | null
  >(value);

  // FIX #1: sync only when the parent updates `value`.
  // Do NOT include onChangeAction in deps — if the parent passes a new inline
  // function on every render, this effect would setSelectedId again and revert
  // any local change the user just made.
  useEffect(() => {
    setSelectedId(value);
  }, [value]);

  const catalog = useMemo(
    () =>
      Object.keys(LucideIcons).filter(
        (key) =>
          /^[A-Z]/.test(key) &&
          !key.endsWith("Icon") &&
          !EXCLUDED.has(key) &&
          LucideIcons[key as keyof typeof LucideIcons] != null,
      ),
    [],
  );

  const handleSelect = useCallback(
    (itemId: number | string) => {
      if (selectedId === itemId) {
        // Already selected: just close without re-notifying the parent.
        setOpen(false);
        return;
      }
      setSelectedId(itemId);
      handleChangeValue(itemId);
      setOpen(false);
    },
    [selectedId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function handleChangeValue(itemId: number | string) {
    try {
      const response = await onChangeAction?.(itemId);
      if (response?.error) {
        throw new Error(String(response.error));
      }

      if (invalidateQueries) {
        invalidateQueries.forEach((query) => {
          queryClient.invalidateQueries({ queryKey: query });
        });
      }
      if (refresh) {
        router.refresh();
      }
      setOpen(false);
    } catch (error) {
      toast.error((error as Error).message || t("catalog.changeError"), {
        richColors: true,
      });
    }
  }

  const handleCreate = useCallback(() => {
    onCreateAction?.(searchQuery);
    setOpen(false);
  }, [onCreateAction, searchQuery]);

  // FIX #2: useMemo instead of useCallback + immediate call.
  const selectedItem = useMemo(
    () => catalog.find((item) => item === selectedId),
    [catalog, selectedId],
  );

  // 1. Filter BEFORE the slice
  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return catalog.slice(0, 150);
    const q = searchQuery.toLowerCase();
    return catalog
      .filter((name) => name.toLowerCase().includes(q))
      .slice(0, 150); // more results when searching
  }, [catalog, searchQuery]);

  return (
    <>
      <BadgeSelect
        disabled={disabled}
        variant={variant}
        selectedItem={selectedItem}
        setOpen={setOpen}
        itemLabel={label}
        canEdit={canEdit}
        useDot={useDot}
        placeholder={placeholder}
        forceImage={forceImage}
      >
        {children}
      </BadgeSelect>

      {/* FIX #5: the redundant <Command> inside <CommandDialog> was removed. */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command shouldFilter={false}>
          <CommandInput
            disabled={disabled}
            placeholder={t("catalog.search", {
              item: label.toLowerCase(),
            })}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {/* FIX #4: canCreate replaced by onCreateAction with a real handler. */}
              {onCreateAction ? (
                <Button variant="outline" onClick={handleCreate}>
                  <Plus className="size-4" />
                  {t("catalog.create")}
                  <Badge className="text-sm">{searchQuery}</Badge>
                </Button>
              ) : (
                t("catalog.noResults")
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredCatalog.map((item) => {
                const isSelected = selectedId === item;
                return (
                  <Tooltip key={item}>
                    <TooltipTrigger>
                      <CommandItem
                        key={item}
                        disabled={disabled}
                        value={normalizeForSearch(item)}
                        checkIcon={false}
                        className="cursor-pointer [&_svg:not([class*='size-'])]:size-6"
                        onSelect={() => handleSelect(item)}
                      >
                        <ListItem item={item} selected={isSelected} />
                      </CommandItem>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{item}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

// ─────────────────────────────────────────────
// BadgeSelect
// ─────────────────────────────────────────────

type BadgeSelectProps = {
  selectedItem?: string;
  setOpen: (open: boolean) => void;
  canEdit: boolean;
  itemLabel?: string;
  useDot: boolean;
  placeholder?: string;
  disabled?: boolean;
  forceImage?: boolean;
  variant: "ghost" | "outline";
  children?: React.ReactNode;
};

function BadgeSelect({
  disabled,
  variant,
  selectedItem,
  setOpen,
  canEdit,
  itemLabel,
  placeholder,
  children,
}: BadgeSelectProps) {
  const t = useTranslations("Common");
  const label = itemLabel ?? t("catalog.iconItem");
  const isDisabled = !canEdit || disabled;
  const handleClick = () => {
    if (!isDisabled) setOpen(true);
  };

  if (!selectedItem) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={handleClick}
        className={cn(disabled && "cursor-not-allowed animate-pulse")}
      >
        {placeholder ?? t("catalog.select", { item: label })}
        <ChevronDown className="size-4" />
      </Button>
    );
  }

  return (
    <>
      {children ? (
        <div onClick={handleClick}>{children}</div>
      ) : (
        <Button
          type="button"
          variant={variant}
          disabled={disabled}
          onClick={handleClick}
          className={
            "hover:cursor-pointer hover:underline [&_svg:not([class*='size-'])]:size-5"
          }
        >
          <ListItem item={selectedItem} />
          {canEdit && variant === "outline" && (
            <ChevronDown className="size-4" />
          )}
        </Button>
      )}
    </>
  );
}

function ListItem({ item, selected }: { item: string; selected?: boolean }) {
  const Icon = LucideIcons[
    item as keyof typeof LucideIcons
  ] as LucideIcons.LucideIcon;
  return (
    <div className={cn("flex items-center gap-2", selected && "font-semibold")}>
      <Icon size={18} strokeWidth={1.5} />
    </div>
  );
}
