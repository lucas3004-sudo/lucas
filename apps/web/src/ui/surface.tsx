import type { ReactNode } from "react";
import { cn } from "./cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]", className)}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="font-display text-[16px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[32px]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </header>
  );
}

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-ink-muted",
  brand: "bg-brand-soft text-brand-text",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function Alert({ tone, children }: { tone: "success" | "danger" | "warning" | "brand"; children: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("pop-in rounded-[var(--radius-control)] px-3.5 py-2.5 text-sm", tones[tone])}>
      {children}
    </div>
  );
}
