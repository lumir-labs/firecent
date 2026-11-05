import * as React from "react";
import {
  Modal,
  Pressable,
  View,
  type PressableProps,
  type ViewProps,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Slot } from "@rn-primitives/slot";
import { X } from "lucide-react-native";

import { cn } from "@/lib/utils";
import { Text, TextClassContext } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// shadcn-style Dialog: a CENTERED modal with scale + fade (unlike the
// Drawer, which anchors to the bottom edge). No drag gesture: it closes
// via backdrop (if dismissible), system back button, X button or
// <DialogClose />.
//
//   <Dialog open={open} onOpenChange={setOpen}>
//     <DialogTrigger asChild>
//       <Button variant="outline"><Text>Open</Text></Button>
//     </DialogTrigger>
//     <DialogContent>
//       <DialogHeader>
//         <DialogTitle>Title</DialogTitle>
//         <DialogDescription>Description</DialogDescription>
//       </DialogHeader>
//       …free-form content…
//       <DialogFooter>
//         <DialogClose asChild>
//           <Button variant="outline"><Text>Cancel</Text></Button>
//         </DialogClose>
//         <Button><Text>Save</Text></Button>
//       </DialogFooter>
//     </DialogContent>
//   </Dialog>
//
// It shares the patterns of `drawer.tsx` (Modal + Reanimated shared
// values, fading backdrop, `showModal` derived during render).

type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** If false, the backdrop does not close it (system back still does). */
  dismissible: boolean;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialog(): DialogContextValue {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error("Dialog.* must be used within a <Dialog>");
  return ctx;
}

type DialogProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** default true. If false, the backdrop does not close it (system back does). */
  dismissible?: boolean;
  children?: React.ReactNode;
};

function Dialog({
  open,
  defaultOpen = false,
  onOpenChange,
  dismissible = true,
  children,
}: DialogProps) {
  const [internal, setInternal] = React.useState(defaultOpen);
  const isControlled = open !== undefined;
  const current = isControlled ? open : internal;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternal(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const value = React.useMemo(
    () => ({ open: current, setOpen, dismissible }),
    [current, setOpen, dismissible],
  );

  return (
    <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
  );
}

type DialogTriggerProps = Omit<PressableProps, "children"> & {
  asChild?: boolean;
  children?: React.ReactNode;
};

function DialogTrigger({
  asChild,
  className,
  children,
  onPress,
  ...props
}: DialogTriggerProps) {
  const { setOpen } = useDialog();
  const handlePress: PressableProps["onPress"] = (e) => {
    onPress?.(e);
    setOpen(true);
  };

  if (asChild) {
    return (
      <Slot {...props} onPress={handlePress}>
        {children}
      </Slot>
    );
  }
  return (
    <TextClassContext.Provider value="text-sm font-inter-semibold text-primary-foreground">
      <Pressable
        accessibilityRole="button"
        className={cn(
          "h-12 flex-row items-center justify-center rounded-full bg-primary px-5 active:opacity-90",
          className,
        )}
        onPress={handlePress}
        {...props}
      >
        {children}
      </Pressable>
    </TextClassContext.Provider>
  );
}

type DialogCloseProps = Omit<PressableProps, "children"> & {
  asChild?: boolean;
  children?: React.ReactNode;
};

function DialogClose({
  asChild,
  className,
  children,
  onPress,
  ...props
}: DialogCloseProps) {
  const { setOpen } = useDialog();
  const handlePress: PressableProps["onPress"] = (e) => {
    onPress?.(e);
    setOpen(false);
  };

  if (asChild) {
    return (
      <Slot {...props} onPress={handlePress}>
        {children}
      </Slot>
    );
  }
  return (
    <TextClassContext.Provider value="text-sm font-inter-semibold text-foreground">
      <Pressable
        accessibilityRole="button"
        className={cn(
          "h-12 flex-row items-center justify-center rounded-full border border-border bg-transparent px-5 active:opacity-70",
          className,
        )}
        onPress={handlePress}
        {...props}
      >
        {children}
      </Pressable>
    </TextClassContext.Provider>
  );
}

// Animation choreography in module functions (same reason as
// drawer.tsx: hook rules do not model mutable shared values).
function startDialogEnter(
  scale: SharedValue<number>,
  backdrop: SharedValue<number>,
) {
  scale.value = 0.95;
  backdrop.value = 0;
  scale.value = withTiming(1, {
    duration: 100,
    easing: Easing.out(Easing.cubic),
  });
  backdrop.value = withTiming(0.4, { duration: 100 });
}

function startDialogExit(
  scale: SharedValue<number>,
  backdrop: SharedValue<number>,
  onDone: () => void,
) {
  scale.value = withTiming(
    0.95,
    { duration: 100, easing: Easing.in(Easing.cubic) },
    (finished) => {
      if (finished) scheduleOnRN(onDone);
    },
  );
  backdrop.value = withTiming(0, { duration: 100 });
}

type DialogContentProps = ViewProps;

function DialogContent({
  className,
  style,
  children,
  ...props
}: DialogContentProps) {
  const { open, setOpen, dismissible } = useDialog();
  // `showModal` lives one cycle longer than `open`: it stays mounted during
  // the exit animation ("adjust state during render" pattern, with a guard).
  const [showModal, setShowModal] = React.useState(false);
  if (open && !showModal) {
    setShowModal(true);
  }

  const scale = useSharedValue(0.95);
  const backdrop = useSharedValue(0);

  const finishClose = React.useCallback(() => {
    setShowModal(false);
    setOpen(false);
  }, [setOpen]);

  const close = React.useCallback(() => {
    startDialogExit(scale, backdrop, finishClose);
  }, [scale, backdrop, finishClose]);

  // Enter: with the modal already mounted.
  React.useEffect(() => {
    if (!showModal || !open) return undefined;
    startDialogEnter(scale, backdrop);
    return undefined;
  }, [open, showModal, scale, backdrop]);

  // Exit: `open` turns off with the modal visible.
  React.useEffect(() => {
    if (!open && showModal) {
      close();
    }
    return undefined;
  }, [open, showModal, close]);

  // Opacity derived from the scale (0.95→0, 1→1): equivalent to
  // shadcn's `data-starting-style:opacity-0` + zoom, always in sync.
  const panelStyle = useAnimatedStyle(() => ({
    opacity: (scale.value - 0.95) / 0.05,
    transform: [{ scale: scale.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="none"
      onRequestClose={close}
    >
      {/* Own root for animating inside the Modal on Android. */}
      <GestureHandlerRootView
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        {/* Flat black + animated opacity (no `/opacity`: color-mix does not
            resolve in native). Inline styles: Animated.View does not use className. */}
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "#000000",
            },
            backdropStyle,
          ]}
        >
          <Pressable
            accessibilityRole="button"
            className="h-full w-full"
            onPress={dismissible ? close : undefined}
          />
        </Animated.View>
        {/* Positioning on the Animated.View (defined width + cap:
            without this the inner `w-full` has no base and goes to the edges);
            the visuals with classes. */}
        <Animated.View style={[panelStyle, { width: "100%", maxWidth: 400 }]}>
          <View
            className={cn(
              "gap-4 rounded-2xl border border-border bg-card p-6",
              className,
            )}
            style={style}
            {...props}
          >
            {children}
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3"
              >
                <Icon icon={X} />
              </Button>
            </DialogClose>
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

type DialogHeaderProps = ViewProps;

function DialogHeader({ className, children, ...props }: DialogHeaderProps) {
  return (
    <View className={cn("items-center gap-2", className)} {...props}>
      {children}
    </View>
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Text>) {
  return (
    <Text
      className={cn(
        "text-center text-lg font-inter-semibold text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Text>) {
  return (
    <Text variant="muted" className={cn("text-center", className)} {...props} />
  );
}

type DialogFooterProps = ViewProps;

function DialogFooter({ className, children, ...props }: DialogFooterProps) {
  return (
    <View className={cn("gap-2", className)} {...props}>
      {children}
    </View>
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
export type {
  DialogProps,
  DialogTriggerProps,
  DialogCloseProps,
  DialogContentProps,
  DialogHeaderProps,
  DialogFooterProps,
};
