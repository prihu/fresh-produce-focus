
import { cn } from "@/lib/utils";

interface ModernSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'pulse' | 'wave';
  lines?: number;
  avatar?: boolean;
}

function ModernSkeleton({ 
  className, 
  variant = 'wave',
  lines = 1,
  avatar = false,
  ...props 
}: ModernSkeletonProps) {
  const baseClasses = "rounded-md bg-gray-200";
  const variantClasses = {
    pulse: "animate-pulse",
    wave: "skeleton-wave"
  };

  if (lines > 1) {
    return (
      <div className="space-y-2" {...props}>
        {avatar && (
          <div className={cn(
            baseClasses,
            variantClasses[variant],
            "w-10 h-10 rounded-full",
            className
          )} />
        )}
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              baseClasses,
              variantClasses[variant],
              "h-4",
              i === lines - 1 ? "w-3/4" : "w-full",
              className
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

export { ModernSkeleton };
