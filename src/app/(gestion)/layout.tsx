import type { ReactNode } from "react";
import { CoqueGestion } from "@/components/coques";
import { exigerRole } from "@/lib/auth/current";
import { FINANCE } from "@/lib/roles";

/** Espace administration et finance : réservé aux rôles admin, super_admin et finance. */
export default async function LayoutGestion({ children }: { children: ReactNode }) {
  const user = await exigerRole(FINANCE);
  return <CoqueGestion user={user}>{children}</CoqueGestion>;
}
