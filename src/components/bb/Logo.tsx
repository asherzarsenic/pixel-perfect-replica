export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-md border border-border bg-elevated"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className="font-display font-bold tracking-tight text-foreground"
        style={{ fontSize: size * 0.4 }}
      >
        <span className="text-primary">[</span>
        BB
        <span className="text-primary">]</span>
      </span>
    </div>
  );
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      <div className="leading-tight">
        <div className="font-display text-sm font-bold tracking-wide text-foreground">
          BRIEF BUSTER
        </div>
        <div className="text-[11px] text-muted-foreground">Creative Production Toolkit</div>
      </div>
    </div>
  );
}
