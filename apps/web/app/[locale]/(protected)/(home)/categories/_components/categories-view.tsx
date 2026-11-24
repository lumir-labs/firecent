"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, Palette, Plus, Tag, Trash2 } from "lucide-react";
import { trpc } from "@app/api/client";

import {
  CategoryIcon,
  PageHeader,
  localizeCategoryName,
} from "@/components/finance";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { firecentToast } from "@/components/ui/sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type CategoryType = "EXPENSE" | "INCOME";

type CategoryItem = {
  id: number;
  name: string;
  nameEn: string | null;
  nameEs: string | null;
  isSystem: boolean;
  icon: string | null;
  color: string | null;
  type: CategoryType;
  spendingNature: "DEBO" | "NECESITO" | "QUIERO" | null;
  parentId: number | null;
  _count: { records: number };
};

const COLOR_SWATCHES = [
  "#f97316", // orange
  "#ef4444", // red
  "#ec4899", // pink
  "#a855f7", // purple
  "#6366f1", // indigo
  "#3b82f6", // blue
  "#0284c7", // sky
  "#14b8a6", // teal
  "#10b981", // emerald
  "#84cc16", // lime
  "#eab308", // yellow
  "#64748b", // slate
] as const;

const ICON_OPTIONS = [
  "utensils",
  "shopping-cart",
  "coffee",
  "pizza",
  "bike",
  "car",
  "fuel",
  "bus",
  "house",
  "zap",
  "wifi",
  "shopping-bag",
  "shirt",
  "smartphone",
  "sofa",
  "heart-pulse",
  "pill",
  "dumbbell",
  "clapperboard",
  "ticket",
  "tv",
  "plane",
  "graduation-cap",
  "gift",
  "paw-print",
  "users",
  "heart-handshake",
  "briefcase",
  "banknote",
  "trending-up",
  "piggy-bank",
  "credit-card",
  "receipt",
  "tag",
] as const;

export function CategoriesView() {
  const locale = useLocale();
  const t = useTranslations("Categories");
  const tShell = useTranslations("Shell");
  const utils = trpc.useUtils();

  const [tab, setTab] = useState<CategoryType>("EXPENSE");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<number | null>(null);

  const query = trpc.categories.list.useQuery();
  const allCategories = (query.data ?? []) as CategoryItem[];

  const catLabel = (c: Pick<CategoryItem, "name" | "nameEn" | "nameEs">) =>
    localizeCategoryName(c, locale);

  const filtered = useMemo(
    () => allCategories.filter((c) => c.type === tab),
    [allCategories, tab],
  );

  const parents = useMemo(
    () =>
      filtered
        .filter((c) => c.parentId === null)
        .sort((a, b) => catLabel(a).localeCompare(catLabel(b), locale)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, locale],
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<number, CategoryItem[]>();
    for (const c of filtered) {
      if (c.parentId === null) continue;
      const arr = map.get(c.parentId) ?? [];
      arr.push(c);
      map.set(c.parentId, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => catLabel(a).localeCompare(catLabel(b), locale));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, locale]);

  const parentIdSet = useMemo(() => new Set(parents.map((p) => p.id)), [parents]);
  const orphans = useMemo(
    () =>
      filtered.filter((c) => c.parentId !== null && !parentIdSet.has(c.parentId)),
    [filtered, parentIdSet],
  );

  function openCreate(parentId: number | null = null) {
    setEditing(null);
    setDefaultParentId(parentId);
    setSheetOpen(true);
  }

  function openEdit(cat: CategoryItem) {
    setEditing(cat);
    setDefaultParentId(cat.parentId);
    setSheetOpen(true);
  }

  async function invalidateAll() {
    await Promise.all([
      utils.categories.list.invalidate(),
      utils.records.formOptions.invalidate(),
      utils.records.suggestions.invalidate(),
      utils.records.list.invalidate(),
      utils.dashboard.home.invalidate(),
    ]);
  }

  const restoreMutation = trpc.categories.restore.useMutation({
    onSuccess: async () => {
      await invalidateAll();
      firecentToast(t("form.restored"));
    },
  });

  return (
    <div className="flex flex-col gap-5 px-5 pt-2 pb-8 lg:px-0">
      <PageHeader
        title={t("title")}
        className="px-0"
        actions={
          <Button
            type="button"
            size="sm"
            onClick={() => openCreate(null)}
            className="h-9 gap-1.5 rounded-xl px-3"
          >
            <Plus className="size-4" aria-hidden />
            <span>{t("addCategory")}</span>
          </Button>
        }
      />

      <ToggleGroup
        variant="segmented"
        value={[tab]}
        onValueChange={(vals) => {
          const next = vals[0] as CategoryType | undefined;
          if (next) setTab(next);
        }}
        className="h-10 max-w-xs"
      >
        <ToggleGroupItem value="EXPENSE" className="flex-1 text-[13px]">
          {t("tabs.EXPENSE")}
        </ToggleGroupItem>
        <ToggleGroupItem value="INCOME" className="flex-1 text-[13px]">
          {t("tabs.INCOME")}
        </ToggleGroupItem>
      </ToggleGroup>

      {query.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : query.isError ? (
        <Card variant="plain" className="flex items-center justify-between p-4">
          <span className="text-[14px] text-muted-foreground">
            {query.error.message}
          </span>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            {t("retry")}
          </Button>
        </Card>
      ) : parents.length === 0 && orphans.length === 0 ? (
        <Card
          variant="plain"
          className="flex flex-col items-center gap-3 px-6 py-10 text-center"
        >
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Tag className="size-5" aria-hidden />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[15px] font-semibold">{t("emptyTitle")}</p>
            <p className="max-w-xs text-[13px] text-muted-foreground">
              {t("emptyBody")}
            </p>
          </div>
          <Button onClick={() => openCreate(null)} className="mt-1 rounded-xl">
            <Plus className="size-4" aria-hidden />
            <span>{t("addCategory")}</span>
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {parents.map((parent) => {
            const subs = childrenByParent.get(parent.id) ?? [];
            return (
              <Card
                key={parent.id}
                variant="plain"
                className="overflow-hidden divide-y"
              >
                <div className="flex items-center gap-2 pr-2">
                  <button
                    type="button"
                    onClick={() => openEdit(parent)}
                    className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/50"
                  >
                    <CategoryIcon
                      icon={parent.icon}
                      color={parent.color}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">
                        {catLabel(parent)}
                      </p>
                      {parent._count.records > 0 && (
                        <p className="num text-[12px] text-muted-foreground">
                          {t("recordsCount", {
                            count: String(parent._count.records),
                          })}
                        </p>
                      )}
                    </div>
                    <ChevronRight
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  </button>
                  {tab === "EXPENSE" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("addSubcategory")}
                      title={t("addSubcategory")}
                      onClick={() => openCreate(parent.id)}
                      className="shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="size-4" aria-hidden />
                    </Button>
                  )}
                </div>

                {subs.length > 0 && (
                  <div className="divide-y bg-muted/20">
                    {subs.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => openEdit(sub)}
                        className="flex min-h-12 w-full items-center gap-3 py-2 pr-4 pl-8 text-left transition-colors hover:bg-accent/50"
                      >
                        <CategoryIcon
                          icon={sub.icon}
                          color={sub.color ?? parent.color}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium">
                            {catLabel(sub)}
                          </p>
                          {sub._count.records > 0 && (
                            <p className="num text-[12px] text-muted-foreground">
                              {t("recordsCount", {
                                count: String(sub._count.records),
                              })}
                            </p>
                          )}
                        </div>
                        <ChevronRight
                          aria-hidden
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}

          {orphans.length > 0 && (
            <Card variant="plain" className="divide-y overflow-hidden">
              {orphans.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => openEdit(cat)}
                  className="flex min-h-13 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/50"
                >
                  <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">
                      {catLabel(cat)}
                    </p>
                    {cat._count.records > 0 && (
                      <p className="num text-[12px] text-muted-foreground">
                        {t("recordsCount", {
                          count: String(cat._count.records),
                        })}
                      </p>
                    )}
                  </div>
                  <ChevronRight
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </button>
              ))}
            </Card>
          )}
        </div>
      )}

      <ResponsiveSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editing ? t("form.editTitle") : t("form.addTitle")}
        closeLabel={tShell("close")}
        desktop="dialog"
      >
        {sheetOpen ? (
          <CategoryFormBody
            editing={editing}
            defaultType={tab}
            defaultParentId={defaultParentId}
            parents={parents}
            childCount={
              editing ? (childrenByParent.get(editing.id)?.length ?? 0) : 0
            }
            onClose={() => setSheetOpen(false)}
            onMutated={invalidateAll}
            onDeleted={(id, childIds) => {
              firecentToast(t("form.deleted"), {
                action: {
                  label: t("form.undo"),
                  onClick: () => restoreMutation.mutate({ id, childIds }),
                },
              });
            }}
          />
        ) : null}
      </ResponsiveSheet>
    </div>
  );
}

function CategoryFormBody({
  editing,
  defaultType,
  defaultParentId,
  parents,
  childCount,
  onClose,
  onMutated,
  onDeleted,
}: {
  editing: CategoryItem | null;
  defaultType: CategoryType;
  defaultParentId: number | null;
  parents: CategoryItem[];
  childCount: number;
  onClose: () => void;
  onMutated: () => Promise<void>;
  onDeleted: (id: number, childIds: number[]) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("Categories");

  const defaultParent = parents.find((p) => p.id === defaultParentId);

  const [type, setType] = useState<CategoryType>(editing?.type ?? defaultType);
  const [name, setName] = useState(() =>
    editing ? localizeCategoryName(editing, locale) : "",
  );
  const [parentId, setParentId] = useState<string>(
    editing?.parentId
      ? String(editing.parentId)
      : defaultParentId
        ? String(defaultParentId)
        : "",
  );
  const [color, setColor] = useState<string>(
    editing?.color ?? defaultParent?.color ?? "#6366f1",
  );
  const [icon, setIcon] = useState<string>(
    editing?.icon ?? defaultParent?.icon ?? "tag",
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createMutation = trpc.categories.create.useMutation({
    onSuccess: async () => {
      await onMutated();
      firecentToast(t("form.created"));
      onClose();
    },
    onError: (err) => setErrorMsg(err.message),
  });

  const updateMutation = trpc.categories.update.useMutation({
    onSuccess: async () => {
      await onMutated();
      firecentToast(t("form.updated"));
      onClose();
    },
    onError: (err) => {
      setErrorMsg(
        err.data?.code === "CONFLICT" ? t("form.duplicateError") : err.message,
      );
    },
  });

  const deleteMutation = trpc.categories.delete.useMutation({
    onSuccess: async (res) => {
      await onMutated();
      onClose();
      onDeleted(res.id, res.deletedChildIds);
    },
    onError: (err) => setErrorMsg(err.message),
  });

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  const eligibleParents = parents.filter((p) => p.id !== editing?.id);
  const canChangeParent =
    type === "EXPENSE" && childCount === 0 && eligibleParents.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isPending) return;
    setErrorMsg(null);

    const parsedParentId =
      canChangeParent && parentId ? Number(parentId) : null;

    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        name: trimmed,
        parentId: canChangeParent ? parsedParentId : undefined,
        color,
        icon,
      });
      return;
    }

    createMutation.mutate({
      name: trimmed,
      type,
      parentId: parsedParentId,
      color,
      icon,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5">
      {/* Live preview */}
      <div className="flex items-center gap-3 rounded-2xl border bg-muted/25 p-3">
        <CategoryIcon icon={icon} color={color} size="md" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">
            {name.trim() || t("form.namePlaceholder")}
          </p>
          <p className="text-[12px] text-muted-foreground">
            {t(`tabs.${type}`)}
          </p>
        </div>
      </div>

      {!editing && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-muted-foreground">
            {t("form.type")}
          </label>
          <ToggleGroup
            variant="segmented"
            value={[type]}
            onValueChange={(vals) => {
              const next = vals[0] as CategoryType | undefined;
              if (next) {
                setType(next);
                if (next === "INCOME") setParentId("");
              }
            }}
            className="h-10"
          >
            <ToggleGroupItem value="EXPENSE" className="flex-1 text-[13px]">
              {t("tabs.EXPENSE")}
            </ToggleGroupItem>
            <ToggleGroupItem value="INCOME" className="flex-1 text-[13px]">
              {t("tabs.INCOME")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-muted-foreground">
          {t("form.name")}
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("form.namePlaceholder")}
          maxLength={60}
          className="h-11 rounded-xl text-[15px]"
          required
        />
      </div>

      {canChangeParent && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-muted-foreground">
            {t("form.parent")}
          </label>
          <select
            value={parentId}
            onChange={(e) => {
              const nextId = e.target.value;
              setParentId(nextId);
              if (!editing && nextId) {
                const p = eligibleParents.find((x) => String(x.id) === nextId);
                if (p?.color) setColor(p.color);
              }
            }}
            className="h-11 rounded-xl border bg-card px-3 text-[14px] outline-none focus:border-primary"
          >
            <option value="">{t("form.topLevel")}</option>
            {eligibleParents.map((p) => (
              <option key={p.id} value={p.id}>
                {localizeCategoryName(p, locale)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Color picker */}
      <div className="flex flex-col gap-2">
        <label className="text-[13px] font-medium text-muted-foreground">
          {t("form.color")}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {COLOR_SWATCHES.map((hex) => {
            const active = color.toLowerCase() === hex.toLowerCase();
            return (
              <button
                key={hex}
                type="button"
                aria-label={hex}
                onClick={() => setColor(hex)}
                style={{ backgroundColor: hex }}
                className={cn(
                  "size-7 rounded-full transition-transform",
                  active
                    ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card"
                    : "hover:scale-105",
                )}
              />
            );
          })}
          <label
            aria-label={t("form.customColor")}
            title={t("form.customColor")}
            className="relative flex size-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-muted-foreground/60 text-muted-foreground hover:border-foreground hover:text-foreground"
          >
            <Palette className="size-3.5" aria-hidden />
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#6366f1"}
              onChange={(e) => setColor(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>

      {/* Icon picker */}
      <div className="flex flex-col gap-2">
        <label className="text-[13px] font-medium text-muted-foreground">
          {t("form.icon")}
        </label>
        <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-9">
          {ICON_OPTIONS.map((slug) => {
            const active = icon === slug;
            return (
              <button
                key={slug}
                type="button"
                aria-label={slug}
                onClick={() => setIcon(slug)}
                className={cn(
                  "flex items-center justify-center rounded-xl p-1 transition-all",
                  active
                    ? "ring-2 ring-primary bg-primary/10"
                    : "hover:bg-accent",
                )}
              >
                <CategoryIcon
                  icon={slug}
                  color={active ? color : undefined}
                  size="sm"
                />
              </button>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <p className="text-[13px] text-destructive">{errorMsg}</p>
      )}

      <Button
        type="submit"
        size="touch"
        disabled={!name.trim() || isPending}
        className="w-full"
      >
        {isPending
          ? t("form.saving")
          : editing
            ? t("form.save")
            : t("form.create")}
      </Button>

      {editing && (
        <div className="border-t pt-3">
          {!confirmDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="touch"
              onClick={() => setConfirmDelete(true)}
              className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
              <span>{t("form.delete")}</span>
            </Button>
          ) : (
            <div className="flex flex-col gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-[13px] text-muted-foreground">
                {childCount > 0
                  ? t("form.deleteWithChildrenHint", {
                      count: String(childCount),
                    })
                  : t("form.deleteHint")}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  className="h-9 flex-1 rounded-xl"
                >
                  {t("form.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate({ id: editing.id })}
                  className="h-9 flex-1 rounded-xl"
                >
                  {t("form.deleteConfirm")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
