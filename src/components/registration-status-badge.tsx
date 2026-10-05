import type { RegistrationStatus } from "@/lib/database.types";
import { Badge } from "@/components/ui/badge";

const label: Record<RegistrationStatus, string> = {
  anmald: "Anmäld",
  vantelista: "Väntelista",
  avanmald: "Avanmäld",
};

export function RegistrationStatusBadge({ status }: { status: RegistrationStatus }) {
  return (
    <Badge
      variant={status === "anmald" ? "default" : "secondary"}
      className={
        status === "vantelista"
          ? "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
          : undefined
      }
    >
      {label[status]}
    </Badge>
  );
}
