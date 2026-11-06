import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Pressable, type PressableStateCallbackType } from "react-native";
import { useUniwind } from "uniwind";
import { TextClassContext } from "@/components/ui/text";
import { IconClassContext, IconSizeContext } from "@/components/ui/icon";
import { cn, withAlpha } from "@/lib/utils";
import { useThemeColors, type ThemeColorName } from "@/lib/theme-colors";

const buttonVariants = cva(
  "group shrink-0 flex-row items-center justify-center gap-2 rounded-2xl active:opacity-90",
  {
    variants: {
      variant: {
        default: "bg-primary",
        destructive: "bg-transparent",
        // Port of the shadcn outline to native:
        // - bg-card: direct (flat, no opacity).
        // - hover:bg-muted → active:bg-muted (there is no hover on touch;
        //   active: is the pressed state). hover:text-foreground is redundant
        //   (the text already is).
        // - dark:ring-input: no equivalent (there is no focus ring in native).
        // - dark:bg-input/30 and dark:hover:bg-input/50: opacity over a token
        //   → color-mix unsupported → handled via `style` in JS (see below).
        outline: "border border-border bg-card active:bg-muted",
        secondary: "bg-secondary",
        ghost: "bg-transparent active:bg-muted",
        link: "",
      },
      size: {
        default: "h-12 px-5",
        sm: "h-9 gap-1.5 px-3",
        lg: "h-14 px-6",
        icon: "h-11 w-11",
        "icon-sm": "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const buttonTextVariants = cva("text-sm font-inter-semibold text-foreground", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      destructive: "text-destructive",
      outline: "text-foreground",
      secondary: "text-secondary-foreground",
      ghost: "text-foreground",
      link: "text-primary underline",
    },
    size: {
      default: "",
      sm: "text-xs",
      lg: "text-base",
      icon: "",
      "icon-sm": "",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

// Token that paints each variant's TEXT (same source as
// buttonTextVariants): the icon reads the same resolved variable (see below).
const buttonIconTokens: Record<
  NonNullable<ButtonProps["variant"]>,
  ThemeColorName
> = {
  default: "primary-foreground",
  destructive: "destructive",
  outline: "foreground",
  secondary: "secondary-foreground",
  ghost: "foreground",
  link: "primary",
};

// Child icon size according to the button's `size`. Only icon sizes set it
// (18 = proportion of h-9); the rest inherits the default (20).
// An explicit <Icon> `size` always wins.
const buttonIconSizes: Partial<
  Record<NonNullable<ButtonProps["size"]>, number>
> = {
  "icon-sm": 18,
};

type ButtonProps = Omit<
  React.ComponentPropsWithoutRef<typeof Pressable>,
  "children"
> &
  VariantProps<typeof buttonVariants> & {
    children?: React.ReactNode;
  };

function Button({
  className,
  variant = "default",
  size = "default",
  style: styleProp,
  onPressIn,
  onPressOut,
  ...props
}: ButtonProps) {
  const v = variant ?? "default";
  // Colors RESOLVED by Uniwind's theme store — the same one that paints the
  // text — so icon and text cannot diverge, and it re-renders on theme change.
  const colors = useThemeColors();
  const iconColor = colors[buttonIconTokens[v]];
  // Effective theme straight from Uniwind (the owner of the active theme),
  // not from the RN hook, which can be stale relative to a manual theme.
  const isDark = useUniwind().theme === "dark";

  // Own pressed state (NOT Pressable's `style={(state) => ...}` callback):
  // the wrapper merges `style` with spread and a function inside gets lost
  // without being invoked — with it, the destructive tint and outline-dark
  // were dropped. Everything below is a plain object, which does survive the merge.
  type PressInHandler = NonNullable<
    React.ComponentProps<typeof Pressable>["onPressIn"]
  >;
  type PressOutHandler = NonNullable<
    React.ComponentProps<typeof Pressable>["onPressOut"]
  >;
  const [pressed, setPressed] = React.useState(false);
  const handlePressIn: PressInHandler = React.useCallback(
    (e) => {
      setPressed(true);
      onPressIn?.(e);
    },
    [onPressIn],
  );
  const handlePressOut: PressOutHandler = React.useCallback(
    (e) => {
      setPressed(false);
      onPressOut?.(e);
    },
    [onPressOut],
  );

  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <IconClassContext.Provider value={iconColor}>
        <IconSizeContext.Provider value={buttonIconSizes[size ?? "default"]}>
          <Pressable
            accessibilityRole="button"
            className={cn(
              buttonVariants({ variant, size }),
              props.disabled && "opacity-50",
              className,
            )}
            // `style` wins over className in Uniwind. Destructive tint (like
            // the badge) and the outline's dark translucents, as plain objects.
            // The caller's `style` goes last (if it is a function, it is
            // evaluated with our `pressed`, just as Pressable would).
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[
              v === "destructive"
                ? {
                    backgroundColor: withAlpha(colors.destructive, 0.1),
                  }
                : null,
              v === "outline" && isDark
                ? {
                    backgroundColor: withAlpha(colors.input, 0.1),
                  }
                : null,
              pressed && v === "outline" && isDark
                ? {
                    backgroundColor: withAlpha(colors.input, 0.2),
                  }
                : null,
              typeof styleProp === "function"
                ? styleProp(
                    { pressed, hovered: false } as PressableStateCallbackType,
                  )
                : styleProp,
            ]}
            {...props}
          />
        </IconSizeContext.Provider>
      </IconClassContext.Provider>
    </TextClassContext.Provider>
  );
}

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };
