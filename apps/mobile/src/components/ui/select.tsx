import * as React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type PressableProps,
  type ViewProps,
} from "react-native";
import { FullWindowOverlay } from "react-native-screens";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as SelectPrimitive from "@rn-primitives/select";
import { Check, ChevronDown } from "lucide-react-native";

import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { semanticTokens } from "@app/lib/tokens/semantic";

// Select with two presentations controlled by `variant` on the root:
//
// - "drawer" (default): options open in a bottom sheet (Drawer).
//   Recommended on mobile: immune to keyboard and rotation.
// - "dropdown": floating popup anchored to the trigger via @rn-primitives/select.
//   NOTE: in @rn-primitives/select v1.5.2 the popup's open is controlled by
//   the primitive internally; our `open`/`defaultOpen` only apply to drawer.
//
// Basic usage:
//   <Select value={v} onValueChange={setV}>
//     <SelectTrigger><SelectValue placeholder="Pick…" /></SelectTrigger>
//     <SelectContent>
//       <SelectItem value="a">Option A</SelectItem>
//       <SelectItem value="b">Option B</SelectItem>
//     </SelectContent>
//   </Select>

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SelectVariant = "drawer" | "dropdown";

/** Node with native measurement to compute scroll-to-selected. */
type MeasurableNode = {
  measure: (
    callback: (
      x: number,
      y: number,
      width: number,
      height: number,
      pageX: number,
      pageY: number,
    ) => void,
  ) => void;
};

/** ScrollView does not expose `measure` in RN's types — local intersection. */
type MeasurableScrollView = MeasurableNode & {
  scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => void;
};

type SelectContextValue = {
  variant: SelectVariant;
  value: string | undefined;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled?: boolean;
  /** Returns the text label of an item given its value. */
  labelForValue: (value: string) => string | undefined;
  /** Registers/unregisters an item's DOM node (for scroll-to-selected). */
  registerItemNode: (value: string, node: MeasurableNode | null) => void;
  /** Returns an item's DOM node by its value. */
  getItemNode: (value: string) => MeasurableNode | undefined;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelect(): SelectContextValue {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error("Select.* must be used within a <Select>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Label collection — walks the React tree to map value → label.
//
// Known limitation: only detects <SelectItem>s that are direct children or
// wrapped in simple fragments/groups. If an intermediate component renders
// SelectItem opaquely (without exposing `value` as a direct prop) the label
// is not captured and SelectValue will show the raw `value` as a fallback.
// ---------------------------------------------------------------------------

function collectItemLabels(
  nodes: React.ReactNode,
  map: Map<string, string> = new Map(),
): Map<string, string> {
  React.Children.forEach(nodes, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as {
      value?: unknown;
      children?: React.ReactNode;
    };
    if (typeof props.value === "string") {
      // The label is the plain-text child; if children is complex
      // (e.g. <View><Text>Label</Text></View>) the value is used as fallback.
      // For complex children, the consumer can pass an explicit `label` —
      // see FIX #6 in SelectItem / DropdownSelectItem.
      map.set(
        props.value,
        typeof props.children === "string" ? props.children : props.value,
      );
    }
    if (props.children) collectItemLabels(props.children, map);
  });
  return map;
}

// ---------------------------------------------------------------------------
// Select root
// ---------------------------------------------------------------------------

export type SelectProps = {
  variant?: SelectVariant;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Only for variant="drawer": in dropdown, open is managed by the primitive. */
  open?: boolean;
  /** Only for variant="drawer". */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
};

export function Select({
  variant = "drawer",
  value,
  defaultValue,
  onValueChange,
  open,
  defaultOpen = false,
  onOpenChange,
  disabled,
  children,
}: SelectProps) {
  // --- value state ---
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const currentValue = value ?? internalValue;

  const handleValueChange = React.useCallback(
    (next: string) => {
      if (value === undefined) setInternalValue(next);
      onValueChange?.(next);
    },
    [value, onValueChange],
  );

  // --- open state (drawer only) ---
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const currentOpen = open ?? internalOpen;

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (open === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );

  // --- label map ---
  // Computed once per tree render, but useMemo keeps it stable while
  // `children` is referentially equal (typical with literal JSX).
  const labelMap = React.useMemo(() => collectItemLabels(children), [children]);

  const labelForValue = React.useCallback(
    (itemValue: string) => labelMap.get(itemValue),
    [labelMap],
  );

  // --- item node registry (for scroll-to-selected; does not trigger renders) ---
  const itemNodes = React.useRef(new Map<string, MeasurableNode>());

  const registerItemNode = React.useCallback(
    (itemValue: string, node: MeasurableNode | null) => {
      if (node) itemNodes.current.set(itemValue, node);
      else itemNodes.current.delete(itemValue);
    },
    [],
  );

  const getItemNode = React.useCallback(
    (itemValue: string) => itemNodes.current.get(itemValue),
    [],
  );

  // --- context value ---
  // FIX #8: stable parts are separated from volatile ones to prevent an
  // `open` change from invalidating the whole context (labelForValue,
  // registerItemNode and getItemNode are stable across renders).
  const stableContext = React.useMemo(
    () => ({ variant, disabled, labelForValue, registerItemNode, getItemNode }),
    [variant, disabled, labelForValue, registerItemNode, getItemNode],
  );

  const context = React.useMemo<SelectContextValue>(
    () => ({
      ...stableContext,
      value: currentValue,
      onValueChange: handleValueChange,
      open: currentOpen,
      setOpen: handleOpenChange,
    }),
    [
      stableContext,
      currentValue,
      handleValueChange,
      currentOpen,
      handleOpenChange,
    ],
  );

  const inner = (
    <SelectContext.Provider value={context}>{children}</SelectContext.Provider>
  );

  // FIX #4: in dropdown, `SelectPrimitive.Root` does not accept `open` as a
  // controllable prop in v1.5.2 (it only notifies via onOpenChange). We do not
  // pass `open` to avoid unknown-prop warnings. The external open only works
  // in variant="drawer".
  if (variant === "dropdown") {
    return (
      <SelectPrimitive.Root
        value={
          currentValue
            ? {
                value: currentValue,
                label: labelForValue(currentValue) ?? currentValue,
              }
            : undefined
        }
        onValueChange={(opt) => {
          if (opt) handleValueChange(opt.value);
        }}
        onOpenChange={onOpenChange}
        disabled={disabled}
      >
        {inner}
      </SelectPrimitive.Root>
    );
  }

  return inner;
}

// ---------------------------------------------------------------------------
// useScrollToSelected
//
// Centers the selected item when the panel opens (drawer and dropdown).
// Fired from the ScrollView's `onContentSizeChange`: at that point the
// nodes are mounted and the layout exists (on Android the hidden Modal
// renders null until it opens).
//
// FIX #2: the `didScroll` flag prevents multiple attempts. If the node has
// not measured yet when it first fires (rare, but possible), the scroll
// simply does not happen — that is the safest behavior.
// ---------------------------------------------------------------------------

type ScrollToSelectedApi = {
  scrollRef: React.RefObject<ScrollView | null>;
  handleContentSizeChange: () => void;
};

function useScrollToSelected(): ScrollToSelectedApi {
  const { open, value, getItemNode } = useSelect();
  const scrollRef = React.useRef<ScrollView | null>(null);
  const didScroll = React.useRef(false);

  React.useEffect(() => {
    if (!open) didScroll.current = false;
  }, [open]);

  const handleContentSizeChange = React.useCallback(() => {
    if (!open || didScroll.current || !value) return;
    const node = getItemNode(value);
    const sv = scrollRef.current as unknown as MeasurableScrollView | null;
    if (!node || !sv) return;

    node.measure((_x, _y, _w, h, _px, py) => {
      sv.measure((_sx, _sy, _sw, sh, _spx, spy) => {
        sv.scrollTo({
          y: Math.max(0, py - spy - sh / 2 + h / 2),
          animated: false,
        });
        didScroll.current = true;
      });
    });
  }, [open, value, getItemNode]);

  return { scrollRef, handleContentSizeChange };
}

// ---------------------------------------------------------------------------
// SelectTrigger
// ---------------------------------------------------------------------------

export type SelectTriggerProps = Omit<PressableProps, "children"> & {
  size?: "sm" | "default";
  children?: React.ReactNode;
};

const triggerClasses =
  "flex-row items-center justify-between gap-2 border border-border bg-card active:bg-muted px-4 rounded-2xl active:opacity-90";

export function SelectTrigger({
  size = "default",
  className,
  children,
  onPress,
  disabled,
  ...props
}: SelectTriggerProps) {
  const { variant, open, setOpen, disabled: rootDisabled } = useSelect();
  const isDisabled = disabled ?? rootDisabled;
  const scheme = useColorScheme();

  const chevron = (
    <Icon
      icon={ChevronDown}
      size={18}
      color={semanticTokens[scheme]["muted-foreground"]}
    />
  );

  if (variant === "dropdown") {
    return (
      <SelectPrimitive.Trigger
        disabled={isDisabled}
        className={cn(
          triggerClasses,
          size === "sm" ? "h-10" : "h-12",
          isDisabled && "opacity-50",
          className,
        )}
        onPress={onPress}
        {...props}
      >
        {children}
        {chevron}
      </SelectPrimitive.Trigger>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, expanded: open }}
      disabled={isDisabled}
      onPress={(e) => {
        onPress?.(e);
        setOpen(true);
      }}
      className={cn(
        triggerClasses,
        size === "sm" ? "h-10" : "h-12",
        isDisabled && "opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      {chevron}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// SelectValue
// ---------------------------------------------------------------------------

export type SelectValueProps = React.ComponentProps<typeof Text> & {
  placeholder?: string;
};

export function SelectValue({
  placeholder,
  className,
  ...props
}: SelectValueProps) {
  const { variant } = useSelect();
  return variant === "dropdown" ? (
    <DropdownSelectValue placeholder={placeholder} className={className} />
  ) : (
    <DrawerSelectValue
      placeholder={placeholder}
      className={className}
      {...props}
    />
  );
}

function DrawerSelectValue({
  placeholder,
  className,
  ...props
}: SelectValueProps) {
  const { value, labelForValue } = useSelect();
  const label = value ? (labelForValue(value) ?? value) : undefined;

  return (
    <Text
      numberOfLines={1}
      className={cn(
        "flex-1 text-[15px]",
        label ? "font-inter-medium text-foreground" : "text-muted-foreground",
        className,
      )}
      {...props}
    >
      {label ?? placeholder ?? ""}
    </Text>
  );
}

function DropdownSelectValue({
  placeholder,
  className,
}: {
  placeholder?: string;
  className?: string;
}) {
  const { value } = SelectPrimitive.useRootContext();
  return (
    <SelectPrimitive.Value
      placeholder={placeholder ?? ""}
      className={cn(
        "flex-1 text-[15px]",
        value ? "font-inter-medium text-foreground" : "text-muted-foreground",
        className,
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// SelectContent
// ---------------------------------------------------------------------------

export type SelectContentProps = {
  /** Only variant="drawer": sheet title. */
  title?: string;
  /** Only variant="dropdown": popper side. */
  side?: React.ComponentProps<typeof SelectPrimitive.Content>["side"];
  /** Only variant="dropdown": offset from the trigger. */
  sideOffset?: React.ComponentProps<
    typeof SelectPrimitive.Content
  >["sideOffset"];
  /** Only variant="dropdown": horizontal alignment. */
  align?: React.ComponentProps<typeof SelectPrimitive.Content>["align"];
  className?: string;
  children?: React.ReactNode;
};

export function SelectContent({
  title,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  className,
  children,
}: SelectContentProps) {
  const { variant, open, setOpen } = useSelect();
  const { scrollRef, handleContentSizeChange } = useScrollToSelected();

  if (variant === "dropdown") {
    const popup = (
      <>
        <DropdownOverlay />
        <DropdownPanel
          side={side}
          sideOffset={sideOffset}
          align={align}
          className={cn("rounded-2xl", className)}
        >
          {children}
        </DropdownPanel>
      </>
    );
    return (
      <DropdownPortal>
        {Platform.OS === "ios" ? (
          <FullWindowOverlay>{popup}</FullWindowOverlay>
        ) : (
          popup
        )}
      </DropdownPortal>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent>
        {title ? (
          <DrawerHeader>
            <DrawerTitle className="text-center">{title}</DrawerTitle>
          </DrawerHeader>
        ) : null}
        <ScrollView
          ref={scrollRef}
          onContentSizeChange={handleContentSizeChange}
          style={{ maxHeight: 320 }}
          contentContainerStyle={{ gap: 2, paddingBottom: 8 }}
          showsVerticalScrollIndicator
        >
          {children}
        </ScrollView>
      </DrawerContent>
    </Drawer>
  );
}

// FIX #3: DropdownPortal re-provides SelectContext so that Item/Group/Label
// work inside the primitive's portal (the context does not cross zustand
// portals). It uses the closure's context — always in sync because
// `context` is the parent Provider's current value, not a copy.
function DropdownPortal({ children }: { children: React.ReactNode }) {
  const selectCtx = useSelect();
  return (
    <SelectPrimitive.Portal>
      <SelectContext.Provider value={selectCtx}>
        {children}
      </SelectContext.Provider>
    </SelectPrimitive.Portal>
  );
}

function DropdownOverlay() {
  return (
    <SelectPrimitive.Overlay asChild>
      <Animated.View
        entering={FadeIn.duration(100)}
        exiting={FadeOut.duration(100)}
        style={StyleSheet.absoluteFill}
      />
    </SelectPrimitive.Overlay>
  );
}

function DropdownPanel({
  side,
  sideOffset,
  align,
  className,
  children,
}: {
  side: React.ComponentProps<typeof SelectPrimitive.Content>["side"];
  sideOffset: React.ComponentProps<
    typeof SelectPrimitive.Content
  >["sideOffset"];
  align: React.ComponentProps<typeof SelectPrimitive.Content>["align"];
  className?: string;
  children?: React.ReactNode;
}) {
  const { scrollRef, handleContentSizeChange } = useScrollToSelected();
  return (
    <SelectPrimitive.Content
      side={side}
      sideOffset={sideOffset}
      align={align}
      className={cn(
        "min-w-36 rounded-2xl border border-border bg-popover p-1 shadow-md",
        className,
      )}
    >
      <ScrollView
        ref={scrollRef}
        onContentSizeChange={handleContentSizeChange}
        style={{ maxHeight: 220 }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SelectPrimitive.Content>
  );
}

// ---------------------------------------------------------------------------
// SelectGroup
// ---------------------------------------------------------------------------

export type SelectGroupProps = ViewProps;

export function SelectGroup({
  className,
  children,
  ...props
}: SelectGroupProps) {
  const { variant } = useSelect();
  return variant === "dropdown" ? (
    <SelectPrimitive.Group className={cn("gap-1", className)} {...props}>
      {children}
    </SelectPrimitive.Group>
  ) : (
    <View className={cn("gap-1", className)} {...props}>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// SelectLabel
// ---------------------------------------------------------------------------

export function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  const { variant } = useSelect();
  const labelClasses = cn(
    "px-3 pb-1 pt-3 text-xs font-inter-medium text-muted-foreground",
    className,
  );
  return variant === "dropdown" ? (
    <SelectPrimitive.Label className={labelClasses} {...props} />
  ) : (
    <Text className={labelClasses} {...props} />
  );
}

// ---------------------------------------------------------------------------
// SelectItem
//
// FIX #6: the `label` prop is added for cases where `children` is a complex
// node (not plain text). Without it, DropdownSelectItem uses `value` as a
// fallback and SelectValue shows the raw value instead of the real text.
// ---------------------------------------------------------------------------

export type SelectItemProps = Omit<PressableProps, "children"> & {
  value: string;
  /** Plain-text label. Inferred from children when it is a string. */
  label?: string;
  disabled?: boolean;
  children?: React.ReactNode;
};

export function SelectItem({
  value,
  label,
  disabled,
  className,
  children,
  onPress,
  ...props
}: SelectItemProps) {
  const { variant } = useSelect();
  return variant === "dropdown" ? (
    <DropdownSelectItem
      value={value}
      label={label}
      disabled={disabled}
      className={className}
      onPress={onPress}
      {...props}
    >
      {children}
    </DropdownSelectItem>
  ) : (
    <DrawerSelectItem
      value={value}
      label={label}
      disabled={disabled}
      className={className}
      onPress={onPress}
      {...props}
    >
      {children}
    </DrawerSelectItem>
  );
}

function DrawerSelectItem({
  value,
  label,
  disabled,
  className,
  children,
  onPress,
  ...props
}: SelectItemProps) {
  const {
    value: selected,
    onValueChange,
    setOpen,
    registerItemNode,
  } = useSelect();
  const scheme = useColorScheme();
  const isSelected = selected === value;

  const setNodeRef = React.useCallback(
    (node: MeasurableNode | null) => registerItemNode(value, node),
    [value, registerItemNode],
  );

  // FIX #7: the external onPress is called before closing. If the external
  // handler also calls `setOpen(false)`, the effect is idempotent. This
  // avoids the previous pattern where onPress(e) could setOpen(true) and
  // then the item would immediately close it again.
  const handlePress = React.useCallback(
    (e: Parameters<NonNullable<PressableProps["onPress"]>>[0]) => {
      onPress?.(e);
      onValueChange(value);
      setOpen(false);
    },
    [onPress, onValueChange, value, setOpen],
  );

  return (
    <Pressable
      ref={setNodeRef}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected, disabled }}
      disabled={disabled}
      onPress={handlePress}
      className={cn(
        "flex-row items-center gap-3 rounded-2xl px-3 py-3 active:opacity-70",
        isSelected && "bg-muted",
        disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      <Text
        numberOfLines={1}
        className="flex-1 text-[15px] font-inter-medium text-foreground"
      >
        {children}
      </Text>
      {/* Always mounted (transparent color when inactive) to avoid shifting the layout. */}
      <Icon
        icon={Check}
        size={18}
        color={isSelected ? semanticTokens[scheme].primary : "transparent"}
      />
    </Pressable>
  );
}

function DropdownSelectItem({
  value,
  label,
  disabled,
  className,
  children,
  onPress,
  ...props
}: SelectItemProps) {
  const { value: selected } = SelectPrimitive.useRootContext();
  const { registerItemNode } = useSelect();
  const scheme = useColorScheme();
  const isSelected = selected?.value === value;

  // FIX #6: priority: `label` prop > children string > value as fallback.
  const resolvedLabel =
    label ?? (typeof children === "string" ? children : value);

  const setNodeRef = React.useCallback(
    (node: MeasurableNode | null) => registerItemNode(value, node),
    [value, registerItemNode],
  );

  return (
    <SelectPrimitive.Item
      ref={setNodeRef}
      value={value}
      label={resolvedLabel}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        "flex-row items-center gap-3 rounded-2xl px-3 py-2.5 active:opacity-70",
        isSelected && "bg-muted",
        disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex-1 text-[15px] font-inter-medium text-foreground" />
      <SelectPrimitive.ItemIndicator forceMount>
        <Icon
          icon={Check}
          size={18}
          color={isSelected ? semanticTokens[scheme].primary : "transparent"}
        />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

// ---------------------------------------------------------------------------
// SelectSeparator
// ---------------------------------------------------------------------------

export type SelectSeparatorProps = ViewProps;

export function SelectSeparator({ className, ...props }: SelectSeparatorProps) {
  const { variant } = useSelect();
  return variant === "dropdown" ? (
    <SelectPrimitive.Separator
      className={cn("my-1 h-px bg-border", className)}
      {...props}
    />
  ) : (
    <View className={cn("my-1 h-px bg-border", className)} {...props} />
  );
}
