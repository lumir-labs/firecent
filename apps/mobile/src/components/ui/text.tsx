import { cn } from "@/lib/utils";
import { Slot } from "@rn-primitives/slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Platform, Text as RNText, type Role } from "react-native";

const textVariants = cva(
  cn(
    "text-foreground text-base font-inter-regular",
    Platform.select({ web: "select-text" }),
  ),
  {
    variants: {
      variant: {
        default: "",
        h1: cn(
          "text-4xl font-inter-extrabold tracking-tight pb-1",
          Platform.select({ web: "scroll-m-20 text-balance" }),
        ),
        h2: cn(
          "text-3xl font-inter-bold tracking-tight",
          Platform.select({ web: "scroll-m-20 first:mt-0" }),
        ),
        h3: cn(
          "text-2xl font-inter-semibold tracking-tight",
          Platform.select({ web: "scroll-m-20" }),
        ),
        h4: cn(
          "text-xl font-inter-semibold tracking-tight",
          Platform.select({ web: "scroll-m-20" }),
        ),
        p: "font-inter-regular",
        blockquote: "border-l-2 border-border pl-4 italic",
        code: "rounded bg-muted px-1.5 py-0.5 font-mono text-sm font-inter-semibold",
        lead: "text-xl text-muted-foreground",
        large: "text-lg font-inter-semibold",
        small: "text-sm font-inter-medium leading-none",
        muted: "text-sm text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type TextVariant = NonNullable<VariantProps<typeof textVariants>["variant"]>;

const ROLE: Partial<Record<TextVariant, Role>> = {
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  blockquote: Platform.select({ web: "blockquote" as Role }),
  code: Platform.select({ web: "code" as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  h1: "1",
  h2: "2",
  h3: "3",
  h4: "4",
};

const TextClassContext = React.createContext<string | undefined>(undefined);

type TextProps = React.ComponentPropsWithoutRef<typeof RNText> &
  VariantProps<typeof textVariants> & {
    asChild?: boolean;
  };

function Text({
  className,
  asChild = false,
  variant = "default",
  ...props
}: TextProps) {
  const textClass = React.useContext(TextClassContext);
  const Component = asChild ? Slot : RNText;
  return (
    <Component
      className={cn(textVariants({ variant }), textClass, className)}
      role={variant ? ROLE[variant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      {...props}
    />
  );
}

export { Text, TextClassContext, textVariants };
export type { TextProps };
