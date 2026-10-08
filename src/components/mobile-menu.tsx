"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

// Menyknapp för mobil. Bygger på <details> så att den fungerar utan
// JavaScript; med JavaScript stängs den vid sidbyte och klick utanför.
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) {
        ref.current.open = false;
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <details ref={ref} className="relative lg:hidden">
      <summary
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md border border-white/30 hover:bg-white/10 [&::-webkit-details-marker]:hidden"
        aria-label="Meny"
      >
        <Menu className="size-5" />
      </summary>
      <div className="absolute right-0 z-20 mt-2 grid w-60 gap-1 rounded-lg border bg-popover p-2 text-sm text-popover-foreground shadow-lg">
        {children}
      </div>
    </details>
  );
}
