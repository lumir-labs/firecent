import * as React from "react";
import {
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextStyle,
} from "react-native";

import { cn, withAlpha } from "@/lib/utils";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { semanticTokens } from "@app/lib/tokens/semantic";

// 100% deterministic Input: NO `className`. In this stack, `className` on
// TextInput proved fragile (ghost elevation breaking glyphs, invalidation
// by props identity). Everything goes via `style` with tokens from
// `semantic.ts`: same values as the classes, zero magic. That is why the
// type OMITS `className` on purpose (use `style` to customize).
//
// h-12 (48px, same height as Button/Trigger), radius 12, Inter like sign-in.

type InputProps = Omit<React.ComponentProps<typeof TextInput>, "style"> &
  React.RefAttributes<TextInput> & {
    style?: StyleProp<TextStyle>;
    className?: string;
  };

const baseStyle = StyleSheet.create({
  input: {
    paddingHorizontal: 16,
  },
}).input;

type FocusHandler = NonNullable<
  React.ComponentProps<typeof TextInput>["onFocus"]
>;
type BlurHandler = NonNullable<
  React.ComponentProps<typeof TextInput>["onBlur"]
>;

function Input({
  ref,
  className,
  editable = true,
  placeholderTextColor,
  style: styleProp,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const scheme = useColorScheme();
  const tokens = semanticTokens[scheme];
  const [focused, setFocused] = React.useState(false);
  const disabled = editable === false;

  const handleFocus: FocusHandler = React.useCallback(
    (e) => {
      setFocused(true);
      onFocus?.(e);
    },
    [onFocus],
  );
  const handleBlur: BlurHandler = React.useCallback(
    (e) => {
      setFocused(false);
      onBlur?.(e);
    },
    [onBlur],
  );

  const themeStyle = React.useMemo<TextStyle>(
    () => ({
      color: tokens.foreground,
      backgroundColor:
        scheme === "dark"
          ? withAlpha(tokens.input, disabled ? 0.8 : 0.2)
          : "transparent",
      borderColor: focused ? tokens.ring : tokens.input,
      opacity: disabled ? 0.5 : 1,
    }),
    [tokens, scheme, focused, disabled],
  );

  return (
    <TextInput
      ref={ref}
      editable={editable}
      underlineColorAndroid="transparent"
      placeholderTextColor={
        placeholderTextColor ?? withAlpha(tokens["muted-foreground"], 0.5)
      }
      className={cn(
        "w-full h-12 rounded-lg border border-input text-base",
        className,
      )}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={[baseStyle, themeStyle, styleProp]}
      {...props}
    />
  );
}

export { Input };
export type { InputProps };
