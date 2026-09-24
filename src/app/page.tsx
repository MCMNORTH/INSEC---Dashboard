import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/auth/current";
import { homeFor } from "@/lib/roles";

export default async function Accueil() {
  const user = await utilisateurCourant();
  redirect(user ? homeFor(user.role) : "/login");
}
