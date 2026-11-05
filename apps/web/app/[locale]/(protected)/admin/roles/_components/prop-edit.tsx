"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { type Role, updateRole } from "@/lib/actions/roles";

export function TextFieldUpdate({
  current,
  prop,
  role,
}: {
  current: string;
  placeholder?: string;
  prop: keyof Role;
  role: Role;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const tAdmin = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const [value, setValue] = useState(current);

  async function handleSave() {
    try {
      setIsEditing(false);
      const result = await updateRole({
        id: role.id,
        prop,
        value,
      });
      if ("error" in result) {
        toast.error(result.error, {
          richColors: true,
        });
        return;
      }
      toast.success(tCommon("updated"), {
        richColors: true,
      });
    } catch {
      toast.error(tAdmin("roles.propEdit.updateError"), {
        richColors: true,
      });
      setValue(current);
    }
  }

  const handleCancel = () => {
    setValue(current);
    setIsEditing(false);
  };

  return (
    <div className="relative max-w-max">
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            value={value}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSave();
              }
            }}
            onChange={(e) => setValue(e.target.value)}
            className="w-min py-1 px-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
            autoFocus
          />
          <div className="flex items-center">
            <button
              type="button"
              onClick={handleSave}
              className="p-1 text-green-600 hover:bg-muted rounded"
              title={tCommon("save")}
            >
              <Check size={16} />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1 text-red-600 hover:bg-muted rounded"
              title={tCommon("cancel")}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="flex cursor-pointer items-center gap-2 justify-between group w-full px-1 py-1 hover:bg-muted rounded"
        >
          <span className="truncate">{value}</span>
          <div
            className="flex items-center gap-1 group text-muted-foreground hover:text-muted-foreground"
            title={tCommon("edit")}
          >
            <Pencil size={16} />
            <p className="transition-all text-xs duration-200 group-hover:opacity-100 opacity-0 ease-in">
              {tCommon("edit")}
            </p>
          </div>
        </button>
      )}
    </div>
  );
}
