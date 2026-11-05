"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";

export default function CopyButton({
  text,
  message,
}: {
  text: string;
  message?: string;
}) {
  const [isCopied, setIsCopied] = useState(false);
  const t = useTranslations("Common");

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    toast.success(message || t("copied"), {
      richColors: true,
    });
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  return (
    <Button size="sm" variant="outline" onClick={handleCopy} className="h-7">
      {isCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </Button>
  );
}
