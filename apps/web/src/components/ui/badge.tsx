import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border border-slate-800 bg-slate-900 text-slate-200",
        emerald:
          "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
        indigo:
          "border border-indigo-500/20 bg-indigo-500/10 text-indigo-400",
        cyan:
          "border border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
        amber:
          "border border-amber-500/20 bg-amber-500/10 text-amber-400",
        destructive:
          "border border-rose-500/20 bg-rose-500/10 text-rose-400",
        outline:
          "border border-slate-800 text-slate-400",
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
