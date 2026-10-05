import { cn } from "@/lib/utils";

/** Basketboll som logotyp. */
export function BallIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <circle cx="16" cy="16" r="15" className="fill-ball" />
      <g fill="none" stroke="currentColor" strokeWidth="1.6" className="text-brand">
        <circle cx="16" cy="16" r="15" />
        <path d="M1 16h30M16 1v30" />
        <path d="M5.5 5.5c4.5 4 4.5 17 0 21M26.5 5.5c-4.5 4-4.5 17 0 21" />
      </g>
    </svg>
  );
}
