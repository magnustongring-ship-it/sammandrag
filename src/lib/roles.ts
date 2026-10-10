import type { UserRole } from "@/lib/database.types";

export const roleLabel: Record<UserRole, string> = {
  domare: "Domare",
  lagadmin: "LagAdmin",
  foreningsadmin: "FöreningsAdmin",
  superadmin: "SuperAdmin",
};

export const roleDescription: Record<UserRole, string> = {
  domare: "Domarkonto utan förening. Ser sina tillsatta matcher.",
  lagadmin: "Ledare för ett eller flera lag. Anmäler sina lag till sammandrag.",
  foreningsadmin:
    "Arrangerar sammandrag, hanterar föreningens medlemmar och lag, bjuder in LagAdmin och kan anmäla alla föreningens lag.",
  superadmin: "Kan allt: alla föreningar, sammandrag, användare och nivåer.",
};

export const roles: UserRole[] = ["domare", "lagadmin", "foreningsadmin", "superadmin"];

export function isUserRole(value: string): value is UserRole {
  return (roles as string[]).includes(value);
}
