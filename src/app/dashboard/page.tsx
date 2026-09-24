import { redirect } from "next/navigation";
import { exigerConnexion } from "@/lib/auth/current";
import { homeFor } from "@/lib/roles";

/** Redirige chaque rôle vers son espace (équivalent de la route Laravel `dashboard`). */
export default async function Dashboard() {
  const user = await exigerConnexion();
  redirect(homeFor(user.role));
}
