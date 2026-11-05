"use client";

import * as SeparatorPrimitive from "@rn-primitives/separator";
import { cn } from "cn";

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px flex-1" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
