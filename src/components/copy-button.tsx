"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Urklipp blockerat: visa texten så att den kan kopieras för hand.
          window.prompt("Kopiera:", text);
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Kopierat" : label}
    </Button>
  );
}
