import * as React from "react";
import { cn } from "@/lib/cn";

interface Props extends React.ComponentProps<"div"> {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function SectionCard({
  title,
  description,
  action,
  className,
  children,
  ...props
}: Props) {
  return (
    <div
      data-slot="section-card"
      className={cn(
        "rounded-xl border bg-card p-4 text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-fg-3">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
