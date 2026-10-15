// Adapted from shadcn/ui's new-york-v4 Sheet registry component.
// Radix owns presence, focus trapping, dismissal, and scroll locking.
import * as SheetPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export function SheetContent({
  className = "",
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "left" | "right" | "top" | "bottom";
  showCloseButton?: boolean;
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="sheet-overlay"
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={`sheet-content ${className}`}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetClose className="sheet-close">
            <XMarkIcon width={20} height={20} aria-hidden="true" />
            <span className="sr-only">Close</span>
          </SheetClose>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
export function SheetHeader({
  className = "",
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={`sheet-header ${className}`}
      {...props}
    />
  );
}
export function SheetFooter({
  className = "",
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={`sheet-footer ${className}`}
      {...props}
    />
  );
}
export function SheetTitle(props: ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot="sheet-title" {...props} />;
}
export function SheetDescription(
  props: ComponentProps<typeof SheetPrimitive.Description>,
) {
  return (
    <SheetPrimitive.Description data-slot="sheet-description" {...props} />
  );
}
