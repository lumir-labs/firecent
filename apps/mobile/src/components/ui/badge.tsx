import { cva, type VariantProps } from "class-variance-authority";
import { View, type ViewProps } from "react-native";
import { TextClassContext } from "@/components/ui/text";

import { cn, withAlpha } from "@/lib/utils";
import { useThemeColor } from "@/lib/theme-colors";

const badgeVariants = cva(
  "w-fit shrink-0 flex-row items-center justify-center gap-1 rounded-full px-2.5 py-1",
  {
    variants: {
      variant: {
        default: "bg-primary",
        secondary: "bg-secondary",
        // No background class: the translucent one is injected via `style` (see below).
        destructive: "bg-transparent",
        outline: "border border-border bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const badgeTextVariants = cva("text-xs font-inter-medium", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-secondary-foreground",
      destructive: "text-destructive",
      outline: "text-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type BadgeProps = ViewProps & VariantProps<typeof badgeVariants>;


function Badge({ className, variant = "default", style, ...props }: BadgeProps) {
  const destructive = useThemeColor("destructive");
  return (
    <TextClassContext.Provider value={badgeTextVariants({ variant })}>
      <View
        className={cn(badgeVariants({ variant }), className)}
        // Do NOT use `bg-destructive/10`: Tailwind v4 compiles it to
        // `color-mix(in oklab, var(--destructive) 10%, transparent)` and the
        // native runtime (Uniwind) cannot resolve color-mix with
        // variables → the background stays transparent. It is computed in JS
        // from the resolved token so it follows the theme (light/dark/manual).
        // `style` takes precedence over className in Uniwind.
        style={[
          variant === "destructive"
            ? { backgroundColor: withAlpha(destructive, 0.1) }
            : null,
          style,
        ]}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
