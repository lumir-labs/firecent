"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, ArrowLeft } from "lucide-react";

export default function Unauthorized() {
  const t = useTranslations("Common");
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center bg-card p-8 rounded-xl shadow-lg">
        <div className="flex justify-center">
          <div className="bg-red-100 dark:bg-red-900 p-3 rounded-full">
            <AlertTriangle
              size={40}
              className="text-red-500 dark:text-red-50 pb-0.5"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-card-foreground">
            {t("unauthorized.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("unauthorized.description")}
          </p>
        </div>

        <div className="pt-2 border-t">
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <Link href="/" passHref className="flex-1">
              <Button className="w-full font-medium py-2 flex items-center justify-center gap-2">
                <Home size={16} />
                <span>{t("unauthorized.home")}</span>
              </Button>
            </Link>
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="flex-1 border-gray-300 hover:bg-gray-100 text-muted-foreground font-medium py-2 flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              <span>{t("unauthorized.back")}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
