"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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
import { Check, ChevronDown, Dot, Loader2, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { Color } from "@/lib/general-types";
import { colors } from "@/lib/constants";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type GenericCatalogItem = {
  id: number | string;
  label: string;
  color?: Color;
  colorClassName?: string;
};

export type UseCatalogFnResult = {
  data: GenericCatalogItem[];
  isLoading: boolean;
  error: Error | null;
};

export type GenericMultiSelectProps = {
  /** Externally controlled value. When it changes, the component syncs. */
  value?: (number | string)[];
  onChangeAction?: (ids: (number | string)[]) => void;
  useCatalogFn: () => UseCatalogFnResult;
  canEdit?: boolean;
  /**
   * Callback executed when trying to create a new item.
   * If this prop is provided, the create button is shown when there are no results.
   */
  onCreateAction?: (query: string) => void;
  /** Required: used in placeholders and labels (pass it already translated). */
  itemLabel: string;
  useDot?: boolean;
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function GenericMultiSelect({
  value,
  onChangeAction,
  useCatalogFn,
  canEdit = true,
  onCreateAction,
  itemLabel,
  useDot = false,
}: GenericMultiSelectProps) {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // FIX #1: internal state initialized from value (controlled component).
  const [selectedIds, setSelectedIds] = useState<(number | string)[]>(
    value ?? [],
  );

  // FIX #1: sync when the parent updates `value`.
  useEffect(() => {
    setSelectedIds(value ?? []);
  }, [value]);

  const catalog = useCatalogFn();

  // FIX #6: memoized Set for O(1) lookups instead of .map(String).includes() O(n) per item.
  const selectedIdSet = useMemo(
    () => new Set(selectedIds.map(String)),
    [selectedIds],
  );

  // FIX #5: onChangeAction is called with the new selection correctly.
  const handleToggleItem = useCallback(
    (id: number | string) => {
      const idStr = String(id);
      const isSelected = selectedIdSet.has(idStr);

      const newSelection = isSelected
        ? selectedIds.filter((i) => String(i) !== idStr)
        : [...selectedIds, id];

      setSelectedIds(newSelection);
      onChangeAction?.(newSelection);
    },
    [selectedIds, selectedIdSet, onChangeAction],
  );

  const handleCreate = useCallback(() => {
    onCreateAction?.(searchQuery);
    setOpen(false);
  }, [onCreateAction, searchQuery]);

  // FIX #7: useMemo instead of useCallback + immediate call.
  const selectedData = useMemo(
    () =>
      catalog.data?.filter((item) => selectedIdSet.has(String(item.id))) ?? [],
    [catalog.data, selectedIdSet],
  );

  return (
    <>
      <BadgeSelect
        selectedData={selectedData}
        catalogLength={catalog.data?.length ?? 0}
        isLoading={catalog.isLoading}
        error={catalog.error}
        setOpen={setOpen}
        itemLabel={itemLabel}
        canEdit={canEdit}
        useDot={useDot}
      />

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput
            placeholder={t("catalog.search", {
              item: itemLabel.toLowerCase(),
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
              {catalog.data?.map((item) => {
                // FIX #6: O(1) lookup using the memoized Set.
                const isSelected = selectedIdSet.has(String(item.id));
                return (
                  <CommandItem
                    key={String(item.id)}
                    value={`${item.id}&${normalizeForSearch(item.label)}`}
                    className="max-h-9 cursor-pointer"
                    onSelect={() => handleToggleItem(item.id)}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <div
                        className={cn(
                          "text-sm flex items-center gap-0.5 font-semibold",
                          item.colorClassName
                            ? `${item.colorClassName} pr-2 ${useDot ? "pl-1" : "pl-2"} py-0.5 rounded-full`
                            : item.color &&
                                `${colors.get(item.color)} pr-2 ${useDot ? "pl-1" : "pl-2"} py-0.5 rounded-full`,
                        )}
                      >
                        {(item.color || item.colorClassName) && useDot && (
                          <Dot
                            className={
                              item.colorClassName ??
                              (item.color ? colors.get(item.color) : undefined)
                            }
                          />
                        )}
                        <span>{item.label}</span>
                      </div>
                      {isSelected && <Check className="size-4" />}
                    </div>
                  </CommandItem>
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
  selectedData: GenericCatalogItem[];
  setOpen: (open: boolean) => void;
  canEdit: boolean;
  catalogLength: number;
  isLoading: boolean;
  error?: Error | null;
  itemLabel: string;
  useDot: boolean;
};

function BadgeSelect({
  selectedData,
  setOpen,
  canEdit,
  catalogLength,
  isLoading,
  error,
  itemLabel,
  useDot,
}: BadgeSelectProps) {
  const t = useTranslations("Common");
  const disabled = !canEdit || isLoading;
  const handleClick = () => {
    if (!disabled) setOpen(true);
  };

  if (isLoading) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled
        className="cursor-not-allowed opacity-50 animate-pulse bg-muted"
      >
        <Loader2 className="animate-spin" />
        {t("catalog.loading")}
        <ChevronDown className="size-4" />
      </Button>
    );
  }

  // FIX #3: `if (error)` instead of `if (error !== null)` to also cover undefined.
  if (error) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled
        className="cursor-not-allowed pointer-events-none opacity-50"
      >
        <Badge variant="destructive">
          <span className="max-w-[80px] truncate">{t("errorShort")}</span>
        </Badge>
        {error.message}
      </Button>
    );
  }

  if (!selectedData.length) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={handleClick}
        className={cn(disabled && "cursor-not-allowed animate-pulse")}
      >
        {t("catalog.select", { item: itemLabel })}
        <ChevronDown className="size-4" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      className="flex gap-2 p-0 px-2"
      variant="outline"
      disabled={disabled}
      onClick={handleClick}
    >
      {catalogLength === selectedData.length ? (
        <Badge key="all">
          <span className="max-w-[80px] truncate">{t("catalog.all")}</span>
        </Badge>
      ) : (
        <>
          {selectedData.slice(0, 2).map((item) => (
            <Badge key={String(item.id)}>
              {(item.color || item.colorClassName) && useDot && (
                <Dot className="size-3" />
              )}
              <span className="max-w-[80px] truncate">{item.label}</span>
            </Badge>
          ))}
          {selectedData.length > 2 && (
            <Badge key="more">
              <span className="max-w-[80px] truncate">
                {t("catalog.more", { count: String(selectedData.length - 2) })}
              </span>
            </Badge>
          )}
        </>
      )}
      {canEdit && <Plus className="size-4" />}
    </Button>
  );
}
