import { useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "@/components/ui/safe-area-view";
import { router } from "expo-router";
import {
  ArrowLeft,
  Bell,
  Eye,
  EyeOff,
  Globe,
  Heart,
  House,
  Moon,
  Search,
  Sun,
  UserRound,
} from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { LucideIcon } from "@/components/ui/lucide-icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import ThemeSwitcher from "@/components/common/theme-switcher";

// Dev screen: shows the `components/ui` components with their
// variants, separated by tabs. Labels are the code names (not product
// copy), which is why they do not go through i18n.
export default function UiKit() {
  const [tab, setTab] = useState("buttons");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fruit, setFruit] = useState("apple");
  const [size, setSize] = useState("m");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between gap-2  px-5 pb-2 pt-3">
        <View className="flex-row items-center gap-2">
          <Button
            size="icon-sm"
            variant={"secondary"}
            accessibilityRole="button"
            onPress={() => router.back()}
          >
            <Icon icon={ArrowLeft} />
          </Button>
          <Text variant="h4">UI Kit</Text>
        </View>
        <ThemeSwitcher size="icon-sm" />
      </View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 40,
        }}
      >
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList fit="content">
            <TabsTrigger value="buttons">
              <Text>Buttons</Text>
            </TabsTrigger>
            <TabsTrigger value="badges">
              <Text>Badge</Text>
            </TabsTrigger>
            <TabsTrigger value="texts">
              <Text>Texts</Text>
            </TabsTrigger>
            <TabsTrigger value="icons">
              <Text>Icons</Text>
            </TabsTrigger>
            <TabsTrigger value="drawer">
              <Text>Drawer</Text>
            </TabsTrigger>
            <TabsTrigger value="dialog">
              <Text>Dialog</Text>
            </TabsTrigger>
            <TabsTrigger value="select">
              <Text>Select</Text>
            </TabsTrigger>
            <TabsTrigger value="input">
              <Text>Input</Text>
            </TabsTrigger>
            <TabsTrigger value="group">
              <Text>Group</Text>
            </TabsTrigger>
            <TabsTrigger value="tabs">
              <Text>Tabs</Text>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buttons">
            <DemoSection title="Button · variants">
              <View className="gap-2 p-4">
                <Button>
                  <Text>Default</Text>
                </Button>
                <Button variant="secondary">
                  <Text>Secondary</Text>
                </Button>
                <Button variant="outline">
                  <Text>Outline</Text>
                </Button>
                <Button variant="destructive">
                  <Text>Destructive</Text>
                </Button>
                <Button variant="ghost">
                  <Text>Ghost</Text>
                </Button>
                <Button variant="link">
                  <Text>Link</Text>
                </Button>
              </View>
            </DemoSection>

            <DemoSection title="Button · sizes">
              <View className="flex-row flex-wrap items-center gap-2 p-4">
                <Button size="sm">
                  <Text>Small</Text>
                </Button>
                <Button>
                  <Text>Default</Text>
                </Button>
                <Button size="lg">
                  <Text>Large</Text>
                </Button>
                <Button size="icon">
                  <Icon icon={Heart} />
                </Button>
              </View>
            </DemoSection>
          </TabsContent>

          <TabsContent value="badges">
            <DemoSection title="Badge · variants">
              <View className="flex-row flex-wrap gap-2 p-4">
                <Badge>
                  <Text>Default</Text>
                </Badge>
                <Badge variant="secondary">
                  <Text>Secondary</Text>
                </Badge>
                <Badge variant="destructive">
                  <Text>Destructive</Text>
                </Badge>
                <Badge variant="outline">
                  <Text>Outline</Text>
                </Badge>
              </View>
            </DemoSection>
          </TabsContent>

          <TabsContent value="texts">
            <DemoSection title="Text · variants">
              <View className="gap-2 p-4">
                <Text variant="h1">Heading 1</Text>
                <Text variant="h2">Heading 2</Text>
                <Text variant="h3">Heading 3</Text>
                <Text variant="h4">Heading 4</Text>
                <Text variant="p">
                  Paragraph: the quick brown fox jumps over the lazy dog.
                </Text>
                <Text variant="lead">Lead: stands out a bit more.</Text>
                <Text variant="large">Large semibold</Text>
                <Text variant="small">Small text</Text>
                <Text variant="muted">Muted text</Text>
                <Text variant="blockquote">Blockquote text</Text>
                <Text variant="code">code()</Text>
              </View>
            </DemoSection>
          </TabsContent>

          <TabsContent value="icons">
            <DemoSection title="Icon · lucide">
              <View className="flex-row flex-wrap gap-4 p-4">
                <Icon icon={House} />
                <Icon icon={UserRound} />
                <Icon icon={Bell} />
                <Icon icon={Globe} />
                <Icon icon={Sun} />
                <Icon icon={Moon} />
                <Icon icon={Heart} color="#ef4444" />
              </View>
            </DemoSection>

            <DemoSection title="LucideIcon · by name">
              {/* The LucideIconName type prevents invalid names at compile time;
                  the "Icon not found" fallback only applies to dynamic names. */}
              <View className="flex-row flex-wrap items-center gap-4 p-4">
                <LucideIcon iconName="House" />
                <LucideIcon iconName="Globe" size={24} />
              </View>
            </DemoSection>
          </TabsContent>

          <TabsContent value="drawer">
            <DemoSection title="Drawer · demo">
              <View className="p-4">
                <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                  <DrawerTrigger asChild>
                    <Button>
                      <Text>Open drawer</Text>
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <DrawerHeader>
                      <DrawerTitle>Drawer title</DrawerTitle>
                      <DrawerDescription>
                        Example description. Tap outside or swipe from the
                        header to close.
                      </DrawerDescription>
                    </DrawerHeader>
                    <Text variant="p" className="px-1 py-2">
                      Free-form content: anything goes here (lists,
                      forms, confirmations…).
                    </Text>
                    <DrawerFooter>
                      <DrawerClose asChild>
                        <Button variant="outline">
                          <Text>Cancel</Text>
                        </Button>
                      </DrawerClose>
                      <DrawerClose asChild>
                        <Button>
                          <Text>Confirm</Text>
                        </Button>
                      </DrawerClose>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              </View>
            </DemoSection>
          </TabsContent>

          <TabsContent value="dialog">
            <DemoSection title="Dialog · demo">
              <View className="p-4">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Text>Open dialog</Text>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit profile</DialogTitle>
                      <DialogDescription>
                        Make changes and save when you are done.
                      </DialogDescription>
                    </DialogHeader>
                    <Text variant="p">
                      Dialog content: the fields would go here (Field,
                      Input and Label do not exist yet in the mobile kit).
                    </Text>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline" className="w-full">
                          <Text>Cancel</Text>
                        </Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button className="w-full">
                          <Text>Save</Text>
                        </Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </View>
            </DemoSection>
          </TabsContent>

          <TabsContent value="select">
            <DemoSection title="Select · demo">
              <View className="gap-3 p-4">
                <Select value={fruit} onValueChange={setFruit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Favorite fruit" />
                  </SelectTrigger>
                  <SelectContent title="Favorite fruit">
                    <SelectItem value="strawberry">Strawberry</SelectItem>
                    <SelectItem value="pear">Pear</SelectItem>
                    <SelectItem value="mandarin">Mandarin</SelectItem>
                    <SelectItem value="apple">Apple</SelectItem>
                    <SelectItem value="banana">Banana</SelectItem>
                    <SelectItem value="kiwi">Kiwi</SelectItem>
                    <SelectItem value="grape">Grape</SelectItem>
                    <SelectItem value="watermelon">Watermelon</SelectItem>
                    <SelectItem value="orange">Orange</SelectItem>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Exotic</SelectLabel>
                      <SelectItem value="mango">Mango</SelectItem>
                      <SelectItem value="kiwi">Kiwi</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="No value (placeholder)" />
                  </SelectTrigger>
                  <SelectContent title="No value">
                    <SelectItem value="one">One</SelectItem>
                    <SelectItem value="two">Two</SelectItem>
                  </SelectContent>
                </Select>
              </View>
            </DemoSection>
            <DemoSection title="Select · dropdown">
              <View className="p-4">
                <Select variant="dropdown" value={size} onValueChange={setSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="Size" />
                  </SelectTrigger>
                  <SelectContent side="bottom">
                    <SelectItem value="s">Small</SelectItem>
                    <SelectItem value="m">Medium</SelectItem>
                    <SelectItem value="l">Large</SelectItem>
                  </SelectContent>
                </Select>
              </View>
            </DemoSection>
          </TabsContent>

          <TabsContent value="input">
            <DemoSection title="Input · demo">
              <View className="gap-3 p-4">
                <Input
                  placeholder="Name"
                  value={name}
                  onChangeText={setName}
                />
                <Input placeholder="Disabled" editable={false} />
                <Input placeholder="Password" secureTextEntry />
              </View>
            </DemoSection>
          </TabsContent>

          <TabsContent value="group">
            <DemoSection title="InputGroup · demo">
              <View className="gap-3 p-4">
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <Icon icon={Search} size={16} />
                  </InputGroupAddon>
                  <InputGroupInput placeholder="Search…" />
                </InputGroup>
                <InputGroup>
                  <InputGroupInput
                    placeholder="Password"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <InputGroupButton
                    size="icon-xs"
                    onPress={() => setShowPassword((s) => !s)}
                  >
                    <Icon icon={showPassword ? EyeOff : Eye} size={16} />
                  </InputGroupButton>
                </InputGroup>
                <InputGroup>
                  <InputGroupText>$</InputGroupText>
                  <InputGroupInput placeholder="0.00" keyboardType="numeric" />
                  <InputGroupText>USD</InputGroupText>
                </InputGroup>
              </View>
            </DemoSection>
          </TabsContent>

          <TabsContent value="tabs">
            <DemoSection title="Tabs · default">
              <View className="p-4">
                <Tabs defaultValue="a">
                  <TabsList>
                    <TabsTrigger value="a">
                      <Text>One</Text>
                    </TabsTrigger>
                    <TabsTrigger value="b">
                      <Text>Two</Text>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="a">
                    <Text>Content A</Text>
                  </TabsContent>
                  <TabsContent value="b">
                    <Text>Content B</Text>
                  </TabsContent>
                </Tabs>
              </View>
            </DemoSection>
            <DemoSection title="Tabs · line + content">
              <View className="p-4">
                <Tabs defaultValue="x">
                  <TabsList variant="line" fit="content">
                    <TabsTrigger value="x">
                      <Text>Long option</Text>
                    </TabsTrigger>
                    <TabsTrigger value="y">
                      <Text>Other</Text>
                    </TabsTrigger>
                    <TabsTrigger value="z">
                      <Text>More</Text>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="x">
                    <Text>Content X</Text>
                  </TabsContent>
                  <TabsContent value="y">
                    <Text>Content Y</Text>
                  </TabsContent>
                  <TabsContent value="z">
                    <Text>Content Z</Text>
                  </TabsContent>
                </Tabs>
              </View>
            </DemoSection>
          </TabsContent>
        </Tabs>
      </ScrollView>
    </SafeAreaView>
  );
}

function DemoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text variant="muted" className="px-1">
        {title}
      </Text>
      <View className="rounded-3xl bg-card">{children}</View>
    </View>
  );
}
