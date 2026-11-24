"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { AddTransactionSheet } from "@/components/finance/add-transaction/add-transaction-sheet";

export type SwitcherSpace = {
  id: string;
  name: string;
  slug?: string | null;
};

type ShellContextValue = {
  spaces: SwitcherSpace[];
  activeSpaceId: string | null;
  activeSpace: SwitcherSpace | null;
  isAddOpen: boolean;
  openAddTransaction: (opts?: { accountId?: number; editId?: number }) => void;
  closeAddTransaction: () => void;
  defaultAccountId: number | undefined;
  editRecordId: number | undefined;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error("useShell must be used inside ShellProvider");
  }
  return ctx;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true']"));
}

export function ShellProvider({
  spaces,
  activeSpaceId,
  children,
}: {
  spaces: SwitcherSpace[];
  activeSpaceId: string | null;
  children: ReactNode;
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [defaultAccountId, setDefaultAccountId] = useState<number | undefined>();
  const [editRecordId, setEditRecordId] = useState<number | undefined>();

  const openAddTransaction = useCallback(
    (opts?: { accountId?: number; editId?: number }) => {
      setDefaultAccountId(opts?.accountId);
      setEditRecordId(opts?.editId);
      setIsAddOpen(true);
    },
    [],
  );

  const closeAddTransaction = useCallback(() => {
    setIsAddOpen(false);
    setDefaultAccountId(undefined);
    setEditRecordId(undefined);
  }, []);

  // Desktop shortcut: `N` opens quick-add when not typing in an input.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableElement(e.target)) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        openAddTransaction();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openAddTransaction]);

  const activeSpace = useMemo(
    () => spaces.find((s) => s.id === activeSpaceId) ?? spaces[0] ?? null,
    [spaces, activeSpaceId],
  );

  const value = useMemo<ShellContextValue>(
    () => ({
      spaces,
      activeSpaceId,
      activeSpace,
      isAddOpen,
      openAddTransaction,
      closeAddTransaction,
      defaultAccountId,
      editRecordId,
    }),
    [
      spaces,
      activeSpaceId,
      activeSpace,
      isAddOpen,
      openAddTransaction,
      closeAddTransaction,
      defaultAccountId,
      editRecordId,
    ],
  );

  return (
    <ShellContext.Provider value={value}>
      {children}
      <AddTransactionSheet
        open={isAddOpen}
        onOpenChange={(open) => {
          if (!open) closeAddTransaction();
          else setIsAddOpen(true);
        }}
        defaultAccountId={defaultAccountId}
        editRecordId={editRecordId}
      />
    </ShellContext.Provider>
  );
}
