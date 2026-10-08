import type { UserRole } from "@/lib/database.types";

export const roleLabel: Record<UserRole, string> = {
  lagadmin: "LagAdmin",
  foreningsadmin: "FöreningsAdmin",
  superadmin: "SuperAdmin",
};

export const roleDescription: Record<UserRole, string> = {
  lagadmin: "Anmäler lag och domare för sin förening.",
  foreningsadmin: "Arrangerar sammandrag och hanterar föreningens medlemmar.",
  superadmin: "Kan allt: alla föreningar, sammandrag, användare och nivåer.",
};

export const roles: UserRole[] = ["lagadmin", "foreningsadmin", "superadmin"];

export function isUserRole(value: string): value is UserRole {
  return (roles as string[]).includes(value);
}
