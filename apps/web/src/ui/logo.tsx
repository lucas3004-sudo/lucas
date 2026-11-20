/** Marque ImmoPilot : un toit stylisé dont la pointe devient une flèche de navigation. */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M8 22.5V14.8L16 8.5l8 6.3v7.7" fill="none" stroke="var(--canvas)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M12.5 22.5l3.5-6 3.5 6" fill="none" stroke="var(--canvas)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5 text-ink">
      <LogoMark className="size-7 text-brand" />
      <span className="text-[15px] font-semibold tracking-tight">
        ImmoPilot <span className="font-medium text-ink-muted">AI</span>
      </span>
    </span>
  );
}
