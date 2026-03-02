interface SpinnerProps { size?: number; className?: string; }

export function Spinner({ size = 16, className = "" }: SpinnerProps) {
  return (
    <div
      className={`rounded-full border-2 border-accent/30 border-t-accent animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
