// Adapted from shadcn/ui's Radix Popover registry component for our CSS system.
import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ComponentProps } from "react";
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export function PopoverContent({
  className = "",
  align = "center",
  sideOffset = 4,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={`popover-content ${className}`}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
