import * as React from "react";
import { View, type ViewProps } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";

import { cn, withAlpha } from "@/lib/utils";
import { Text, TextClassContext } from "@/components/ui/text";
import { IconClassContext } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { semanticTokens } from "@app/lib/tokens/semantic";

// shadcn-style InputGroup: box with input + addons (icons, text, buttons).
// Port with mandatory native adaptations:
//
// - No `:has()` / `group-data-*` / `data-*` selectors (they do not exist in
//   native): the control's focus is reported via context (ring border) and
//   states by static tree inspection (see below).
// - No `/opacity` (color-mix unsupported): translucents via `style` in JS.
// - No `calc()` in radii: `rounded-lg` container (verified).
// - No `InputGroupTextarea`: requires the Textarea component (not in the
//   kit; added together with it).
//
//   <InputGroup>
//     <InputGroupAddon align="inline-start">
//       <Icon icon={Search} size={16} />
//     </InputGroupAddon>
//     <InputGroupInput placeholder="Search…" />
//     <InputGroupButton size="icon-xs" onPress={...}>
//       <Icon icon={X} size={16} />
//     </InputGroupButton>
//   </InputGroup>

type InputGroupContextValue = {
  setFocused: (focused: boolean) => void;
};

const InputGroupContext = React.createContext<InputGroupContextValue | null>(
  null,
);

// Static tree inspection (same trick as the Select labels):
// detects block-* addons (the group switches to column) and disabled
// controls (the group dims). No effects or mounting.
function hasBlockAddon(nodes: React.ReactNode): boolean {
  let found = false;
  React.Children.forEach(nodes, (child) => {
    if (found || !React.isValidElement(child)) return;
    const props = child.props as {
      align?: unknown;
      children?: React.ReactNode;
    };
    if (
      child.type === InputGroupAddon &&
      (props.align === "block-start" || props.align === "block-end")
    ) {
      found = true;
      return;
    }
    if (props.children && hasBlockAddon(props.children)) found = true;
  });
  return found;
}

type InputGroupProps = ViewProps;

function InputGroup({ className, style, children, ...props }: InputGroupProps) {
  const scheme = useColorScheme();
  const [focused, setFocused] = React.useState(false);
  const contextValue = React.useMemo(() => ({ setFocused }), []);

  // `useMemo`, not `useState`+effect: the tree is already here, computed directly.
  const block = React.useMemo(() => hasBlockAddon(children), [children]);

  return (
    <InputGroupContext.Provider value={contextValue}>
      <View
        className={cn(
          "w-full min-w-0 flex-row items-center rounded-lg border px-2 gap-1.5",
          block ? "h-auto flex-col items-stretch p-2" : "h-12",
          focused ? "border-ring" : "border-input",
          className,
        )}
        // Same background as the standalone Input (solid light, translucent dark).
        // No dim of its own: the inner input already dims itself when disabled.
        style={[
          scheme === "dark"
            ? { backgroundColor: withAlpha(semanticTokens.dark.input, 0.2) }
            : { backgroundColor: "transparent" },
          style,
        ]}
        {...props}
      >
        {children}
      </View>
    </InputGroupContext.Provider>
  );
}

const inputGroupAddonVariants = cva("flex-row items-center gap-1.5", {
  variants: {
    align: {
      "inline-start": "order-first pl-1",
      "inline-end": "order-last pr-1",
      "block-start": "order-first w-full justify-start px-1 pt-1",
      "block-end": "order-last w-full justify-start px-1 pb-1",
    },
  },
  defaultVariants: {
    align: "inline-start",
  },
});

type InputGroupAddonProps = ViewProps &
  VariantProps<typeof inputGroupAddonVariants>;

function InputGroupAddon({
  className,
  align = "inline-start",
  children,
  ...props
}: InputGroupAddonProps) {
  const scheme = useColorScheme();
  const muted = semanticTokens[scheme]["muted-foreground"];
  return (
    <TextClassContext.Provider value="text-sm text-muted-foreground">
      <IconClassContext.Provider value={muted}>
        <View
          className={cn(inputGroupAddonVariants({ align }), className)}
          {...props}
        >
          {children}
        </View>
      </IconClassContext.Provider>
    </TextClassContext.Provider>
  );
}

type InputGroupButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "size"
> & {
  size?: "xs" | "sm" | "icon-xs" | "icon-sm";
};

function InputGroupButton({
  size = "xs",
  variant = "ghost",
  className,
  ...props
}: InputGroupButtonProps) {
  // twMerge resolves conflicts with the base Button sizes.
  const [buttonSize, buttonClass] =
    size === "sm"
      ? (["sm", ""] as const)
      : size === "icon-xs"
        ? (["icon", "h-7 w-7 p-0"] as const)
        : size === "icon-sm"
          ? (["icon", "h-8 w-8 p-0"] as const)
          : (["sm", "h-7 px-2"] as const);
  return (
    <Button
      variant={variant}
      size={buttonSize}
      className={cn(buttonClass, className)}
      {...props}
    />
  );
}

type InputGroupTextProps = ViewProps & {
  children?: React.ReactNode;
};

function InputGroupText({
  className,
  children,
  ...props
}: InputGroupTextProps) {
  // RN does not render loose strings inside a View: plain text goes in a Text.
  if (typeof children === "string") {
    return (
      <Text className={cn("text-sm text-muted-foreground", className)}>
        {children}
      </Text>
    );
  }
  return (
    <View className={cn("flex-row items-center gap-1.5", className)} {...props}>
      {children}
    </View>
  );
}

type InputGroupInputProps = React.ComponentProps<typeof Input>;

function InputGroupInput({
  style,
  onFocus,
  onBlur,
  ...props
}: InputGroupInputProps) {
  const group = React.useContext(InputGroupContext);

  type FocusHandler = NonNullable<
    React.ComponentProps<typeof Input>["onFocus"]
  >;
  type BlurHandler = NonNullable<React.ComponentProps<typeof Input>["onBlur"]>;
  const handleFocus: FocusHandler = React.useCallback(
    (e) => {
      group?.setFocused(true);
      onFocus?.(e);
    },
    [group, onFocus],
  );
  const handleBlur: BlurHandler = React.useCallback(
    (e) => {
      group?.setFocused(false);
      onBlur?.(e);
    },
    [group, onBlur],
  );

  return (
    <Input
      // No chrome of its own: the group paints background/border; the input
      // just fills the space. All via `style` (the current Input does not
      // accept `className`).
      style={[
        {
          flex: 1,
          height: "100%",
          minHeight: 48,
          borderWidth: 0,
          borderRadius: 0,
          backgroundColor: "transparent",
          paddingHorizontal: 0,
          paddingVertical: 0,
          boxShadow: "none",
        },
        style,
      ]}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
};
export type {
  InputGroupProps,
  InputGroupAddonProps,
  InputGroupButtonProps,
  InputGroupTextProps,
  InputGroupInputProps,
};
