// chart.tsx - minimal re-export, we use recharts directly
import * as React from "react";

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
    color?: string;
    theme?: Record<string, string>;
  };
};

export const ChartContainer = React.forwardRef<HTMLDivElement, React.ComponentProps<"div"> & { config?: ChartConfig }>(
  ({ children, ...props }, ref) => <div ref={ref} {...props}>{children}</div>
);
ChartContainer.displayName = "ChartContainer";
