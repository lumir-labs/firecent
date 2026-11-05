"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import GenericSelect from "@/components/base/base-dialog-select";
import GenericMultiSelect from "@/components/base/base-dialog-multiselect";
import type { UseCatalogFnResult } from "@/lib/general-types";
import { DatePicker } from "./date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import MinutesPicker, { formatMinutes } from "./minutes-picker";

// ─── Types ───────────────────────────────────

type TextInputType =
  | "text"
  | "textarea"
  | "date"
  | "time"
  | "number"
  | "minutes";

type BaseProps = {
  itemId: number | string;
  canEdit?: boolean;
  placeholder?: string;
};

export type FieldUpdateProps =
  | (BaseProps & {
      inputType?: TextInputType;
      current?: string | number | null | Date;
      updateFn: (
        id: number | string,
        value: string,
      ) => Promise<{ error?: string }>;
    })
  | (BaseProps & {
      inputType: "select";
      current?: number | string | null;
      updateFn: (
        id: number | string,
        value: number | string | undefined,
      ) => Promise<{ error?: string }>;
      useCatalogFn: () => UseCatalogFnResult;
      itemLabel: string;
      useDot?: boolean;
    })
  | (BaseProps & {
      inputType: "multiselect";
      current?: (number | string)[] | null;
      updateFn: (
        id: number | string,
        value: (number | string)[],
      ) => Promise<{ error?: string }>;
      useCatalogFn: () => UseCatalogFnResult;
      itemLabel: string;
      useDot?: boolean;
    });

// ─── Helpers ─────────────────────────────────

const toInputValue = (
  value: string | number | null | Date | undefined,
  type: TextInputType,
): string => {
  if (!value) return "";
  if (value instanceof Date) {
    const iso = value.toISOString();
    if (type === "date") return iso.split("T")[0];
    if (type === "time") return iso.split("T")[1].substring(0, 5);
    return iso;
  }
  if (typeof value === "string") {
    if (type === "date" && value.includes("T")) return value.split("T")[0];
    if (type === "time" && value.includes("T"))
      return value.split("T")[1].substring(0, 5);
  }
  return String(value);
};

const toSaveValue = (value: string | null, type: TextInputType): string => {
  if (!value) return "";
  if (type === "date") return `${value}T00:00:00.000Z`;
  if (type === "time")
    return `${new Date().toISOString().split("T")[0]}T${value}:00.000Z`;
  return value;
};

// ─── Core component ───────────────────────────

function FieldUpdateCore({
  itemId,
  canEdit = false,
  placeholder,
  current,
  inputType,
  catalog,
  ...props
}: FieldUpdateProps & { catalog: UseCatalogFnResult }) {
  const t = useTranslations("Common");
  const type = (inputType ?? "text") as
    | TextInputType
    | "select"
    | "multiselect";
  const isText = type !== "select" && type !== "multiselect";
  const { refresh } = useRouter();

  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [textValue, setTextValue] = useState<string | null>(() =>
    isText
      ? toInputValue(
          current as string | number | null | Date,
          type as TextInputType,
        )
      : "",
  );
  const [selectValue, setSelectValue] = useState<number | string | undefined>(
    type === "select" ? (current as number | string | undefined) : undefined,
  );
  const [multiValue, setMultiValue] = useState<(number | string)[]>(
    type === "multiselect"
      ? ((current as (number | string)[] | null) ?? [])
      : [],
  );

  const reset = () => {
    if (isText)
      setTextValue(
        toInputValue(
          current as string | number | null | Date,
          type as TextInputType,
        ),
      );
    else if (type === "select")
      setSelectValue(current as number | string | undefined);
    else setMultiValue((current as (number | string)[] | null) ?? []);
  };

  const hasChanged = () => {
    if (isText)
      return (
        textValue !==
        toInputValue(
          current as string | number | null | Date,
          type as TextInputType,
        )
      );
    if (type === "select")
      return selectValue !== (current as number | string | undefined);
    const prev = ((current as (number | string)[] | null) ?? [])
      .map(String)
      .sort();
    const next = multiValue.map(String).sort();
    return prev.length !== next.length || prev.some((v, i) => v !== next[i]);
  };

  const displayValue = useMemo(() => {
    if (type === "minutes") {
      return formatMinutes(textValue ? parseInt(textValue) : null);
    }
    if (isText) return textValue || placeholder || "-";
    if (type === "select") {
      return (
        catalog.data?.find((i) => String(i.id) === String(selectValue))
          ?.label ??
        placeholder ??
        "-"
      );
    }

    if (!multiValue.length) return placeholder || "-";
    return (
      catalog.data
        ?.filter((i) => multiValue.map(String).includes(String(i.id)))
        .map((i) => i.label)
        .join(", ") ||
      placeholder ||
      "-"
    );
  }, [
    isText,
    type,
    textValue,
    selectValue,
    multiValue,
    catalog.data,
    placeholder,
  ]);

  // Accepts an override so it doesn't depend on state
  const handleSave = async (overrideTextValue?: string | null) => {
    const valueToSave =
      overrideTextValue !== undefined ? overrideTextValue : textValue;

    const changed = isText
      ? valueToSave !==
        toInputValue(
          current as string | number | null | Date,
          type as TextInputType,
        )
      : hasChanged();

    if (!changed) {
      setOpen(false);
      return;
    }

    setIsLoading(true);
    setOpen(false);
    try {
      let result: { error?: string };
      if (isText) {
        result = await (
          props as {
            updateFn: (
              id: number | string,
              v: string,
            ) => Promise<{ error?: string }>;
          }
        ).updateFn(itemId, toSaveValue(valueToSave, type as TextInputType));
      } else if (type === "select") {
        result = await (
          props as {
            updateFn: (
              id: number | string,
              v: number | string | undefined,
            ) => Promise<{ error?: string }>;
          }
        ).updateFn(itemId, selectValue);
      } else {
        result = await (
          props as {
            updateFn: (
              id: number | string,
              v: (number | string)[],
            ) => Promise<{ error?: string }>;
          }
        ).updateFn(itemId, multiValue);
      }
      if (result?.error) throw new Error(result.error);
      toast.success(t("updated"));
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("unknownError"));
      reset();
    } finally {
      setIsLoading(false);
    }
  };

  function handleUpdate({ value }: { value: number | string | null }) {
    const strValue = value?.toString() || null;
    setTextValue(strValue);
    handleSave(strValue); // 👈 pass the direct value, don't wait for state
  }

  if (!canEdit) return <span className="truncate">{displayValue}</span>;

  const hasValue =
    displayValue !== "-" && displayValue !== (placeholder ?? "-");

  const renderInput = () => {
    if (type === "select") {
      const p = props as { itemLabel: string; useDot?: boolean };
      return (
        <GenericSelect
          value={selectValue}
          onChangeAction={setSelectValue}
          useCatalogFn={() => catalog}
          itemLabel={p.itemLabel}
          canEdit={!isLoading}
          useDot={p.useDot ?? false}
          placeholder={placeholder}
          disabled={isLoading}
        />
      );
    }

    if (type === "multiselect") {
      const p = props as { itemLabel: string; useDot?: boolean };
      return (
        <GenericMultiSelect
          value={multiValue}
          onChangeAction={setMultiValue}
          useCatalogFn={() => catalog}
          itemLabel={p.itemLabel}
          canEdit={!isLoading}
          useDot={p.useDot ?? false}
        />
      );
    }

    const className =
      "w-min py-1 px-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-black focus:border-black disabled:opacity-50";
    const commonProps = {
      value: textValue,
      placeholder,
      disabled: isLoading,
      autoFocus: true,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setTextValue(e.target.value),
    };

    if (type === "textarea") {
      return (
        <textarea
          {...commonProps}
          value={textValue || ""}
          rows={3}
          className={`${className} min-w-[200px]`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSave();
            }
            if (e.key === "Escape") {
              reset();
              setOpen(false);
            }
          }}
        />
      );
    }

    if (type === "minutes") {
      return (
        <MinutesPicker
          value={textValue ? parseInt(textValue) : null}
          onChange={(value) => {
            handleUpdate({ value: value ? value.toString() : null });
          }}
          disabled={isLoading}
        />
      );
    }

    if (type === "date") {
      return (
        <DatePicker
          date={textValue ? new Date(textValue) : undefined}
          onChange={(value) => {
            handleUpdate({ value: value?.toISOString().split("T")[0] || "" });
          }}
          disabled={isLoading}
        />
      );
    }

    return (
      <input
        {...commonProps}
        value={textValue || ""}
        type={type}
        className={className}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") {
            reset();
            setOpen(false);
          }
        }}
      />
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            type="button"
            disabled={isLoading}
            className="w-full"
          >
            <span
              className={
                hasValue ? "truncate" : "truncate text-muted-foreground"
              }
            >
              {displayValue}
            </span>
            <div
              className="flex items-center gap-1 text-muted-foreground group-hover:text-foreground"
              title={t("edit")}
            >
              {isLoading && <Loader2 size={16} className="animate-spin" />}
            </div>
          </Button>
        }
      />
      <PopoverContent
        align="start"
        sideOffset={-36}
        className={cn(
          "bg-background p-0",
          type !== "date" ? "h-9 max-w-[150px]" : "max-w-min",
        )}
      >
        {renderInput()}
      </PopoverContent>
    </Popover>
  );
}

// ─── Public API ───────────────────────────────

export function FieldUpdate(props: FieldUpdateProps) {
  if (props.inputType === "select" || props.inputType === "multiselect") {
    return <WithCatalog {...props} />;
  }
  return (
    <FieldUpdateCore
      {...props}
      catalog={{ data: [], isLoading: false, error: null }}
    />
  );
}

function WithCatalog(
  props: Extract<FieldUpdateProps, { inputType: "select" | "multiselect" }>,
) {
  const catalog = props.useCatalogFn();
  return <FieldUpdateCore {...props} catalog={catalog} />;
}
