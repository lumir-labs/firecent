import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Empty({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  /** "state" = Firecent N13 empty/error block. */
  variant?: "default" | "state"
}) {
  return (
    <div
      data-slot="empty"
      data-variant={variant}
      className={cn(
        "group/empty flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-lg border-dashed p-12 text-center text-balance",
        variant === "state" &&
          "flex-none justify-start gap-0 rounded-none px-8 py-12",
        className
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn("flex max-w-sm flex-col items-center gap-2 group-data-[variant=state]/empty:max-w-none group-data-[variant=state]/empty:gap-0", className)}
      {...props}
    />
  )
}

const emptyMediaVariants = cva(
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6 group-data-[variant=state]/empty:mb-0 group-data-[variant=state]/empty:size-14 group-data-[variant=state]/empty:rounded-2xl group-data-[variant=state]/empty:text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-title"
      className={cn(
        "font-heading text-lg font-medium tracking-tight group-data-[variant=state]/empty:mt-4 group-data-[variant=state]/empty:text-[17px] group-data-[variant=state]/empty:font-semibold group-data-[variant=state]/empty:tracking-normal",
        className
      )}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        "text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary group-data-[variant=state]/empty:mt-1.5 group-data-[variant=state]/empty:max-w-[280px] group-data-[variant=state]/empty:text-[14px] group-data-[variant=state]/empty:leading-[20px]",
        className
      )}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        "flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance group-data-[variant=state]/empty:mt-5 group-data-[variant=state]/empty:gap-2",
        className
      )}
      {...props}
    />
  )
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
}
