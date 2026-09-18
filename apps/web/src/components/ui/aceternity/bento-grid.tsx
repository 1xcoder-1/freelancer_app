import { cn } from "@/lib/utils";

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "grid md:auto-rows-[22rem] grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto",
        className
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem = ({
  className,
  title,
  description,
  header,
  icon,
  tag,
}: {
  className?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
  tag?: string;
}) => {
  return (
    <div
      className={cn(
        "row-span-1 rounded-3xl group/bento hover:shadow-2xl transition duration-200 shadow-input p-6 sm:p-8 bg-slate-900/50 border border-slate-800/80 justify-between flex flex-col space-y-4 backdrop-blur-xl hover:border-slate-700",
        className
      )}
    >
      {header}
      <div className="group-hover/bento:translate-x-1 transition duration-200">
        <div className="flex items-center justify-between mb-3">
          {icon}
          {tag && (
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-400 font-semibold">
              {tag}
            </span>
          )}
        </div>
        <div className="font-bold text-white text-lg mb-2">
          {title}
        </div>
        <div className="font-normal text-slate-400 text-xs sm:text-sm leading-relaxed">
          {description}
        </div>
      </div>
    </div>
  );
};
