"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import GenericSelect from "@/components/base/base-dialog-select";
import GenericMultiSelect from "@/components/base/base-dialog-multiselect";
import type { UseCatalogFnResult } from "@/lib/general-types";

// ─── Types ───────────────────────────────────

type TextInputType = "text" | "textarea" | "date" | "time" | "number";

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

const toSaveValue = (value: string, type: TextInputType): string => {
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

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [textValue, setTextValue] = useState(() =>
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

  // Sync when current changes externally
  useEffect(() => {
    if (!isEditing) reset();
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleSave = async () => {
    if (!hasChanged()) {
      setIsEditing(false);
      return;
    }
    setIsLoading(true);
    setIsEditing(false);
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
        ).updateFn(itemId, toSaveValue(textValue, type as TextInputType));
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
          rows={3}
          className={`${className} min-w-[200px]`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSave();
            }
            if (e.key === "Escape") {
              reset();
              setIsEditing(false);
            }
          }}
        />
      );
    }

    return (
      <input
        {...commonProps}
        type={type}
        className={className}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") {
            reset();
            setIsEditing(false);
          }
        }}
      />
    );
  };

  return (
    <div className="relative max-w-max">
      {isEditing ? (
        <div className="flex items-center gap-2">
          {renderInput()}
          <div className="flex items-center">
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
              className="p-1 text-green-600 hover:bg-muted rounded disabled:opacity-50"
              title={t("save")}
            >
              <Check size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setIsEditing(false);
              }}
              disabled={isLoading}
              className="p-1 text-red-600 hover:bg-muted rounded disabled:opacity-50"
              title={t("cancel")}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          disabled={isLoading}
          className="w-full flex cursor-pointer items-center gap-2 justify-between group px-1 py-1 hover:bg-muted rounded disabled:opacity-50"
        >
          <span
            className={hasValue ? "truncate" : "truncate text-muted-foreground"}
          >
            {displayValue}
          </span>
          <div
            className="flex items-center gap-1 text-muted-foreground group-hover:text-foreground"
            title={t("edit")}
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Pencil size={16} />
            )}
          </div>
        </button>
      )}
    </div>
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
