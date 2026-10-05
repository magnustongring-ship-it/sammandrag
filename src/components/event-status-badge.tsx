import type { EventStatus } from "@/lib/database.types";
import { Badge } from "@/components/ui/badge";

const label: Record<EventStatus, string> = {
  utkast: "Utkast",
  publicerad: "Publicerad",
  avbokad: "Avbokad",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <Badge
      variant={
        status === "publicerad" ? "default" : status === "avbokad" ? "destructive" : "secondary"
      }
    >
      {label[status]}
    </Badge>
  );
}
