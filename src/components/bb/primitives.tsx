import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-card", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  label,
  title,
  action,
}: {
  label?: string;
  title: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div>
        {label ? <div className="label-caps">{label}</div> : null}
        <div className="font-display text-sm font-medium text-foreground">{title}</div>
      </div>
      {action}
    </div>
  );
}

export type StatusKind = "pass" | "warn" | "fail" | "ai" | "neutral";

const STATUS_STYLES: Record<StatusKind, string> = {
  pass: "border-pass/40 bg-pass/10 text-pass",
  warn: "border-warn/40 bg-warn/10 text-warn",
  fail: "border-fail/40 bg-fail/10 text-fail",
  ai: "border-primary/40 bg-primary/10 text-primary",
  neutral: "border-border bg-elevated text-muted-foreground",
};

export function StatusBadge({
  kind,
  children,
  className,
}: {
  kind: StatusKind;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider",
        STATUS_STYLES[kind],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="min-w-24 rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="font-display text-xl font-bold leading-none text-foreground">{value}</div>
      <div className="mt-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon ? <div className="text-subtle">{icon}</div> : null}
      <div className="font-display text-sm font-medium text-foreground">{title}</div>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
