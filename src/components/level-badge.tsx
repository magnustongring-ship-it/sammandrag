import { cn } from "@/lib/utils";

// Easy Basket-nivåernas färger, som i Svensk Baskets regeldokument.
const colors: Record<string, string> = {
  blå: "bg-sky-200 text-sky-950",
  orange: "bg-orange-200 text-orange-950",
  lila: "bg-violet-300 text-violet-950",
};

export function LevelBadge({ level, className }: { level: string | null; className?: string }) {
  if (!level) return null;
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-xs font-semibold",
        colors[level.toLowerCase()] ?? "bg-secondary text-secondary-foreground",
        className,
      )}
    >
      {level}
    </span>
  );
}
