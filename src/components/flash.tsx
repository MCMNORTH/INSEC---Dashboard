import { cookies } from "next/headers";
import { COOKIE_FLASH } from "@/lib/actions";
import { EffacerFlash } from "./effacer-flash";

/** Affiche le message laissé par l'action précédente puis l'efface. */
export async function Flash({ className = "mb-4" }: { className?: string }) {
  const brut = (await cookies()).get(COOKIE_FLASH)?.value;
  if (!brut) return null;
  let flash: { type: "succes" | "erreur"; message: string } | null = null;
  try {
    flash = JSON.parse(decodeURIComponent(brut));
  } catch {
    flash = null;
  }
  if (!flash?.message) return <EffacerFlash />;
  return (
    <>
      <div
        role={flash.type === "erreur" ? "alert" : "status"}
        className={`${className} text-sm p-3 rounded-lg ${
          flash.type === "erreur" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
        }`}
      >
        {flash.message}
      </div>
      <EffacerFlash />
    </>
  );
}
