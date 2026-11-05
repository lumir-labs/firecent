"use client";

import { usePathname } from "@/i18n/navigation";
import Image from "next/image";
import { getFullMenu } from "./menus";

export default function ImageHeader() {
  const pathName = usePathname();
  let active = false;
  const fullMenu = getFullMenu();
  fullMenu.forEach((cat) => {
    if (cat.path === pathName) {
      active = true;
    }
  });

  if (active) {
    return (
      <div className="flex items-center justify-center max-h-12 h-12 mb-2 mt-0.5 sm:hidden">
        <Image
          priority
          src="/icon_d.webp"
          alt="icon"
          width={200}
          height={200}
          className="h-10 p-1 mt-3 mb-2 dark:invert"
        />
      </div>
    );
  }
}
