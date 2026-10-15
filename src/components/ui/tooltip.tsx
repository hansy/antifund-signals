import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactElement } from "react";
export function IconTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactElement;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={250}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content className="icon-tooltip" sideOffset={6}>
            {label}
            <TooltipPrimitive.Arrow className="icon-tooltip-arrow" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
