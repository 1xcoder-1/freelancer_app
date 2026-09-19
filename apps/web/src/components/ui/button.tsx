import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30",
        indigo:
          "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:from-indigo-400 hover:to-indigo-500 shadow-lg shadow-indigo-500/25",
        destructive:
          "bg-rose-500 text-white hover:bg-rose-600 shadow-md shadow-rose-500/20",
        outline:
          "border border-slate-700 bg-slate-900/50 hover:bg-slate-800/80 text-slate-200 hover:text-white backdrop-blur-sm hover:border-slate-600",
        secondary:
          "bg-slate-800 text-slate-100 hover:bg-slate-700 shadow-sm",
        ghost:
          "text-slate-300 hover:bg-slate-800/60 hover:text-white",
        link:
          "text-emerald-400 underline-offset-4 hover:underline",
        gradient:
          "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-extrabold hover:opacity-95 shadow-lg shadow-emerald-500/20",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        lg: "h-13 rounded-xl px-8 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
