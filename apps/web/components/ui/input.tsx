import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({
  className,
  type,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & {
  /**
   * "touch" = Firecent N8: h-12, 12 px radius, 16 px text (avoids iOS zoom).
   * A number is still accepted and forwarded as the native `size` attribute.
   */
  size?: "default" | "touch" | number;
}) {
  const variant = typeof size === "number" ? "default" : size;
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      data-size={variant}
      size={typeof size === "number" ? size : undefined}
      className={cn(
        "bg-card h-9 w-full min-w-0 rounded-md border border-input px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        variant === "touch" &&
          "h-12 rounded-xl px-3.5 text-[16px] md:text-[16px]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
