import Link from "next/link";
import { BallIcon } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t bg-brand text-brand-foreground/80">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm">
        <div className="flex items-center gap-2">
          <BallIcon className="size-5" />
          <span>Easy Basket planeraren – planera och anmäl lag till basketsammandrag</span>
        </div>
        <Link href="/" className="hover:text-brand-foreground hover:underline">
          Kalender
        </Link>
      </div>
    </footer>
  );
}
