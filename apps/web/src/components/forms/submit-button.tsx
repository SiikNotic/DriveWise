"use client";

import { useFormStatus } from "react-dom";

import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

export function SubmitButton({
  children,
  pendingChildren,
  className,
  variant,
}: {
  children: React.ReactNode;
  pendingChildren: React.ReactNode;
  className?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} disabled={pending} className={className}>
      {pending ? pendingChildren : children}
    </Button>
  );
}
