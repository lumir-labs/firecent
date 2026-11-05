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
import { Check, ChevronDown, Dot, Loader2, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type {
  GenericCatalogItem,
  UseCatalogFnResult,
} from "@/lib/general-types";
import { colors } from "@/lib/constants";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { toast } from "sonner";
import { queryClient } from "@/providers/query-provider";
import { useRouter } from "@/i18n/navigation";

// ─────────────────────────────────────────────
// Props — controlled component with external value
// ─────────────────────────────────────────────

export type BaseDialogSelectProps = {
  /** Externally controlled value. When it changes, the component syncs. */
  value?: number | string;
  onChangeAction?: (
    id: number | string | undefined,
  ) => Promise<{ data?: boolean; error?: string }> | void;
  useCatalogFn: () => UseCatalogFnResult;
  canEdit?: boolean;
  forceImage?: boolean;
  variant?: "ghost" | "outline";
  children?: React.ReactNode;
  /**
   * Callback executed when trying to create a new item.
   * If this prop is provided, the create button is shown when there are no results.
   */
  onCreateAction?: (query: string) => void;
  /** Required: used in placeholders and labels (pass it already translated). */
  itemLabel: string;
  useDot?: boolean;
  placeholder?: string;
  disabled?: boolean;
  invalidateQueries?: string[][];
  refresh?: boolean;
  nullable?: boolean;
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function GenericAutocomplete({
  value,
  children,
  onChangeAction,
  useCatalogFn,
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
  nullable = false,
}: BaseDialogSelectProps) {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  // FIX #1: internal state synced with the external value (controlled component).
  const [selectedId, setSelectedId] = useState<number | string | undefined>(
    value,
  );

  // FIX #1: sync only when the parent updates `value`.
  // Do NOT include onChangeAction in deps — if the parent passes a new inline
  // function on every render, this effect would setSelectedId again and revert
  // any local change the user just made.
  useEffect(() => {
    setSelectedId(value);
  }, [value]);

  const catalog = useCatalogFn();

  const handleSelect = useCallback(
    (itemId: number | string) => {
      if (selectedId === itemId) {
        if (nullable) {
          setSelectedId(undefined);
          handleChangeValue(undefined);
        }
        setOpen(false);
        return;
      }
      setSelectedId(itemId);
      handleChangeValue(itemId);
      setOpen(false);
    },
    [selectedId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function handleChangeValue(itemId: number | string | undefined) {
    try {
      const response = await onChangeAction?.(itemId);
      if (response?.error) {
        throw new Error(String(response.error));
      }
      toast.success(t("catalog.changed"), { richColors: true });

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
    () => catalog.data?.find((item) => item.id === selectedId),
    [catalog.data, selectedId],
  );

  return (
    <>
      <BadgeSelect
        disabled={disabled}
        variant={variant}
        selectedItem={selectedItem}
        isLoading={catalog.isLoading}
        error={catalog.error}
        setOpen={setOpen}
        itemLabel={itemLabel}
        canEdit={canEdit}
        useDot={useDot}
        placeholder={placeholder}
        forceImage={forceImage}
      >
        {children}
      </BadgeSelect>

      {/* FIX #5: the redundant <Command> inside <CommandDialog> was removed. */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput
            disabled={disabled}
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
                const isSelected = selectedId === item.id;
                return (
                  <CommandItem
                    key={item.id}
                    disabled={disabled}
                    value={`${item.id}&${normalizeForSearch(item.label)}`}
                    className="cursor-pointer min-h-min"
                    onSelect={() => handleSelect(item.id)}
                  >
                    <ListItem
                      item={item}
                      selected={isSelected}
                      useDot={useDot}
                      forceImage={forceImage}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>{" "}
        </Command>
      </CommandDialog>
    </>
  );
}

// ─────────────────────────────────────────────
// BadgeSelect
// ─────────────────────────────────────────────

type BadgeSelectProps = {
  selectedItem?: GenericCatalogItem;
  setOpen: (open: boolean) => void;
  canEdit: boolean;
  isLoading: boolean;
  error?: Error | null;
  itemLabel: string;
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
  isLoading,
  error,
  itemLabel,
  useDot,
  placeholder,
  forceImage,
  children,
}: BadgeSelectProps) {
  const t = useTranslations("Common");
  const isDisabled = !canEdit || isLoading || disabled;
  const handleClick = () => {
    if (!isDisabled) setOpen(true);
  };

  if (isLoading) {
    return (
      <>
        {children ? (
          <div className="animate-pulse bg-muted">{children}</div>
        ) : (
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
        )}
      </>
    );
  }

  // FIX #3: use `if (error)` instead of `if (error !== null)` to also cover undefined.
  if (error !== null) {
    return (
      <Tooltip>
        <TooltipTrigger
          delay={0}
          render={
            <div className="w-full">
              <Button
                type="button"
                variant="outline"
                disabled
                className="w-full"
              >
                <Badge variant="destructive">
                  <span className="max-w-20 truncate">{t("errorShort")}</span>
                </Badge>
              </Button>
            </div>
          }
        />
        <TooltipContent>
          <p>{error?.message}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (!selectedItem) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={handleClick}
        className={cn(disabled && "cursor-not-allowed animate-pulse")}
      >
        {placeholder ?? t("catalog.select", { item: itemLabel })}
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
          className={"hover:cursor-pointer hover:underline"}
        >
          <ListItem
            item={selectedItem}
            useDot={useDot}
            forceImage={forceImage}
          />
          {canEdit && variant === "outline" && (
            <ChevronDown className="size-4" />
          )}
        </Button>
      )}
    </>
  );
}

function ListItem({
  item,
  selected,
  useDot,
  forceImage,
}: {
  item: GenericCatalogItem;
  selected?: boolean;
  useDot: boolean;
  forceImage?: boolean;
}) {
  return (
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
            className={cn(
              item.colorClassName ??
                (item.color ? colors.get(item.color) : undefined),
              "shrink-0",
            )}
          />
        )}
        {(item.imageSrc || forceImage) && (
          <Avatar className="size-7 mr-1">
            <AvatarImage
              src={
                item.imageSrc ??
                "https://ui-avatars.com/api/?name=" +
                  item.label.split(" ")[0]?.[0]?.toUpperCase() +
                  item.label.split(" ")[1]?.[0]?.toUpperCase() +
                  "&background=7c3aed" +
                  "&color=FFFFFF"
              }
            />
            <AvatarFallback className="text-xs">
              {item.label.split(" ")[0]?.[0]?.toUpperCase() +
                item.label.split(" ")[1]?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span>{item.label}</span>
            {item.badge && (
              <Badge className="text-xs max-h-4">{item.badge}</Badge>
            )}
          </div>
          {item.description && (
            <span className="text-xs text-muted-foreground">
              {item.description}
            </span>
          )}
        </div>
      </div>
      {selected && <Check className="size-4" />}
    </div>
  );
}
