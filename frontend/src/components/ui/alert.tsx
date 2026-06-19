import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "border-border bg-muted/30 text-foreground",
        destructive:
          "border-[var(--geo-error)]/30 bg-[var(--geo-error)]/10 text-foreground [&>svg]:text-[var(--geo-error)]",
        success:
          "border-[var(--geo-healthy)]/30 bg-[var(--geo-healthy)]/10 text-foreground [&>svg]:text-[var(--geo-healthy)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn("text-sm text-muted-foreground [&_p]:leading-relaxed", className)} {...props} />;
}
