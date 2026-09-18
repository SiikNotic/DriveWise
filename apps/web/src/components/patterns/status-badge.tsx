import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleIcon,
  ClockIcon,
  XCircleIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "positive" | "negative" | "warning" | "serious" | "neutral";

const TONE_ICON: Record<StatusTone, React.ComponentType<{ className?: string }>> = {
  positive: CheckCircle2Icon,
  negative: XCircleIcon,
  warning: ClockIcon,
  serious: AlertTriangleIcon,
  neutral: CircleIcon,
};

const TONE_VARIANT = {
  positive: "positive",
  negative: "negative",
  warning: "warning",
  serious: "serious",
  neutral: "outline",
} as const;

/**
 * A status is never carried by color alone (dataviz skill): every tone ships
 * with an icon and requires a label. Use this for sync state, trip/offer
 * decisions, and anywhere else a driver needs an at-a-glance state.
 */
export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = TONE_ICON[tone];

  return (
    <Badge variant={TONE_VARIANT[tone]} className={cn("gap-1.5", className)}>
      <Icon className="size-3" aria-hidden="true" />
      {children}
    </Badge>
  );
}
