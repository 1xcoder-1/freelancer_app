import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "border border-line bg-surface text-muted",
        emerald:
          "border border-ok/25 bg-ok/10 text-ok",
        indigo:
          "border border-info/25 bg-info/10 text-info",
        cyan:
          "border border-accent/25 bg-accent/10 text-accent",
        amber:
          "border border-warn/25 bg-warn/10 text-warn",
        destructive:
          "border border-danger/25 bg-danger/10 text-danger",
        outline:
          "border border-line-strong text-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
