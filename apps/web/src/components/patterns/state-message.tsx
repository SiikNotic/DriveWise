import { AlertCircleIcon, InboxIcon, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StateTone = "empty" | "error";

const TONE_ICON: Record<StateTone, LucideIcon> = {
  empty: InboxIcon,
  error: AlertCircleIcon,
};

export interface StateMessageProps {
  tone: StateTone;
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: { label: string; onClick: () => void };
  className?: string;
}

/**
 * Shared layout for "nothing to show" and "something broke" — empty and
 * error states differ only in default icon/tone, not in shape, so they stay
 * one component instead of two near-identical ones.
 */
export function StateMessage({
  tone,
  title,
  description,
  icon,
  action,
  className,
}: StateMessageProps) {
  const Icon = icon ?? TONE_ICON[tone];

  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center",
        tone === "error" ? "border-destructive/30" : "border-border",
        className,
      )}
    >
      <Icon
        className={cn(
          "size-8",
          tone === "error" ? "text-destructive" : "text-muted-foreground",
        )}
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {action ? (
        <Button size="sm" variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState(props: Omit<StateMessageProps, "tone">) {
  return <StateMessage tone="empty" {...props} />;
}

export function ErrorState(props: Omit<StateMessageProps, "tone">) {
  return <StateMessage tone="error" {...props} />;
}
