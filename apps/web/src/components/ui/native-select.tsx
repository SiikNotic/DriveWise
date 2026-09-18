import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A plain <select>, styled to match Input/SelectTrigger. Used where a
 * Radix-based Select isn't warranted (e.g. a short, static options list
 * inside a form) — native <select> is also the most accessible and
 * mobile-friendly option for this case (native OS picker on touch devices).
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "border-input flex h-9 w-full appearance-none rounded-md border bg-transparent px-3 py-1 pr-8 text-base shadow-xs transition-colors outline-none",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "md:text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 opacity-50"
        aria-hidden="true"
      />
    </div>
  );
}

export { NativeSelect };
