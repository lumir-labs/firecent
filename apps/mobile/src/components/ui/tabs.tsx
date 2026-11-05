import * as React from "react";
import {
  Pressable,
  ScrollView,
  View,
  type PressableProps,
  type ViewProps,
} from "react-native";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { TextClassContext } from "@/components/ui/text";

// shadcn-style Tabs for React Native (zero dependencies: the web's
// `TabsPrimitive` does not exist in native, so the state lives in context).
//
//   <Tabs value={tab} onValueChange={setTab}>
//     <TabsList>
//       <TabsTrigger value="a"><Text>A</Text></TabsTrigger>
//     </TabsList>
//     <TabsContent value="a">…</TabsContent>
//   </Tabs>
//
// Like Button/Badge, the trigger text is styled via TextClassContext:
// children are <Text> from `@/components/ui/text` and inherit the
// active/inactive color automatically.

type TabsContextValue = {
  value: string | undefined;
  onValueChange: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

type TabsListContextValue = {
  variant: "default" | "line";
  fit: "stretch" | "content";
};

const TabsListContext = React.createContext<TabsListContextValue>({
  variant: "default",
  fit: "stretch",
});

type TabsProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children?: React.ReactNode;
};

function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
}: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue);
  const current = value ?? internal;

  const handleChange = React.useCallback(
    (next: string) => {
      if (value === undefined) setInternal(next);
      onValueChange?.(next);
    },
    [value, onValueChange],
  );

  const context = React.useMemo(
    () => ({ value: current, onValueChange: handleChange }),
    [current, handleChange],
  );

  return (
    <TabsContext.Provider value={context}>
      <View className={cn("gap-3", className)}>{children}</View>
    </TabsContext.Provider>
  );
}

const tabsListVariants = cva(
  "flex-row items-center justify-center rounded-full p-1",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "bg-transparent",
      },
      // stretch: the list takes the full width and the triggers share it.
      // content: each trigger measures its content (min-w-max). The list
      // scrolls horizontally when it overflows — text never breaks.
      fit: {
        stretch: "",
        content: "w-full",
      },
    },
    defaultVariants: {
      variant: "default",
      fit: "stretch",
    },
  },
);

type TabsListProps = ViewProps & VariantProps<typeof tabsListVariants>;

function TabsList({
  className,
  variant = "default",
  fit = "stretch",
  children,
  ...props
}: TabsListProps) {
  const contextValue = React.useMemo(
    () => ({ variant: variant ?? "default", fit: fit ?? "stretch" }),
    [variant, fit],
  ) as TabsListContextValue;

  // With fit="content" the text must stay on a single line and, if the
  // total exceeds the width, the list scrolls horizontally instead of
  // breaking words. Without the ScrollView, flex-none children would be clipped.
  if ((fit ?? "stretch") === "content") {
    return (
      <TabsListContext.Provider value={contextValue}>
        <View
          className={cn(tabsListVariants({ variant, fit }), className)}
          {...props}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            {children}
          </ScrollView>
        </View>
      </TabsListContext.Provider>
    );
  }

  return (
    <TabsListContext.Provider value={contextValue}>
      <View
        className={cn(tabsListVariants({ variant, fit }), className)}
        {...props}
      >
        {children}
      </View>
    </TabsListContext.Provider>
  );
}

const tabsTriggerVariants = cva(
  "shrink-0 items-center justify-center whitespace-nowrap active:opacity-70 will-change-variable",
  {
    variants: {
      listVariant: {
        default: "rounded-full px-3 py-2",
        line: "px-2 py-2 border-b-2 border-transparent",
      },
      fit: {
        stretch: "flex-1",
        content: "flex-none",
      },
      active: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        listVariant: "default",
        active: true,
        className: "bg-card border border-border",
      },
      {
        listVariant: "line",
        active: true,
        className: "border-b-2 border-primary", // only defines the color/thickness
      },
    ],
    defaultVariants: {
      listVariant: "default",
      fit: "stretch",
      active: false,
    },
  },
);

const tabsTriggerTextVariants = cva("whitespace-nowrap text-sm font-inter-medium", {
  variants: {
    active: {
      true: "text-foreground",
      false: "text-muted-foreground",
    },
  },
  defaultVariants: {
    active: false,
  },
});

type TabsTriggerProps = Omit<PressableProps, "children"> & {
  value: string;
  children?: React.ReactNode;
};

function TabsTrigger({
  value,
  className,
  children,
  ...props
}: TabsTriggerProps) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be used inside <Tabs>");
  const { variant: listVariant, fit } = React.useContext(TabsListContext);
  const active = ctx.value === value;

  return (
    <TextClassContext.Provider value={tabsTriggerTextVariants({ active })}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={() => ctx.onValueChange(value)}
        className={cn(
          tabsTriggerVariants({ listVariant, fit, active }),
          className,
        )}
        {...props}
      >
        {children}
      </Pressable>
    </TextClassContext.Provider>
  );
}

type TabsContentProps = ViewProps & {
  value: string;
};

function TabsContent({
  value,
  className,
  children,
  ...props
}: TabsContentProps) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be used inside <Tabs>");
  // Like Base UI's Panel by default: inactive content is unmounted.
  if (ctx.value !== value) return null;
  return (
    <View className={cn("gap-5", className)} {...props}>
      {children}
    </View>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
export type { TabsProps, TabsListProps, TabsTriggerProps, TabsContentProps };
