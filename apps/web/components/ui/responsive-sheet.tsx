"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { Drawer as DrawerPrimitive } from "vaul"

import { Button } from "@/components/ui/button"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"

type ResponsiveSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Accessible name of the sheet (aria-labelledby). */
  title: string
  /** Visually hide the title (e.g. the quick-add sheet has no title bar). */
  hideTitle?: boolean
  /** Optional description (aria-describedby). */
  description?: string
  /** Desktop (>= 1024 px) presentation: 480 px dialog or 420 px right panel. */
  desktop?: "dialog" | "panel"
  /** aria-label of the close button; pass the translated string. */
  closeLabel?: string
  className?: string
  children: React.ReactNode
}

const SHEET_SHADOW = "shadow-[0_-8px_30px_-12px_rgb(11_18_32/0.25)]"
const SCRIM = "bg-[#0b1220]/50"

/**
 * Firecent N6. Bottom drawer below 1024 px; dialog or side panel from `lg`.
 * Focus is trapped, Esc closes, and the title labels the dialog.
 */
function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  hideTitle = false,
  description,
  desktop = "dialog",
  closeLabel = "Close",
  className,
  children,
}: ResponsiveSheetProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)")

  const header = (
    Title: React.ElementType,
    titleProps: Record<string, unknown> = {}
  ) => (
    <div
      data-slot="responsive-sheet-header"
      className={cn(
        "flex h-14 shrink-0 items-center justify-between gap-3 px-5",
        hideTitle && "justify-end"
      )}
    >
      <Title
        {...titleProps}
        className={cn(
          "min-w-0 truncate text-[17px] font-semibold",
          hideTitle && "sr-only"
        )}
      >
        {title}
      </Title>
      {isDesktop ? (
        <DialogPrimitive.Close
          render={
            <Button
              variant="ghost"
              size="icon-touch"
              aria-label={closeLabel}
            />
          }
        >
          <X aria-hidden />
        </DialogPrimitive.Close>
      ) : (
        <DrawerPrimitive.Close asChild>
          <Button variant="ghost" size="icon-touch" aria-label={closeLabel}>
            <X aria-hidden />
          </Button>
        </DrawerPrimitive.Close>
      )}
    </div>
  )

  if (isDesktop) {
    const panel = desktop === "panel"
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop
            data-slot="responsive-sheet-overlay"
            className={cn(
              "fixed inset-0 z-40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
              SCRIM
            )}
          />
          <DialogPrimitive.Popup
            data-slot="responsive-sheet"
            data-presentation={desktop}
            className={cn(
              "fixed z-50 flex flex-col bg-card text-sm text-card-foreground outline-none transition duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
              panel
                ? "inset-y-0 right-0 w-[420px] max-w-full border-l shadow-lg data-ending-style:translate-x-4 data-starting-style:translate-x-4"
                : "top-1/2 left-1/2 max-h-[calc(100dvh-4rem)] w-[480px] max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl shadow-lg data-ending-style:scale-95 data-starting-style:scale-95",
              className
            )}
          >
            {header(DialogPrimitive.Title)}
            {description ? (
              <DialogPrimitive.Description className="px-5 pb-2 text-sm text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto pb-8">
              {children}
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    )
  }

  return (
    <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay
          data-slot="responsive-sheet-overlay"
          className={cn("fixed inset-0 z-40", SCRIM)}
        />
        <DrawerPrimitive.Content
          data-slot="responsive-sheet"
          data-presentation="drawer"
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-[430px] flex-col rounded-t-3xl bg-card text-sm text-card-foreground outline-none",
            SHEET_SHADOW,
            className
          )}
        >
          <div
            aria-hidden
            className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/30"
          />
          {header(DrawerPrimitive.Title)}
          {description ? (
            <DrawerPrimitive.Description className="px-5 pb-2 text-sm text-muted-foreground">
              {description}
            </DrawerPrimitive.Description>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto pb-8">{children}</div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  )
}

export { ResponsiveSheet }
export type { ResponsiveSheetProps }
