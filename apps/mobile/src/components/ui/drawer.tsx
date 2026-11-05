import * as React from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  View,
  type PressableProps,
  type ViewProps,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  type PanGesture,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Slot } from "@rn-primitives/slot";

import { cn } from "@/lib/utils";
import { Text, TextClassContext } from "@/components/ui/text";

// shadcn-style Drawer (bottom sheet): `Modal` + Pan gesture from
// react-native-gesture-handler + Reanimated animations (native thread) +
// `Slot` for `asChild`.
//
//   <Drawer open={open} onOpenChange={setOpen}>
//     <DrawerTrigger asChild>
//       <Button><Text>Open</Text></Button>
//     </DrawerTrigger>
//     <DrawerContent>
//       <DrawerHeader>
//         <DrawerTitle>Title</DrawerTitle>
//         <DrawerDescription>Description</DrawerDescription>
//       </DrawerHeader>
//       …free-form content…
//       <DrawerFooter>
//         <DrawerClose asChild>
//           <Button variant="outline"><Text>Close</Text></Button>
//         </DrawerClose>
//       </DrawerFooter>
//     </DrawerContent>
//   </Drawer>
//
// The gesture lives only on the handle bar and the DrawerHeader: the body
// never drags (a long drawer needs internal scroll). It closes by gesture,
// backdrop, system back button or <DrawerClose />.

type DrawerContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** If false, neither the backdrop nor the gesture closes it (system back still does). */
  dismissible: boolean;
};

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

// Gesture for the DrawerHeader (the handle bar uses its own). With
// dismissible=false the gesture still travels but disabled.
const DrawerPanContext = React.createContext<PanGesture | null>(null);

function useDrawer(): DrawerContextValue {
  const ctx = React.useContext(DrawerContext);
  if (!ctx) throw new Error("Drawer.* must be used within a <Drawer>");
  return ctx;
}

type DrawerProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** default true. If false, backdrop and swipe do not close it (system back does). */
  dismissible?: boolean;
  children?: React.ReactNode;
};

function Drawer({
  open,
  defaultOpen = false,
  onOpenChange,
  dismissible = true,
  children,
}: DrawerProps) {
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
    <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>
  );
}

type DrawerTriggerProps = Omit<PressableProps, "children"> & {
  asChild?: boolean;
  children?: React.ReactNode;
};

function DrawerTrigger({
  asChild,
  className,
  children,
  onPress,
  ...props
}: DrawerTriggerProps) {
  const { setOpen } = useDrawer();
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

type DrawerCloseProps = Omit<PressableProps, "children"> & {
  asChild?: boolean;
  children?: React.ReactNode;
};

function DrawerClose({
  asChild,
  className,
  children,
  onPress,
  ...props
}: DrawerCloseProps) {
  const { setOpen } = useDrawer();
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

type DrawerContentProps = ViewProps;

// Animation choreography in module functions: they receive shared values as
// parameters so the hook rules (immutability) do not confuse them with
// mutation of hook values (Reanimated shared values ARE mutable by
// design: that is their whole API).
function startEnterAnimation(
  translateY: SharedValue<number>,
  backdrop: SharedValue<number>,
  screenHeight: number,
) {
  translateY.value = screenHeight;
  backdrop.value = 0;
  translateY.value = withTiming(0, {
    duration: 300,
    easing: Easing.out(Easing.cubic),
  });
  backdrop.value = withTiming(0.4, { duration: 250 });
}

function startCloseAnimation(
  translateY: SharedValue<number>,
  backdrop: SharedValue<number>,
  screenHeight: number,
  onDone: () => void,
) {
  translateY.value = withTiming(
    screenHeight,
    { duration: 240, easing: Easing.in(Easing.cubic) },
    (finished) => {
      if (finished) scheduleOnRN(onDone);
    },
  );
  backdrop.value = withTiming(0, { duration: 200 });
}

function createPanGesture(
  dismissible: boolean,
  close: () => void,
  translateY: SharedValue<number>,
) {
  return (
    Gesture.Pan()
      .enabled(dismissible)
      // Only activates downward (up/still fingers do nothing) and fails
      // horizontally so it does not fight with internal scrolls.
      .activeOffsetY(10)
      .failOffsetX([-15, 15])
      .onUpdate((e) => {
        translateY.value = Math.max(0, e.translationY);
      })
      .onEnd((e) => {
        if (e.translationY > 120 || e.velocityY > 700) {
          scheduleOnRN(close);
        } else {
          translateY.value = withSpring(0, { damping: 100, stiffness: 800 });
        }
      })
  );
}

function DrawerContent({
  className,
  style,
  children,
  ...props
}: DrawerContentProps) {
  const { open, setOpen, dismissible } = useDrawer();
  // `showModal` lives one cycle longer than `open`: it stays mounted during
  // the exit animation. It is derived during render (React's "adjust state
  // during render" pattern, with an anti-loop guard).
  const [showModal, setShowModal] = React.useState(false);
  if (open && !showModal) {
    setShowModal(true);
  }

  const screenHeight = React.useMemo(() => Dimensions.get("window").height, []);
  const translateY = useSharedValue(screenHeight);
  const backdrop = useSharedValue(0);

  const finishClose = React.useCallback(() => {
    setShowModal(false);
    setOpen(false);
  }, [setOpen]);

  const close = React.useCallback(() => {
    startCloseAnimation(translateY, backdrop, screenHeight, finishClose);
  }, [translateY, backdrop, screenHeight, finishClose]);

  // Enter: with the modal already mounted. Shared values apply instantly
  // (no rAF) and the timing starts from there.
  React.useEffect(() => {
    if (!showModal || !open) return undefined;
    startEnterAnimation(translateY, backdrop, screenHeight);
    return undefined;
  }, [open, showModal, translateY, backdrop, screenHeight]);

  // Exit: `open` turns off with the modal visible.
  React.useEffect(() => {
    if (!open && showModal) {
      close();
    }
    return undefined;
  }, [open, showModal, close]);

  const handlePan = React.useMemo(
    () => createPanGesture(dismissible, close, translateY),
    [dismissible, close, translateY],
  );
  const headerPan = React.useMemo(
    () => createPanGesture(dismissible, close, translateY),
    [dismissible, close, translateY],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
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
      {/* Own root so gestures work inside the Modal on
          Android (the app root does not reach the modal's container). */}
      <GestureHandlerRootView style={{ flex: 1, justifyContent: "flex-end" }}>
        {/* Flat black + animated opacity (no `/opacity`: color-mix does not
            resolve in native). Inline styles: this is a Reanimated
            Animated.View, no className. */}
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
        <DrawerPanContext.Provider value={headerPan}>
          {/* Positioning is handled by the Animated.View; the visuals live in
              the inner View with classes (tokens + theme intact). */}
          <Animated.View style={sheetStyle}>
            <View
              className={cn("rounded-t-3xl bg-card px-5 pb-10 pt-3", className)}
              style={style}
              {...props}
            >
              <GestureDetector gesture={handlePan}>
                {/* Generous grab zone: the handle bar alone (40x4) is
                    impossible to grab with a finger. */}
                <View className="-mt-3 items-center self-stretch pb-2 pt-4">
                  <View className="h-1 w-25 rounded-full bg-border" />
                </View>
              </GestureDetector>
              {children}
            </View>
          </Animated.View>
        </DrawerPanContext.Provider>
      </GestureHandlerRootView>
    </Modal>
  );
}

type DrawerHeaderProps = ViewProps;

function DrawerHeader({ className, children, ...props }: DrawerHeaderProps) {
  const gesture = React.useContext(DrawerPanContext);
  // Gesture disabled outside a DrawerContent (should never happen).
  const fallback = React.useMemo(() => Gesture.Pan().enabled(false), []);
  return (
    <GestureDetector gesture={gesture ?? fallback}>
      <View className={cn("gap-1.5 px-1 pb-1 pt-3", className)} {...props}>
        {children}
      </View>
    </GestureDetector>
  );
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Text>) {
  return (
    <Text
      className={cn("text-lg font-inter-semibold text-foreground", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Text>) {
  return <Text variant="muted" className={className} {...props} />;
}

type DrawerFooterProps = ViewProps;

function DrawerFooter({ className, children, ...props }: DrawerFooterProps) {
  return (
    <View className={cn("gap-2 px-1 pt-3", className)} {...props}>
      {children}
    </View>
  );
}

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
};
export type {
  DrawerProps,
  DrawerTriggerProps,
  DrawerCloseProps,
  DrawerContentProps,
  DrawerHeaderProps,
  DrawerFooterProps,
};
